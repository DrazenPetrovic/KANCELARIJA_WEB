import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface RadnikAktivni {
  sifra_radnika: number | null;
  naziv_radnika: string;
  vrsta_radnika: number;
  aktivan: number;
}

// Vidi docs/radnici_vrste_radnika.txt — isti šifarnik kao u RadniciPregled.tsx/RadniciUnos.tsx.
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

// Kolone tabele prisutnosti (erp.radnici_prisutnost_unos) koje predstavljaju
// tačno jednu vrstu rada — operater bira jednu, ostale idu kao 0.
const VRSTA_RADA_OPTIONS = [
  { key: "redovan_rad", label: "Redovan rad" },
  { key: "prekovremeni_rad", label: "Prekovremeni rad" },
  { key: "rad_nocu", label: "Rad noću" },
  { key: "rad_praznikom", label: "Rad praznikom" },
  { key: "terenski_rad", label: "Terenski rad" },
  { key: "dezurstvo", label: "Dežurstvo" },
  { key: "godisnji_odmor", label: "Godišnji odmor" },
  { key: "praznik_odmor", label: "Praznik (neradni dan)" },
  { key: "privremena_nesposobnost", label: "Bolovanje (privremena nesposobnost)" },
  { key: "porodiljsko", label: "Porodiljsko odsustvo" },
  { key: "placeno_odsustvo", label: "Plaćeno odsustvo" },
  { key: "neplaceno_odsustvo", label: "Neplaćeno odsustvo" },
  { key: "odsustvo_bez_krivice", label: "Odsustvo bez krivice radnika" },
  { key: "ostala_odsustva", label: "Ostala odsustva" },
  { key: "sedmicni_odmor", label: "Sedmični odmor" },
] as const;

// Definicije smjena — kad operater izabere smjenu, datum/vrijeme početka i
// kraja se automatski popunjavaju na osnovu današnjeg datuma (i dalje se
// mogu ručno izmijeniti nakon toga).
const SMJENA_DEFINICIJE: Record<
  string,
  { pocetakSat: number; pocetakMin: number; krajSat: number; krajMin: number }
> = {
  "0": { pocetakSat: 6, pocetakMin: 30, krajSat: 14, krajMin: 30 },
  "1": { pocetakSat: 8, pocetakMin: 0, krajSat: 16, krajMin: 0 },
  "2": { pocetakSat: 14, pocetakMin: 0, krajSat: 22, krajMin: 0 },
  "3": { pocetakSat: 22, pocetakMin: 0, krajSat: 6, krajMin: 0 },
};

const SMJENA_OPTIONS = [
  { value: "", label: "Nije definisano" },
  { value: "0", label: "0 — 06:30–14:30" },
  { value: "1", label: "1 — 08:00–16:00" },
  { value: "2", label: "2 — 14:00–22:00" },
  { value: "3", label: "3 — 22:00–06:00 (noćna)" },
];

// Datum (dd.MM.yyyy) i vrijeme (HH:mm:ss, striktno 24h) su odvojena polja —
// ne oslanjaju se na lokalizovani prikaz input[type=datetime-local], koji
// varira po browseru/OS-u.
const DATUM_DIO_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const VRIJEME_DIO_REGEX = /^(\d{2}):(\d{2}):(\d{2})$/;
const DATUM_PLACEHOLDER = "dd.MM.yyyy";
const VRIJEME_PLACEHOLDER = "HH:mm:ss";

const pad = (n: number) => String(n).padStart(2, "0");

const formatirajDatumZaUnos = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

const formatirajVrijemeZaUnos = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Računa početak/kraj smjene za današnji datum. Ako kraj ispadne prije ili
// jednak početku (npr. noćna smjena 22:00–06:00), kraj se pomjera na sljedeći dan.
const izracunajVremenaZaSmjenu = (
  kod: string,
): {
  pocetakDatum: string;
  pocetakVrijeme: string;
  krajDatum: string;
  krajVrijeme: string;
} | null => {
  const def = SMJENA_DEFINICIJE[kod];
  if (!def) return null;
  const danas = new Date();
  const pocetak = new Date(
    danas.getFullYear(),
    danas.getMonth(),
    danas.getDate(),
    def.pocetakSat,
    def.pocetakMin,
    0,
  );
  const kraj = new Date(pocetak);
  kraj.setHours(def.krajSat, def.krajMin, 0, 0);
  if (kraj <= pocetak) {
    kraj.setDate(kraj.getDate() + 1);
  }
  return {
    pocetakDatum: formatirajDatumZaUnos(pocetak),
    pocetakVrijeme: formatirajVrijemeZaUnos(pocetak),
    krajDatum: formatirajDatumZaUnos(kraj),
    krajVrijeme: formatirajVrijemeZaUnos(kraj),
  };
};

// Vraća "yyyy-MM-dd HH:mm:ss" (MySQL DATETIME) ili null ako unos nije validan
// (pogrešan format, mjesec/sat/minut/sekunda van opsega, ili nepostojeći
// datum poput 31.02.).
const parsirajDatumVrijeme = (datum: string, vrijeme: string): string | null => {
  const md = DATUM_DIO_REGEX.exec(datum.trim());
  const mv = VRIJEME_DIO_REGEX.exec(vrijeme.trim());
  if (!md || !mv) return null;
  const [, dd, MM, yyyy] = md;
  const [, HH, mm, ss] = mv;
  const dan = Number(dd);
  const mjesec = Number(MM);
  const godina = Number(yyyy);
  const sat = Number(HH);
  const minut = Number(mm);
  const sekunda = Number(ss);
  if (mjesec < 1 || mjesec > 12 || sat > 23 || minut > 59 || sekunda > 59) {
    return null;
  }
  const datumObj = new Date(godina, mjesec - 1, dan, sat, minut, sekunda);
  if (
    datumObj.getFullYear() !== godina ||
    datumObj.getMonth() !== mjesec - 1 ||
    datumObj.getDate() !== dan
  ) {
    return null;
  }
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
};

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export function RadniciPrisutnostUnos() {
  const [radnici, setRadnici] = useState<RadnikAktivni[]>([]);
  const [loadingRadnici, setLoadingRadnici] = useState(true);
  const [pretragaRadnika, setPretragaRadnika] = useState("");
  const [odabraniRadnici, setOdabraniRadnici] = useState<Set<number>>(
    new Set(),
  );

  const [datumPocetkaDan, setDatumPocetkaDan] = useState("");
  const [datumPocetkaVrijeme, setDatumPocetkaVrijeme] = useState("");
  const [datumKrajaDan, setDatumKrajaDan] = useState("");
  const [datumKrajaVrijeme, setDatumKrajaVrijeme] = useState("");
  const [smjena, setSmjena] = useState("");
  const [vrstaRada, setVrstaRada] = useState<string>("redovan_rad");

  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [cuvanje, setCuvanje] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/radnici/pregled-sve`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setRadnici(json.data ?? []))
      .catch(() => setRadnici([]))
      .finally(() => setLoadingRadnici(false));
  }, []);

  const aktivniRadnici = useMemo(
    () =>
      radnici
        .filter((r) => r.aktivan === 1 && r.sifra_radnika != null)
        .sort((a, b) => {
          if (a.vrsta_radnika !== b.vrsta_radnika) {
            return a.vrsta_radnika - b.vrsta_radnika;
          }
          return a.naziv_radnika.localeCompare(b.naziv_radnika, "sr-Latn");
        }),
    [radnici],
  );

  const filtriraniRadnici = useMemo(() => {
    const q = pretragaRadnika.trim().toLowerCase();
    if (!q) return aktivniRadnici;
    return aktivniRadnici.filter((r) =>
      r.naziv_radnika?.toLowerCase().includes(q),
    );
  }, [aktivniRadnici, pretragaRadnika]);

  const preklopiRadnika = (sifra: number) => {
    setOdabraniRadnici((prev) => {
      const sledeci = new Set(prev);
      if (sledeci.has(sifra)) sledeci.delete(sifra);
      else sledeci.add(sifra);
      return sledeci;
    });
  };

  const oznaciSveVidljive = () => {
    setOdabraniRadnici((prev) => {
      const sledeci = new Set(prev);
      filtriraniRadnici.forEach((r) => {
        if (r.sifra_radnika != null) sledeci.add(r.sifra_radnika);
      });
      return sledeci;
    });
  };

  const poništiSve = () => setOdabraniRadnici(new Set());

  const handleSmjenaChange = (v: string) => {
    setSmjena(v);
    const vremena = izracunajVremenaZaSmjenu(v);
    if (vremena) {
      setDatumPocetkaDan(vremena.pocetakDatum);
      setDatumPocetkaVrijeme(vremena.pocetakVrijeme);
      setDatumKrajaDan(vremena.krajDatum);
      setDatumKrajaVrijeme(vremena.krajVrijeme);
    }
  };

  // Grupisano po vrsta_radnika (radno mjesto) — filtriraniRadnici je već
  // sortiran po vrsta_radnika pa je grupisanje samo spajanje uzastopnih.
  const grupisaniRadnici = useMemo(() => {
    const grupe: { vrsta: number; radnici: RadnikAktivni[] }[] = [];
    filtriraniRadnici.forEach((r) => {
      const poslednja = grupe[grupe.length - 1];
      if (poslednja && poslednja.vrsta === r.vrsta_radnika) {
        poslednja.radnici.push(r);
      } else {
        grupe.push({ vrsta: r.vrsta_radnika, radnici: [r] });
      }
    });
    return grupe;
  }, [filtriraniRadnici]);

  const handleSacuvaj = async () => {
    setGreska(null);

    if (odabraniRadnici.size === 0) {
      setGreska("Izaberite bar jednog radnika");
      return;
    }

    const datumPocetkaSql = parsirajDatumVrijeme(
      datumPocetkaDan,
      datumPocetkaVrijeme,
    );
    if (!datumPocetkaSql) {
      setGreska(
        `Datum i vrijeme početka moraju biti u formatu ${DATUM_PLACEHOLDER} ${VRIJEME_PLACEHOLDER}`,
      );
      return;
    }

    let datumKrajaSql: string | null = null;
    if (datumKrajaDan.trim() || datumKrajaVrijeme.trim()) {
      datumKrajaSql = parsirajDatumVrijeme(datumKrajaDan, datumKrajaVrijeme);
      if (!datumKrajaSql) {
        setGreska(
          `Datum i vrijeme kraja moraju biti u formatu ${DATUM_PLACEHOLDER} ${VRIJEME_PLACEHOLDER}`,
        );
        return;
      }
    }

    const zastavice = Object.fromEntries(
      VRSTA_RADA_OPTIONS.map((o) => [o.key, o.key === vrstaRada ? 1 : 0]),
    );

    const zapisi = Array.from(odabraniRadnici).map((sifraRadnika) => ({
      sifra_radnika: sifraRadnika,
      datum_pocetka: datumPocetkaSql,
      datum_kraja: datumKrajaSql,
      smjena: smjena === "" ? null : Number(smjena),
      ...zastavice,
    }));

    setCuvanje(true);
    try {
      const res = await fetch(`${API_URL}/api/radnici/prisutnost/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(zapisi),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu prisutnosti");
      }
      setUspjeh(`Prisutnost sačuvana (${zapisi.length} zapisa).`);
      setOdabraniRadnici(new Set());
      setDatumPocetkaDan("");
      setDatumPocetkaVrijeme("");
      setDatumKrajaDan("");
      setDatumKrajaVrijeme("");
      setSmjena("");
      setVrstaRada("redovan_rad");
    } catch (err) {
      setGreska(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Clock size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Unos prisutnosti
        </h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* LIJEVO: izbor radnika — što više odjednom vidljivo */}
        <div className="min-w-0 w-full flex-1 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Radnici ({odabraniRadnici.size} izabrano od {aktivniRadnici.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={oznaciSveVidljive}
                className="text-xs font-semibold hover:underline"
                style={{ color: PRIMARY }}
              >
                Označi prikazane
              </button>
              <button
                type="button"
                onClick={poništiSve}
                className="text-xs font-semibold text-gray-500 dark:text-[#a99fc2] hover:underline"
              >
                Poništi sve
              </button>
            </div>
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraga radnika..."
              value={pretragaRadnika}
              onChange={(e) => setPretragaRadnika(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-gray-100 dark:border-[#2d2648] p-2">
            {loadingRadnici && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: PRIMARY }} />
                <span className="text-sm text-gray-500 dark:text-[#7d7498]">
                  Učitavanje radnika...
                </span>
              </div>
            )}

            {!loadingRadnici && filtriraniRadnici.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
                Nema aktivnih radnika za prikaz.
              </div>
            )}

            {!loadingRadnici && filtriraniRadnici.length > 0 && (
              <div className="space-y-3">
                {grupisaniRadnici.map((grupa) => (
                  <div key={grupa.vrsta}>
                    <div
                      className="px-1 pb-1.5 text-xs font-bold uppercase tracking-wider"
                      style={{ color: PRIMARY }}
                    >
                      {VRSTA_RADNIKA_LABELS[grupa.vrsta] ??
                        `Vrsta ${grupa.vrsta}`}{" "}
                      <span className="text-gray-400 dark:text-[#5f5878] font-normal normal-case">
                        ({grupa.radnici.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-y-1">
                      {grupa.radnici.map((r) => {
                        const sifra = r.sifra_radnika as number;
                        const izabran = odabraniRadnici.has(sifra);
                        return (
                          <label
                            key={sifra}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors border ${
                              izabran
                                ? "border-[#785E9E] bg-purple-50/60 dark:bg-[#271f40]/60"
                                : "border-transparent hover:bg-gray-50 dark:hover:bg-[#1e1a2d]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={izabran}
                              onChange={() => preklopiRadnika(sifra)}
                              className="w-4 h-4 shrink-0 accent-[#785E9E]"
                            />
                            <span className="max-w-[30ch] truncate text-gray-700 dark:text-[#c5bfd8] border border-gray-200 dark:border-[#3a3158] rounded px-1.5 py-0.5">
                              {r.naziv_radnika}
                            </span>
                            {izabran && (
                              <span
                                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white truncate max-w-[130px]"
                                style={{ background: ACCENT }}
                                title={`${datumPocetkaDan} ${datumPocetkaVrijeme}${
                                  datumKrajaDan
                                    ? ` – ${datumKrajaDan} ${datumKrajaVrijeme}`
                                    : ""
                                }`}
                              >
                                <CheckCircle2 size={10} className="shrink-0" />
                                {datumPocetkaVrijeme
                                  ? `${datumPocetkaVrijeme.slice(0, 5)}${
                                      datumKrajaVrijeme
                                        ? `–${datumKrajaVrijeme.slice(0, 5)}`
                                        : ""
                                    }`
                                  : "–"}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DESNO: vrijeme i vrsta rada, zajednički za sve izabrane */}
        <div className="w-full xl:w-80 shrink-0 xl:sticky xl:top-4 space-y-4">
          <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3">
            <Field label="Smjena">
              <select
                value={smjena}
                onChange={(e) => handleSmjenaChange(e.target.value)}
                className={inputClass}
              >
                {SMJENA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-[#5f5878]">
                Izborom smjene se automatski popunjava vrijeme početka/kraja — i dalje se može ručno izmijeniti.
              </p>
            </Field>

            <Field label="Datum i vrijeme početka *">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={datumPocetkaDan}
                  onChange={(e) => setDatumPocetkaDan(e.target.value)}
                  placeholder={DATUM_PLACEHOLDER}
                  className={`${inputClass} font-mono`}
                />
                <input
                  type="text"
                  value={datumPocetkaVrijeme}
                  onChange={(e) => setDatumPocetkaVrijeme(e.target.value)}
                  placeholder={VRIJEME_PLACEHOLDER}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const sada = new Date();
                  setDatumPocetkaDan(formatirajDatumZaUnos(sada));
                  setDatumPocetkaVrijeme(formatirajVrijemeZaUnos(sada));
                }}
                className="mt-1 text-xs font-semibold hover:underline"
                style={{ color: PRIMARY }}
              >
                Sada
              </button>
            </Field>

            <Field label="Datum i vrijeme kraja">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={datumKrajaDan}
                  onChange={(e) => setDatumKrajaDan(e.target.value)}
                  placeholder={DATUM_PLACEHOLDER}
                  className={`${inputClass} font-mono`}
                />
                <input
                  type="text"
                  value={datumKrajaVrijeme}
                  onChange={(e) => setDatumKrajaVrijeme(e.target.value)}
                  placeholder={VRIJEME_PLACEHOLDER}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const sada = new Date();
                  setDatumKrajaDan(formatirajDatumZaUnos(sada));
                  setDatumKrajaVrijeme(formatirajVrijemeZaUnos(sada));
                }}
                className="mt-1 text-xs font-semibold hover:underline"
                style={{ color: PRIMARY }}
              >
                Sada
              </button>
            </Field>

            <Field label="Vrsta rada *">
              <select
                value={vrstaRada}
                onChange={(e) => setVrstaRada(e.target.value)}
                className={inputClass}
              >
                {VRSTA_RADA_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            onClick={() => void handleSacuvaj()}
            disabled={cuvanje}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {cuvanje ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Clock size={15} />
            )}
            Sačuvaj prisutnost
          </button>
        </div>
      </div>

      {uspjeh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={40} style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {uspjeh}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setUspjeh(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {greska && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-red-300 p-6">
            <div className="flex justify-center mb-3">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <p className="text-base font-semibold text-red-700 dark:text-red-400 text-center">
              {greska}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setGreska(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
