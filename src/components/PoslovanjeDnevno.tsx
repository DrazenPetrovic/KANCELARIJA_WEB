import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Landmark,
  Loader2,
  Percent,
  Receipt,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Isti izgled kao StatTile u KarticaProizvoda.tsx.
function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl shadow-sm px-4 py-3 flex-1 min-w-[150px] min-h-[60px] bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648]">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight whitespace-nowrap text-gray-800 dark:text-[#ede9f6]">
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

// Red vraćen sa erp.poslovanje_pregled(datumOd, datumDo).
interface PoslovanjeRed {
  sifra_partnera: number;
  naziv_partnera: string;
  broj_racuna: number | string;
  vrsta_racuna_novi: number | string;
  vrsta_racuna_pod: number;
  datum_racuna: string;
  vrednost: number;
  rabat_km: number;
  osnova_za_obracun_pdv: number;
  PDV: number;
  ukupno: number;
}

// Isti izvor/oblik kao "Podgrupa računa" u racuniPregled.tsx (GET /api/racuni/podgrupe).
interface RacunPodgrupa {
  sifra_podgrupe: number;
  opis_podgrupe: string;
}

// Isti format kao vrsta_racuna_novo u ziralni.q_racun_gl (kolona "Broj računa"
// u Pregledu računa). Za vrstu 0 view koristi vrsta_racuna koju procedura ne
// vraća, pa ostaje goli broj.
const PREFIKS_VRSTE: Record<string, string> = {
  "1": "MP",
  "2": "VP",
  "3": "STORNO",
  "4": "STORNO",
  "5": "USL",
  "6": "KOUSL",
};
const brojRacunaPrikaz = (r: PoslovanjeRed) => {
  const prefiks = PREFIKS_VRSTE[String(r.vrsta_racuna_novi)];
  return prefiks
    ? `${prefiks}-${r.vrsta_racuna_pod}-${r.broj_racuna}`
    : String(r.broj_racuna);
};

const formatIznos = (v: number | null | undefined) =>
  Number(v ?? 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/,/g, " ");

// Lokalni datum kao yyyy-MM-dd (bez toISOString, da se ne pomjeri dan).
const formatDatumISO = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const danas = () => formatDatumISO(new Date());

const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const TH = ({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
}) => (
  <td
    className={`px-2 py-1 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

function DatumPolje({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const otvoriPicker = () => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
        {label}
      </span>
      <div className="relative cursor-pointer" onClick={otvoriPicker}>
        <input
          ref={ref}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ color: "transparent" }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
        />
        <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
          {formatDatumDMY(value) ?? "Izaberite datum"}
        </div>
      </div>
    </div>
  );
}

export function PoslovanjeDnevno() {
  const [datumOd, setDatumOd] = useState(danas());
  const [datumDo, setDatumDo] = useState(danas());
  const [redovi, setRedovi] = useState<PoslovanjeRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [podgrupe, setPodgrupe] = useState<RacunPodgrupa[]>([]);
  const [podgrupaFilter, setPodgrupaFilter] = useState("");

  const ucitaj = () => {
    if (!datumOd || !datumDo) return;
    setLoading(true);
    setGreska(null);
    fetch(
      `${API_URL}/api/poslovanje/pregled?datumOd=${datumOd}&datumDo=${datumDo}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju poslovanja");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  useEffect(() => {
    fetch(`${API_URL}/api/racuni/podgrupe`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setPodgrupe(json?.data ?? []))
      .catch(() => {});
  }, []);

  // U filteru samo podgrupe koje postoje u učitanim računima.
  const podgrupeUPregledu = useMemo(() => {
    const prisutne = new Set(redovi.map((r) => Number(r.vrsta_racuna_pod)));
    const poznate = podgrupe.filter((p) =>
      prisutne.has(Number(p.sifra_podgrupe)),
    );
    const poznateSifre = new Set(poznate.map((p) => Number(p.sifra_podgrupe)));
    const nepoznate = [...prisutne]
      .filter((s) => !poznateSifre.has(s))
      .map((s) => ({ sifra_podgrupe: s, opis_podgrupe: "Podgrupa" }));
    return [...poznate, ...nepoznate].sort(
      (a, b) => Number(a.sifra_podgrupe) - Number(b.sifra_podgrupe),
    );
  }, [redovi, podgrupe]);

  // Ako nakon novog učitavanja izabrana podgrupa više ne postoji — vrati na sve.
  useEffect(() => {
    if (
      podgrupaFilter !== "" &&
      !podgrupeUPregledu.some(
        (p) => String(p.sifra_podgrupe) === podgrupaFilter,
      )
    ) {
      setPodgrupaFilter("");
    }
  }, [podgrupeUPregledu, podgrupaFilter]);

  const filtrirani = useMemo(
    () =>
      podgrupaFilter === ""
        ? redovi
        : redovi.filter((r) => String(r.vrsta_racuna_pod) === podgrupaFilter),
    [redovi, podgrupaFilter],
  );

  const zbir = useMemo(() => {
    const s = { vrednost: 0, rabat: 0, osnovica: 0, pdv: 0, ukupno: 0 };
    for (const r of filtrirani) {
      s.vrednost += Number(r.vrednost || 0);
      s.rabat += Number(r.rabat_km || 0);
      s.osnovica += Number(r.osnova_za_obracun_pdv || 0);
      s.pdv += Number(r.PDV || 0);
      s.ukupno += Number(r.ukupno || 0);
    }
    return s;
  }, [filtrirani]);

  return (
    <div className="space-y-4">
      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <DatumPolje label="Datum od" value={datumOd} onChange={setDatumOd} />
          <DatumPolje label="Datum do" value={datumDo} onChange={setDatumDo} />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Podgrupa računa
            </span>
            <select
              value={podgrupaFilter}
              onChange={(e) => setPodgrupaFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            >
              <option value="">Sve podgrupe</option>
              {podgrupeUPregledu.map((p) => (
                <option key={p.sifra_podgrupe} value={p.sifra_podgrupe}>
                  {p.opis_podgrupe} ({p.sifra_podgrupe})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={ucitaj}
            disabled={loading || !datumOd || !datumDo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2
            size={22}
            className="animate-spin"
            style={{ color: PRIMARY }}
          />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {greska && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          <button
            type="button"
            onClick={ucitaj}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {!loading && !greska && (
        // Isti raspored kao Kartica proizvoda: tabela centrirana prema cijelom
        // ekranu, rekapitulacija apsolutno gore lijevo (xl+); na užim
        // ekranima rekapitulacija pada ispod tabele.
        <div className="relative flex flex-col gap-4 xl:block">
          <div>
            <div className="w-fit max-w-full xl:max-w-[calc(100%-36rem)] mx-auto bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-x-auto">
              <table className="table-auto text-sm">
                <thead>
                  <tr>
                    <TH>Partner</TH>
                    <TH>Broj računa</TH>
                    <TH>Datum</TH>
                    <TH right>Vrijednost</TH>
                    <TH right>Rabat</TH>
                    <TH right>Osnovica</TH>
                    <TH right>PDV</TH>
                    <TH right>Ukupno</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtrirani.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                      >
                        Nema podataka za izabrani period.
                      </td>
                    </tr>
                  ) : (
                    filtrirani.map((r, i) => (
                      <tr
                        key={`${r.vrsta_racuna_novi}-${r.vrsta_racuna_pod}-${r.broj_racuna}-${i}`}
                        className="border-b border-gray-200 dark:border-[#3a3158]"
                      >
                        <TD>
                          {r.naziv_partnera}
                          <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                            {r.sifra_partnera}
                          </span>
                        </TD>
                        <TD bold>{brojRacunaPrikaz(r)}</TD>
                        <TD>{formatDatumDMY(r.datum_racuna) ?? "-"}</TD>
                        <TD right>{formatIznos(r.vrednost)}</TD>
                        <TD right>{formatIznos(r.rabat_km)}</TD>
                        <TD right>{formatIznos(r.osnova_za_obracun_pdv)}</TD>
                        <TD right>{formatIznos(r.PDV)}</TD>
                        <TD right bold>
                          {formatIznos(r.ukupno)}
                        </TD>
                      </tr>
                    ))
                  )}
                </tbody>
                {filtrirani.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d] [&>td]:py-2">
                      <TD bold>Ukupno ({filtrirani.length})</TD>
                      <TD> </TD>
                      <TD> </TD>
                      <TD right bold>
                        {formatIznos(zbir.vrednost)}
                      </TD>
                      <TD right bold>
                        {formatIznos(zbir.rabat)}
                      </TD>
                      <TD right bold>
                        {formatIznos(zbir.osnovica)}
                      </TD>
                      <TD right bold>
                        {formatIznos(zbir.pdv)}
                      </TD>
                      <TD right bold>
                        {formatIznos(zbir.ukupno)}
                      </TD>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Rekapitulacija — vertikalno, gore lijevo (xl+) */}
          <div className="flex flex-col gap-3 w-full xl:w-64 flex-shrink-0 mt-4 xl:mt-[5%] xl:absolute xl:top-0 xl:left-[3%] origin-top-left xl:scale-90">
            <div
              className="rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
              style={{ background: PRIMARY }}
            >
              Rekapitulacija
            </div>
            <StatTile
              icon={<Banknote size={16} />}
              vrijednost={formatIznos(zbir.vrednost)}
              naziv="Vrijednost"
              boja={PRIMARY}
            />
            <StatTile
              icon={<Percent size={16} />}
              vrijednost={formatIznos(zbir.rabat)}
              naziv="Rabat"
              boja="#ef4444"
            />
            <StatTile
              icon={<Receipt size={16} />}
              vrijednost={formatIznos(zbir.osnovica)}
              naziv="Osnovica"
              boja={PRIMARY}
            />
            <StatTile
              icon={<Landmark size={16} />}
              vrijednost={formatIznos(zbir.pdv)}
              naziv="PDV"
              boja={PRIMARY}
            />
            <StatTile
              icon={<TrendingUp size={16} />}
              vrijednost={formatIznos(zbir.ukupno)}
              naziv={`Ukupno (${filtrirani.length} računa)`}
              boja={ACCENT}
            />
          </div>
        </div>
      )}
    </div>
  );
}
