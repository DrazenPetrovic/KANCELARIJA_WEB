import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RefreshCcw } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.poslovanje_mjesecni_pregled() — tekuća + dvije prethodne
// godine, najviše 36 redova.
interface MjesecniRed {
  godina: number;
  mjesec: number;
  ukupno: number | string;
}

const NAZIVI_MJESECI = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

const formatIznos = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "–"
    : Number(v)
        .toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        .replace(/,/g, " ");

// Razlika u % tekuće godine prema prethodnoj; null kad nema s čim porediti.
const razlikaPosto = (
  sada: number | undefined,
  prije: number | undefined,
): number | null => {
  if (sada === undefined || prije === undefined || prije === 0) return null;
  return ((sada - prije) / Math.abs(prije)) * 100;
};

function Razlika({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-400">–</span>;
  return (
    <span className={v >= 0 ? "text-green-600" : "text-red-500"}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}

const TH = ({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
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
    className={`px-4 py-2 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

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

export function PoslovanjeMjesecno() {
  const [redovi, setRedovi] = useState<MjesecniRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/poslovanje/mjesecni`, { credentials: "include" })
      .then((res) => {
        if (!res.ok)
          throw new Error("Greška pri učitavanju mjesečnog pregleda");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  // Godine od najnovije ka starijoj; mapa "godina-mjesec" -> ukupno.
  const { godine, iznosi } = useMemo(() => {
    const iznosi = new Map<string, number>();
    const skup = new Set<number>();
    for (const r of redovi) {
      const g = Number(r.godina);
      skup.add(g);
      iznosi.set(`${g}-${Number(r.mjesec)}`, Number(r.ukupno || 0));
    }
    return { godine: [...skup].sort((a, b) => b - a), iznosi };
  }, [redovi]);

  const iznos = (g: number, m: number) => iznosi.get(`${g}-${m}`);

  const tekuca = godine[0];
  const prethodna = godine[1];
  const pretprethodna = godine[2];

  const zbirGodine = (g: number) => {
    let s = 0;
    for (let m = 1; m <= 12; m++) s += iznos(g, m) ?? 0;
    return s;
  };

  // Poređenje tekuće godine sa starijom samo za mjesece koje tekuća godina
  // već ima — inače bi nepotpuna tekuća godina uvijek djelovala kao pad.
  const istiPeriod = (starija: number | undefined) => {
    if (tekuca === undefined || starija === undefined) return null;
    let sada = 0;
    let prije = 0;
    for (let m = 1; m <= 12; m++) {
      const s = iznos(tekuca, m);
      if (s === undefined) continue;
      sada += s;
      prije += iznos(starija, m) ?? 0;
    }
    return razlikaPosto(sada, prije);
  };

  // Kolone poređenja: tekuća / tekuća-1 i tekuća / tekuća-2 (ako postoje).
  const poredjenja = [prethodna, pretprethodna].filter(
    (g): g is number => g !== undefined,
  );

  return (
    <div className="space-y-4">
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
        // ekranu, rekapitulacija apsolutno gore lijevo (xl+).
        <div className="relative flex flex-col gap-4 xl:block">
          <div>
            <div className="w-fit max-w-full xl:max-w-[calc(100%-36rem)] mx-auto bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-x-auto">
              <table className="table-auto text-base">
                <thead>
                  <tr>
                    <TH>Mjesec</TH>
                    {godine.map((g) => (
                      <TH key={g} right>
                        {g}
                      </TH>
                    ))}
                    {poredjenja.map((g) => (
                      <TH key={g} right>
                        {tekuca} / {g}
                      </TH>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {godine.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                      >
                        Nema podataka.
                      </td>
                    </tr>
                  ) : (
                    NAZIVI_MJESECI.map((naziv, i) => {
                      const m = i + 1;
                      return (
                        <tr
                          key={m}
                          className="border-b border-gray-200 dark:border-[#3a3158]"
                        >
                          <TD bold>{naziv}</TD>
                          {godine.map((g, gi) => (
                            <TD key={g} right bold={gi === 0}>
                              {formatIznos(iznos(g, m))}
                            </TD>
                          ))}
                          {poredjenja.map((g) => (
                            <TD key={g} right>
                              <Razlika
                                v={razlikaPosto(iznos(tekuca, m), iznos(g, m))}
                              />
                            </TD>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {godine.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d] [&>td]:py-3">
                      <TD bold>Ukupno</TD>
                      {godine.map((g) => (
                        <TD key={g} right bold>
                          {formatIznos(zbirGodine(g))}
                        </TD>
                      ))}
                      {poredjenja.map((g) => (
                        <TD key={g} right bold>
                          <Razlika v={istiPeriod(g)} />
                        </TD>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Rekapitulacija — ukupno po godini, gore lijevo (xl+) */}
          <div className="flex flex-col gap-3 w-full xl:w-64 flex-shrink-0 mt-4 xl:mt-[5%] xl:absolute xl:top-0 xl:left-[3%] origin-top-left xl:scale-90">
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: PRIMARY }}
              >
                Rekapitulacija
              </div>
              <button
                type="button"
                onClick={ucitaj}
                title="Osvježi"
                className="rounded-xl px-2.5 py-2 text-white hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                <RefreshCcw size={14} />
              </button>
            </div>
            {godine.map((g, gi) => (
              <StatTile
                key={g}
                icon={<CalendarDays size={16} />}
                vrijednost={formatIznos(zbirGodine(g))}
                naziv={`Ukupno ${g}.`}
                boja={gi === 0 ? ACCENT : PRIMARY}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
