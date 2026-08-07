import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CreditCard,
  Landmark,
  Loader2,
  RefreshCcw,
  Tags,
  TrendingUp,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.sp_mjesecni_prihodi(datumOd, datumDo).
interface PrihodRed {
  kategorija: string;
  nacin_placanja: string;
  storno: number;
  ukupno: number;
  pdv: number;
  rabat: number;
  veleprodajna_vrednost: number;
}

interface GrupaPlacanja {
  naziv: string;
  stavke: PrihodRed[];
  ukupno: number;
  storno: number;
  pdv: number;
  rabat: number;
  veleprodajnaVrednost: number;
}

interface CelijaVrijednosti {
  ukupno: number;
  pdv: number;
  rabat: number;
  vpc: number;
}

const praznaCelija: CelijaVrijednosti = { ukupno: 0, pdv: 0, rabat: 0, vpc: 0 };

const formatIznos = (v: number | null | undefined) =>
  `${Number(v ?? 0).toFixed(2)} KM`;

const jeStorno = (v: number) => Number(v) === 1;

const jeProizvod = (kategorija: string) =>
  kategorija.toLowerCase().includes("proizv");
const jeRoba = (kategorija: string) => kategorija.toLowerCase().includes("rob");

// Nalazi red za konkretnu kombinaciju kategorije i storno flaga unutar grupe
// (svaka kombinacija je jedinstvena — sp_mjesecni_prihodi grupiše po njoj).
const pronadjiCeliju = (
  stavke: PrihodRed[],
  test: (kategorija: string) => boolean,
  storno: boolean,
): CelijaVrijednosti => {
  const red = stavke.find(
    (r) => test(r.kategorija) && jeStorno(r.storno) === storno,
  );
  if (!red) return praznaCelija;
  return {
    ukupno: Number(red.ukupno || 0),
    pdv: Number(red.pdv || 0),
    rabat: Number(red.rabat || 0),
    vpc: Number(red.veleprodajna_vrednost || 0),
  };
};

const prviDanMjeseca = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const danas = () => new Date().toISOString().slice(0, 10);

// Vizuelni identitet grupe po nazivu načina plaćanja — vrijednosti dolaze iz
// baze pa se prepoznaju po ključnoj riječi, ne po tačnom stringu.
const izgledGrupe = (naziv: string) => {
  const n = naziv.toLowerCase();
  if (n.includes("gotov")) return { icon: <Banknote size={16} />, boja: PRIMARY };
  if (n.includes("žiral") || n.includes("ziral") || n.includes("virman"))
    return { icon: <Landmark size={16} />, boja: ACCENT };
  return { icon: <CreditCard size={16} />, boja: "#6b7280" };
};

const prioritetGrupe = (naziv: string) => {
  const n = naziv.toLowerCase();
  if (n.includes("gotov")) return 0;
  if (n.includes("žiral") || n.includes("ziral") || n.includes("virman"))
    return 1;
  return 2;
};

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
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3 flex-1 min-w-[170px]">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-gray-800 dark:text-[#ede9f6]">
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

const podnaslovClass =
  "text-right px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]";
const razdvajac = "border-r-2 border-gray-200 dark:border-[#3a3158]";

function PodnasloviCelije({ separator }: { separator?: boolean }) {
  return (
    <>
      <th className={podnaslovClass}>Ukupno</th>
      <th className={podnaslovClass}>PDV</th>
      <th className={podnaslovClass}>Rabat</th>
      <th className={`${podnaslovClass} ${separator ? razdvajac : ""}`}>VPC</th>
    </>
  );
}

function CelijeRed({
  v,
  boja,
  separator,
}: {
  v: CelijaVrijednosti;
  boja: string;
  separator?: boolean;
}) {
  return (
    <>
      <td className="px-3 py-2.5 text-right font-bold" style={{ color: boja }}>
        {formatIznos(v.ukupno)}
      </td>
      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-[#c5bfd8]">
        {formatIznos(v.pdv)}
      </td>
      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-[#c5bfd8]">
        {formatIznos(v.rabat)}
      </td>
      <td
        className={`px-3 py-2.5 text-right text-gray-600 dark:text-[#c5bfd8] ${separator ? razdvajac : ""}`}
      >
        {formatIznos(v.vpc)}
      </td>
    </>
  );
}

export function MjesecniPrihodi() {
  const [datumOd, setDatumOd] = useState(prviDanMjeseca());
  const [datumDo, setDatumDo] = useState(danas());
  const [redovi, setRedovi] = useState<PrihodRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = () => {
    if (!datumOd || !datumDo) return;
    setLoading(true);
    setGreska(null);
    fetch(
      `${API_URL}/api/mjesecni-prihodi?datumOd=${datumOd}&datumDo=${datumDo}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju mjesečnih prihoda");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  const ukupnoPrihod = useMemo(
    () =>
      redovi
        .filter((r) => !jeStorno(r.storno))
        .reduce((s, r) => s + Number(r.ukupno || 0), 0),
    [redovi],
  );
  const ukupnoStorno = useMemo(
    () =>
      redovi
        .filter((r) => jeStorno(r.storno))
        .reduce((s, r) => s + Number(r.ukupno || 0), 0),
    [redovi],
  );
  const ukupnoPdv = useMemo(
    () => redovi.reduce((s, r) => s + Number(r.pdv || 0), 0),
    [redovi],
  );
  const ukupnoRabat = useMemo(
    () => redovi.reduce((s, r) => s + Number(r.rabat || 0), 0),
    [redovi],
  );

  const grupe = useMemo((): GrupaPlacanja[] => {
    const map = new Map<string, GrupaPlacanja>();
    for (const r of redovi) {
      const kljuc = r.nacin_placanja || "Ostalo";
      let g = map.get(kljuc);
      if (!g) {
        g = {
          naziv: kljuc,
          stavke: [],
          ukupno: 0,
          storno: 0,
          pdv: 0,
          rabat: 0,
          veleprodajnaVrednost: 0,
        };
        map.set(kljuc, g);
      }
      g.stavke.push(r);
      g.pdv += Number(r.pdv || 0);
      g.rabat += Number(r.rabat || 0);
      g.veleprodajnaVrednost += Number(r.veleprodajna_vrednost || 0);
      if (jeStorno(r.storno)) g.storno += Number(r.ukupno || 0);
      else g.ukupno += Number(r.ukupno || 0);
    }
    return [...map.values()].sort(
      (a, b) =>
        prioritetGrupe(a.naziv) - prioritetGrupe(b.naziv) ||
        a.naziv.localeCompare(b.naziv, "bs"),
    );
  }, [redovi]);

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <TrendingUp size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Mjesečni prihodi
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Prihodi po načinu plaćanja i kategoriji za izabrani period
          </p>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum od
            </span>
            <input
              type="date"
              value={datumOd}
              onChange={(e) => setDatumOd(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum do
            </span>
            <input
              type="date"
              value={datumDo}
              onChange={(e) => setDatumDo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            />
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

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<TrendingUp size={16} />}
            vrijednost={formatIznos(ukupnoPrihod)}
            naziv="Ukupno prihoda"
            boja={ACCENT}
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={formatIznos(ukupnoPdv)}
            naziv="PDV ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<CreditCard size={16} />}
            vrijednost={formatIznos(ukupnoRabat)}
            naziv="Rabat ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Calendar size={16} />}
            vrijednost={formatIznos(ukupnoStorno)}
            naziv="Stornirano"
            boja={ukupnoStorno > 0 ? "#f59e0b" : "#9ca3af"}
          />
        </div>
      )}

      {/* Grupe po načinu plaćanja */}
      {loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
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

      {!loading && !greska && grupe.length === 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
          <TrendingUp size={28} />
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Nema podataka za izabrani period.
          </p>
        </div>
      )}

      {!loading && !greska && grupe.length > 0 && (
        <div className="space-y-4">
          {grupe.map((g) => {
            const { icon, boja } = izgledGrupe(g.naziv);
            return (
              <div
                key={g.naziv}
                className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden"
              >
                {/* Header grupe */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ background: `${boja}14` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${boja}26` }}
                  >
                    <div style={{ color: boja }}>{icon}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-gray-800 dark:text-[#ede9f6]">
                      {g.naziv}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                      {g.stavke.length}{" "}
                      {g.stavke.length === 1 ? "stavka" : "stavki"}
                      {g.storno > 0
                        ? ` · stornirano ${formatIznos(g.storno)}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold" style={{ color: boja }}>
                      {formatIznos(g.ukupno)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                      Ukupno
                    </div>
                  </div>
                </div>

                {/* Tabela grupe — Proizvod/Roba, prvo redovni podaci pa storno u nastavku reda */}
                {(() => {
                  const proizvodNormal = pronadjiCeliju(
                    g.stavke,
                    jeProizvod,
                    false,
                  );
                  const robaNormal = pronadjiCeliju(g.stavke, jeRoba, false);
                  const proizvodStorno = pronadjiCeliju(
                    g.stavke,
                    jeProizvod,
                    true,
                  );
                  const robaStorno = pronadjiCeliju(g.stavke, jeRoba, true);
                  const STORNO_BOJA = "#f59e0b";
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#faf9fc] dark:bg-[#1e1a2d]">
                            <th
                              colSpan={4}
                              className={`text-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${razdvajac}`}
                              style={{ color: boja }}
                            >
                              Proizvod
                            </th>
                            <th
                              colSpan={4}
                              className={`text-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${razdvajac}`}
                              style={{ color: STORNO_BOJA }}
                            >
                              Proizvod — storno
                            </th>
                            <th
                              colSpan={4}
                              className={`text-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${razdvajac}`}
                              style={{ color: boja }}
                            >
                              Roba
                            </th>
                            <th
                              colSpan={4}
                              className="text-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                              style={{ color: STORNO_BOJA }}
                            >
                              Roba — storno
                            </th>
                          </tr>
                          <tr className="border-t border-gray-100 dark:border-[#2d2648]">
                            <PodnasloviCelije separator />
                            <PodnasloviCelije separator />
                            <PodnasloviCelije separator />
                            <PodnasloviCelije />
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-50 dark:border-[#2d2648]">
                            <CelijeRed v={proizvodNormal} boja={boja} separator />
                            <CelijeRed
                              v={proizvodStorno}
                              boja={STORNO_BOJA}
                              separator
                            />
                            <CelijeRed v={robaNormal} boja={boja} separator />
                            <CelijeRed v={robaStorno} boja={STORNO_BOJA} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
