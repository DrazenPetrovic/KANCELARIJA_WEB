import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  Search,
  Tags,
  Users,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red iz erp.sp_partneri_dogovorene_cijene_pregled_potpun.
interface UgovorenaCijenaRed {
  sifra_tbl: number;
  partner_id: number;
  naziv_partnera: string | null;
  proizvod_id: number;
  naziv_proizvoda: string | null;
  jm: string | null;
  dogovorena_cijena_vpc: number | null;
  dogovorena_cijena_mpc: number | null;
  rabat_1_proc: number | null;
  sinhronizovano: number | null;
  vreme_izmjene: string | null;
}

interface Grupa {
  kljuc: number;
  naslov: string;
  podnaslov: string | null;
  stavke: UgovorenaCijenaRed[];
}

function formatCijena(v: number | null) {
  if (v === null || v === undefined) return "–";
  return `${Number(v).toFixed(2)} KM`;
}

function formatProcenat(v: number | null) {
  if (v === null || v === undefined) return "–";
  return `${Number(v).toFixed(2)}%`;
}

function formatVrijeme(v: string | null) {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}. ${hh}:${min}`;
}

export function UgovoreneCijenePregled() {
  const [redovi, setRedovi] = useState<UgovorenaCijenaRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const [pretraga, setPretraga] = useState("");
  // Podrazumijevano grupisano po partneru (partner -> lista proizvoda). Kad se
  // uključi, ista logika se samo okrene: proizvod -> lista partnera i cijena.
  const [grupisiPoProizvodu, setGrupisiPoProizvodu] = useState(false);
  const [prosireno, setProsireno] = useState<Set<number>>(new Set());

  useEffect(() => {
    const ucitaj = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/racuni/dogovorene-cijene-potpun`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Greška pri učitavanju ugovorenih cijena");
        const json = await res.json();
        setRedovi(json.data ?? []);
      } catch (err) {
        setGreska(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        setLoading(false);
      }
    };
    void ucitaj();
  }, []);

  // Prebacivanje prikaza resetuje koje je grupe operater ručno proširio.
  useEffect(() => {
    setProsireno(new Set());
  }, [grupisiPoProizvodu]);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return redovi;
    return redovi.filter(
      (r) =>
        (r.naziv_partnera ?? "").toLowerCase().includes(q) ||
        (r.naziv_proizvoda ?? "").toLowerCase().includes(q) ||
        String(r.partner_id).includes(q) ||
        String(r.proizvod_id).includes(q),
    );
  }, [redovi, pretraga]);

  const grupe = useMemo((): Grupa[] => {
    const map = new Map<number, Grupa>();
    for (const r of filtrirani) {
      const kljuc = grupisiPoProizvodu ? r.proizvod_id : r.partner_id;
      let g = map.get(kljuc);
      if (!g) {
        g = grupisiPoProizvodu
          ? {
              kljuc,
              naslov: r.naziv_proizvoda ?? `Proizvod #${r.proizvod_id}`,
              podnaslov: r.jm ? `JM: ${r.jm}` : null,
              stavke: [],
            }
          : {
              kljuc,
              naslov: r.naziv_partnera ?? `Partner #${r.partner_id}`,
              podnaslov: null,
              stavke: [],
            };
        map.set(kljuc, g);
      }
      g.stavke.push(r);
    }
    return [...map.values()].sort((a, b) =>
      a.naslov.localeCompare(b.naslov, "bs"),
    );
  }, [filtrirani, grupisiPoProizvodu]);

  const prekidacProsirenja = (kljuc: number) => {
    setProsireno((prev) => {
      const novi = new Set(prev);
      if (novi.has(kljuc)) novi.delete(kljuc);
      else novi.add(kljuc);
      return novi;
    });
  };

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Tags size={20} style={{ color: PRIMARY }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Ugovorene cijene
          </h2>
          {!loading && !greska && (
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              {grupe.length} {grupisiPoProizvodu ? "proizvoda" : "partnera"} ·{" "}
              {filtrirani.length} / {redovi.length} stavki
            </p>
          )}
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder={
                grupisiPoProizvodu
                  ? "Pretraga po proizvodu..."
                  : "Pretraga po partneru ili proizvodu..."
              }
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <div className="ml-auto flex items-center rounded-xl border border-gray-200 dark:border-[#3a3158] overflow-hidden">
            <button
              type="button"
              onClick={() => setGrupisiPoProizvodu(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors"
              style={
                !grupisiPoProizvodu
                  ? { background: PRIMARY, color: "white" }
                  : { color: "#785E9E" }
              }
            >
              <Users size={13} />
              Po partneru
            </button>
            <button
              type="button"
              onClick={() => setGrupisiPoProizvodu(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors border-l border-gray-200 dark:border-[#3a3158]"
              style={
                grupisiPoProizvodu
                  ? { background: PRIMARY, color: "white" }
                  : { color: "#785E9E" }
              }
            >
              <Package size={13} />
              Po proizvodu
            </button>
          </div>
        </div>
      </div>

      {/* Grupe */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">
              Učitavanje...
            </span>
          </div>
        )}

        {greska && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          </div>
        )}

        {!loading && !greska && grupe.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              Nema ugovorenih cijena za prikaz.
            </p>
          </div>
        )}

        {!loading &&
          !greska &&
          grupe.map((g) => {
            const otvoreno = prosireno.has(g.kljuc);
            return (
              <div
                key={g.kljuc}
                className="border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => prekidacProsirenja(g.kljuc)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
                >
                  {otvoreno ? (
                    <ChevronDown size={14} style={{ color: PRIMARY }} />
                  ) : (
                    <ChevronRight size={14} style={{ color: PRIMARY }} />
                  )}
                  {grupisiPoProizvodu ? (
                    <Package size={14} className="text-gray-400 dark:text-[#7d7498]" />
                  ) : (
                    <Users size={14} className="text-gray-400 dark:text-[#7d7498]" />
                  )}
                  <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                    {g.naslov}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-[#5f5878]">
                    ({g.kljuc}){g.podnaslov ? ` · ${g.podnaslov}` : ""}
                  </span>
                  <span
                    className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${ACCENT}26`, color: ACCENT }}
                  >
                    {g.stavke.length}{" "}
                    {grupisiPoProizvodu ? "partnera" : "proizvoda"}
                  </span>
                </button>

                {otvoreno && (
                  <div className="overflow-x-auto px-4 pb-3">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                            {grupisiPoProizvodu ? "Partner" : "Proizvod"}
                          </th>
                          {!grupisiPoProizvodu && (
                            <th className="text-left px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                              JM
                            </th>
                          )}
                          <th className="text-right px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                            Dog. cijena VPC
                          </th>
                          <th className="text-right px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                            Dog. cijena MPC
                          </th>
                          <th className="text-right px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                            Rabat 1
                          </th>
                          <th className="text-right px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                            Izmijenjeno
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.stavke.map((s) => (
                          <tr
                            key={s.sifra_tbl}
                            className="border-t border-gray-50 dark:border-[#2d2648]"
                          >
                            <td className="px-2 py-1.5 text-sm text-gray-700 dark:text-[#c5bfd8]">
                              {grupisiPoProizvodu
                                ? (s.naziv_partnera ?? `Partner #${s.partner_id}`)
                                : (s.naziv_proizvoda ?? `Proizvod #${s.proizvod_id}`)}
                            </td>
                            {!grupisiPoProizvodu && (
                              <td className="px-2 py-1.5 text-sm text-gray-500 dark:text-[#a99fc2]">
                                {s.jm ?? "–"}
                              </td>
                            )}
                            <td
                              className="px-2 py-1.5 text-sm text-right font-semibold"
                              style={{ color: PRIMARY }}
                            >
                              {formatCijena(s.dogovorena_cijena_vpc)}
                            </td>
                            <td className="px-2 py-1.5 text-sm text-right text-gray-600 dark:text-[#c5bfd8]">
                              {formatCijena(s.dogovorena_cijena_mpc)}
                            </td>
                            <td className="px-2 py-1.5 text-sm text-right text-gray-600 dark:text-[#c5bfd8]">
                              {formatProcenat(s.rabat_1_proc)}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-right text-gray-400 dark:text-[#5f5878]">
                              {formatVrijeme(s.vreme_izmjene)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
