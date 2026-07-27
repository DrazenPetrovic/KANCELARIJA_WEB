import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Package,
  RefreshCcw,
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

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: number;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3 flex-1 min-w-[150px]">
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

function SinhBadge({ v }: { v: number | null }) {
  if (v === null || v === undefined) {
    return <span className="text-gray-300 dark:text-[#4a4360] text-xs">–</span>;
  }
  const sinh = Number(v) === 1;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={
        sinh
          ? { background: `${ACCENT}26`, color: ACCENT }
          : { background: "#9ca3af26", color: "#6b7280" }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: sinh ? ACCENT : "#9ca3af" }}
      />
      {sinh ? "Sinhr." : "Nije sinhr."}
    </span>
  );
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

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/racuni/dogovorene-cijene-potpun`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju ugovorenih cijena");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

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

  const brojPartnera = useMemo(
    () => new Set(redovi.map((r) => r.partner_id)).size,
    [redovi],
  );
  const brojProizvoda = useMemo(
    () => new Set(redovi.map((r) => r.proizvod_id)).size,
    [redovi],
  );
  const brojNesinhronizovanih = useMemo(
    () => redovi.filter((r) => Number(r.sinhronizovano) !== 1).length,
    [redovi],
  );

  const prekidacProsirenja = (kljuc: number) => {
    setProsireno((prev) => {
      const novi = new Set(prev);
      if (novi.has(kljuc)) novi.delete(kljuc);
      else novi.add(kljuc);
      return novi;
    });
  };

  const prosiriSve = () => setProsireno(new Set(grupe.map((g) => g.kljuc)));
  const skupiSve = () => setProsireno(new Set());
  const sveProsireno = grupe.length > 0 && prosireno.size >= grupe.length;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Tags size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Ugovorene cijene
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Posebne cijene dogovorene po partneru i proizvodu
          </p>
        </div>
        <button
          type="button"
          onClick={ucitaj}
          disabled={loading}
          title="Osvježi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<Users size={16} />}
            vrijednost={brojPartnera}
            naziv="Partnera sa ugovorenom cijenom"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Package size={16} />}
            vrijednost={brojProizvoda}
            naziv="Proizvoda sa ugovorenom cijenom"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={redovi.length}
            naziv="Ugovorenih cijena ukupno"
            boja={ACCENT}
          />
          <StatTile
            icon={<RefreshCcw size={16} />}
            vrijednost={brojNesinhronizovanih}
            naziv="Nije sinhronizovano"
            boja={brojNesinhronizovanih > 0 ? "#f59e0b" : "#9ca3af"}
          />
        </div>
      )}

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

          <button
            type="button"
            onClick={sveProsireno ? skupiSve : prosiriSve}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
          >
            {sveProsireno ? (
              <ChevronsDownUp size={14} />
            ) : (
              <ChevronsUpDown size={14} />
            )}
            {sveProsireno ? "Skupi sve" : "Proširi sve"}
          </button>

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

        {!loading && !greska && (
          <p className="mt-3 text-xs text-gray-400 dark:text-[#5f5878]">
            Prikazano {grupe.length}{" "}
            {grupisiPoProizvodu ? "proizvoda" : "partnera"} · {filtrirani.length}
            {" "}/ {redovi.length} ugovorenih cijena
          </p>
        )}
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
          <div className="flex flex-col items-center justify-center gap-2 py-20">
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
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
            <Tags size={28} />
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              {pretraga.trim()
                ? "Nema rezultata za tu pretragu."
                : "Nema ugovorenih cijena za prikaz."}
            </p>
          </div>
        )}

        {!loading &&
          !greska &&
          grupe.map((g, i) => {
            const otvoreno = prosireno.has(g.kljuc);
            return (
              <div
                key={g.kljuc}
                className={`border-b border-gray-100 dark:border-[#2d2648] last:border-b-0 ${
                  i % 2 === 1 ? "bg-[#faf9fc] dark:bg-[#221c34]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => prekidacProsirenja(g.kljuc)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-50/60 dark:hover:bg-[#271f40]/60 transition-colors"
                >
                  <ChevronRight
                    size={14}
                    className="transition-transform duration-200 flex-shrink-0"
                    style={{
                      color: PRIMARY,
                      transform: otvoreno ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#ede8f5" }}
                  >
                    {grupisiPoProizvodu ? (
                      <Package size={14} style={{ color: PRIMARY }} />
                    ) : (
                      <Users size={14} style={{ color: PRIMARY }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      {g.naslov}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                      #{g.kljuc}
                      {g.podnaslov ? ` · ${g.podnaslov}` : ""}
                    </div>
                  </div>
                  <span
                    className="ml-auto flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${ACCENT}26`, color: ACCENT }}
                  >
                    {g.stavke.length}{" "}
                    {grupisiPoProizvodu ? "partnera" : "proizvoda"}
                  </span>
                </button>

                {otvoreno && (
                  <div className="overflow-x-auto px-4 pb-3">
                    <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: `${PRIMARY}1f` }}>
                            <th
                              className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              {grupisiPoProizvodu ? "Partner" : "Proizvod"}
                            </th>
                            {!grupisiPoProizvodu && (
                              <th
                                className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide"
                                style={{ color: PRIMARY }}
                              >
                                JM
                              </th>
                            )}
                            <th
                              className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              Dog. cijena VPC
                            </th>
                            <th
                              className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              Dog. cijena MPC
                            </th>
                            <th
                              className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              Rabat 1
                            </th>
                            <th
                              className="text-center px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              Status
                            </th>
                            <th
                              className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: PRIMARY }}
                            >
                              Izmijenjeno
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.stavke.map((s, idx) => {
                            const sinh = Number(s.sinhronizovano) === 1;
                            return (
                            <tr
                              key={s.sifra_tbl}
                              className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                                sinh
                                  ? idx % 2 === 1
                                    ? "bg-[#f4f1f9]/60 dark:bg-[#241d3a]/40"
                                    : ""
                                  : "bg-amber-50/70 dark:bg-amber-500/[0.07]"
                              }`}
                            >
                              <td
                                className="px-3 py-2 text-sm text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]"
                                style={{
                                  borderLeft: `3px solid ${sinh ? ACCENT : "#f59e0b"}`,
                                }}
                              >
                                {grupisiPoProizvodu
                                  ? (s.naziv_partnera ?? `Partner #${s.partner_id}`)
                                  : (s.naziv_proizvoda ?? `Proizvod #${s.proizvod_id}`)}
                              </td>
                              {!grupisiPoProizvodu && (
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648]">
                                  {s.jm ?? "–"}
                                </td>
                              )}
                              <td
                                className="px-3 py-2 text-sm text-right font-semibold border-t border-gray-50 dark:border-[#2d2648]"
                                style={{ color: PRIMARY }}
                              >
                                {formatCijena(s.dogovorena_cijena_vpc)}
                              </td>
                              <td className="px-3 py-2 text-sm text-right text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                {formatCijena(s.dogovorena_cijena_mpc)}
                              </td>
                              <td className="px-3 py-2 text-sm text-right text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                {formatProcenat(s.rabat_1_proc)}
                              </td>
                              <td className="px-3 py-2 text-center border-t border-gray-50 dark:border-[#2d2648]">
                                <SinhBadge v={s.sinhronizovano} />
                              </td>
                              <td className="px-3 py-2 text-xs text-right text-gray-400 dark:text-[#5f5878] border-t border-gray-50 dark:border-[#2d2648]">
                                {formatVrijeme(s.vreme_izmjene)}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
