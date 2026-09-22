import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock, Loader2, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Zapis vraćen sa erp.radnici_prisutnost_pregled() — pored poznatih kolona
// sadrži i po jednu numeričku kolonu (broj sati) za svaku vrstu rada.
interface PrisutnostZapis {
  sifra_tabele: number;
  sifra_radnika: number;
  naziv_radnika: string;
  vrsta_radnika: number;
  datum_pocetka: string;
  datum_kraja: string | null;
  smjena: number | null;
  [key: string]: unknown;
}

// Minimalan oblik reda iz erp.radnici_pregled (getRadniciPregledSve) — koristi
// se samo da se dobije stvarni naziv radnog mjesta (vrsta_posla) po
// vrsta_radnika kodu, jer erp.radnici_prisutnost_pregled vraća samo INT kod.
interface RadnikVrsta {
  vrsta_radnika: number;
  vrsta_posla: string | null;
}

// Fallback nazivi vrsta_radnika (vidi docs/radnici_vrste_radnika.txt) —
// koriste se samo ako erp.radnici_pregled ne vrati naziv za dati kod.
const VRSTA_RADNIKA_LABELS: Record<number, string> = {
  0: "Ostalo",
  1: "Vlasnik",
  2: "Komercijala",
  3: "Kancelarija",
  4: "Proizvodnja kesa",
  5: "Proizvodnja kutija",
  6: "Magacin",
  7: "Vozač",
  10: "Spoljni saradnik",
};

// Kolone sa brojem sati po vrsti rada (isti spisak kao u Unos prisutnosti).
const VRSTA_RADA_OPTIONS = [
  { key: "redovan_rad", label: "Redovan rad" },
  { key: "prekovremeni_rad", label: "Prekovremeni rad" },
  { key: "rad_nocu", label: "Rad noću" },
  { key: "rad_praznikom", label: "Rad praznikom" },
  { key: "terenski_rad", label: "Terenski rad" },
  { key: "dezurstvo", label: "Dežurstvo" },
  { key: "godisnji_odmor", label: "Godišnji odmor" },
  { key: "praznik_odmor", label: "Praznik (neradni dan)" },
  { key: "privremena_nesposobnost", label: "Bolovanje" },
  { key: "porodiljsko", label: "Porodiljsko odsustvo" },
  { key: "placeno_odsustvo", label: "Plaćeno odsustvo" },
  { key: "neplaceno_odsustvo", label: "Neplaćeno odsustvo" },
  { key: "odsustvo_bez_krivice", label: "Odsustvo bez krivice" },
  { key: "ostala_odsustva", label: "Ostala odsustva" },
  { key: "sedmicni_odmor", label: "Sedmični odmor" },
] as const;

const izvuciDan = (v: string): string => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : v;
};

const formatirajDan = (dan: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dan);
  if (!m) return dan;
  const [, yyyy, MM, dd] = m;
  return `${dd}.${MM}.${yyyy}.`;
};

const izvuciVrijeme = (v: string | null): string | null => {
  if (!v) return null;
  const m = /(\d{2}):(\d{2})/.exec(v);
  return m ? `${m[1]}:${m[2]}` : v;
};

const opisSati = (z: PrisutnostZapis): string => {
  const dijelovi = VRSTA_RADA_OPTIONS.map((o) => ({
    label: o.label,
    sati: Number(z[o.key]) || 0,
  })).filter((d) => d.sati > 0);
  return dijelovi.length > 0
    ? dijelovi.map((d) => `${d.label} ${d.sati}h`).join(", ")
    : "–";
};

const TH = ({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) => (
  <th
    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#f4f1f9] dark:bg-[#2a2340] ${center ? "text-center" : "text-left"}`}
    style={{ color: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) => (
  <td
    className={`px-4 py-2 text-sm break-words border-b border-gray-100 dark:border-[#2d2648] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
  >
    {children}
  </td>
);

export function RadniciPrisutnostPregled() {
  const [data, setData] = useState<PrisutnostZapis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [radniciVrste, setRadniciVrste] = useState<RadnikVrsta[]>([]);
  const [otvoreniDani, setOtvoreniDani] = useState<Set<string>>(new Set());
  const [pocetnoOtvoreno, setPocetnoOtvoreno] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/radnici/prisutnost/pregled`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setData(json.data ?? []))
      .catch(() => setError("Greška pri učitavanju prisutnosti"))
      .finally(() => setLoading(false));
  }, []);

  // Stvarni naziv radnog mjesta (rm.vrsta_posla) po vrsta_radnika kodu —
  // erp.radnici_prisutnost_pregled vraća samo INT, pa se povezuje sa
  // podacima iz erp.radnici_pregled (ista lista koju koristi Pregled radnika).
  useEffect(() => {
    fetch(`${API_URL}/api/radnici/pregled-sve`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setRadniciVrste(json.data ?? []))
      .catch(() => setRadniciVrste([]));
  }, []);

  const vrstaPoslaMap = useMemo(() => {
    const mapa = new Map<number, string>();
    radniciVrste.forEach((r) => {
      if (r.vrsta_posla) mapa.set(r.vrsta_radnika, r.vrsta_posla);
    });
    return mapa;
  }, [radniciVrste]);

  const vrstaRadnikaLabel = (kod: number) =>
    vrstaPoslaMap.get(kod) ?? VRSTA_RADNIKA_LABELS[kod] ?? `Vrsta ${kod}`;

  const filtrirano = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return data;
    return data.filter((z) => z.naziv_radnika?.toLowerCase().includes(q));
  }, [data, pretraga]);

  // Logičko grupisanje: prvo po danu (opadajuće, najnoviji prvi), unutar
  // dana po vrsta_radnika (rastuće), unutar vrste po nazivu radnika.
  const grupisanoPoDanima = useMemo(() => {
    const poDanu = new Map<string, PrisutnostZapis[]>();
    filtrirano.forEach((z) => {
      const dan = izvuciDan(z.datum_pocetka);
      const lista = poDanu.get(dan) ?? [];
      lista.push(z);
      poDanu.set(dan, lista);
    });

    return Array.from(poDanu.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dan, zapisi]) => {
        const poVrsti = new Map<number, PrisutnostZapis[]>();
        zapisi.forEach((z) => {
          const lista = poVrsti.get(z.vrsta_radnika) ?? [];
          lista.push(z);
          poVrsti.set(z.vrsta_radnika, lista);
        });
        const grupe = Array.from(poVrsti.entries())
          .sort(([a], [b]) => a - b)
          .map(([vrsta, zapisiVrste]) => ({
            vrsta,
            zapisi: [...zapisiVrste].sort((a, b) =>
              a.naziv_radnika.localeCompare(b.naziv_radnika, "sr-Latn"),
            ),
          }));
        return { dan, grupe, ukupno: zapisi.length };
      });
  }, [filtrirano]);

  // Podrazumevano otvoren samo najnoviji dan (skalabilno kad ima puno dana
  // — ostali se ne renderuju dok se ne klikne na njih).
  useEffect(() => {
    if (!pocetnoOtvoreno && grupisanoPoDanima.length > 0) {
      setOtvoreniDani(new Set([grupisanoPoDanima[0].dan]));
      setPocetnoOtvoreno(true);
    }
  }, [grupisanoPoDanima, pocetnoOtvoreno]);

  const preklopiDan = (dan: string) => {
    setOtvoreniDani((prev) => {
      const sledeci = new Set(prev);
      if (sledeci.has(dan)) sledeci.delete(dan);
      else sledeci.add(dan);
      return sledeci;
    });
  };

  return (
    <div className="w-full md:w-[60%] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <Clock size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
              Pregled prisutnosti
            </h2>
            {!loading && !error && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Ukupno: {filtrirano.length} / {data.length}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="relative w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
          />
          <input
            type="text"
            placeholder="Pretraga po nazivu radnika..."
            value={pretraga}
            onChange={(e) => setPretraga(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {error && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && grupisanoPoDanima.length === 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20">
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Nema podataka za prikaz.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        grupisanoPoDanima.map(({ dan, grupe, ukupno }) => {
          const otvoren = otvoreniDani.has(dan);
          return (
          <div
            key={dan}
            className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => preklopiDan(dan)}
              className="w-full px-5 py-3 flex items-center justify-between transition-opacity hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              <span className="text-sm font-bold text-white">
                {formatirajDan(dan)}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-white/70">{ukupno} zapisa</span>
                <ChevronDown
                  size={16}
                  className={`text-white transition-transform duration-200 ${otvoren ? "rotate-180" : ""}`}
                />
              </span>
            </button>

            {otvoren && (
            <div className="p-4 space-y-4">
              {grupe.map(({ vrsta, zapisi }) => (
                <div key={vrsta}>
                  <div
                    className="px-1 pb-1.5 text-xs font-bold uppercase tracking-wider text-center"
                    style={{ color: ACCENT }}
                  >
                    {vrstaRadnikaLabel(vrsta)}{" "}
                    <span className="text-gray-400 dark:text-[#5f5878] font-normal normal-case">
                      ({zapisi.length})
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-[#2d2648]">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col className="w-[26%]" />
                        <col className="w-[12%]" />
                        <col className="w-[18%]" />
                        <col className="w-[44%]" />
                      </colgroup>
                      <thead>
                        <tr>
                          <TH>Naziv</TH>
                          <TH center>Smjena</TH>
                          <TH center>Vrijeme</TH>
                          <TH>Sati po vrsti rada</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {zapisi.map((z) => (
                          <tr
                            key={z.sifra_tabele}
                            className="hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
                          >
                            <TD>
                              {z.naziv_radnika} ({z.sifra_radnika})
                            </TD>
                            <TD center>{z.smjena ?? "–"}</TD>
                            <TD center>
                              {izvuciVrijeme(z.datum_pocetka) ?? "–"}
                              {z.datum_kraja
                                ? `–${izvuciVrijeme(z.datum_kraja)}`
                                : ""}
                            </TD>
                            <TD>{opisSati(z)}</TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
          );
        })}
    </div>
  );
}
