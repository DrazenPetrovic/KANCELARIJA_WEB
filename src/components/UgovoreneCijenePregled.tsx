import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Package,
  RefreshCcw,
  Search,
  Tags,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { VariableSizeList } from "react-window";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Virtualizacija liste grupa (react-window) — kod partnera/proizvoda sa puno
// ugovorenih cijena renderovanje SVIH redova odjednom je sporo. Visina reda
// zavisi od toga da li je grupa proširena (tad ima i tabelu ispod), pa se
// koristi VariableSizeList sa procijenjenom visinom po redu; procjene su malo
// velikodušnije od stvarnih piksela da se izbjegne preklapanje redova.
const VISINA_HEDERA_GRUPE = 61;
const VISINA_TABELE_DODATNO = 18;
const VISINA_TABELE_HEDER = 40;
const VISINA_TABELE_REDA = 42;
const MAX_VISINA_LISTE = 700;

// Red iz erp.artikli_dogovorene_cijene_pregled_potpun.
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

function GrupaRed({
  g,
  index,
  style,
  grupisiPoProizvodu,
  otvoreno,
  brisanjeUToku,
  onPrekidacProsirenja,
  onObrisiGrupu,
  onObrisiStavku,
}: {
  g: Grupa;
  index: number;
  style: CSSProperties;
  grupisiPoProizvodu: boolean;
  otvoreno: boolean;
  brisanjeUToku: Set<number>;
  onPrekidacProsirenja: (kljuc: number) => void;
  onObrisiGrupu: (g: Grupa) => void;
  onObrisiStavku: (s: UgovorenaCijenaRed) => void;
}) {
  return (
    <div
      style={style}
      className={`overflow-hidden border-b border-gray-100 dark:border-[#2d2648] ${
        index % 2 === 1
          ? "bg-[#faf9fc] dark:bg-[#221c34]"
          : "bg-white dark:bg-[#261f38]"
      }`}
    >
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50/60 dark:hover:bg-[#271f40]/60 transition-colors">
        <button
          type="button"
          onClick={() => onPrekidacProsirenja(g.kljuc)}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
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
        </button>
        <span
          className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${ACCENT}26`, color: ACCENT }}
        >
          {g.stavke.length} {grupisiPoProizvodu ? "partnera" : "proizvoda"}
        </span>
        {!grupisiPoProizvodu && (
          <button
            type="button"
            onClick={() => onObrisiGrupu(g)}
            disabled={g.stavke.some((s) => brisanjeUToku.has(s.sifra_tbl))}
            title={`Obriši sve ugovorene cijene za "${g.naslov}"`}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {g.stavke.some((s) => brisanjeUToku.has(s.sifra_tbl)) ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        )}
      </div>

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
                  {!grupisiPoProizvodu && (
                    <th
                      className="text-center px-3 py-2 text-xs font-bold uppercase tracking-wide"
                      style={{ color: PRIMARY }}
                    >
                      Akcije
                    </th>
                  )}
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
                      {!grupisiPoProizvodu && (
                        <td className="px-3 py-2 text-center border-t border-gray-50 dark:border-[#2d2648]">
                          <button
                            type="button"
                            onClick={() => onObrisiStavku(s)}
                            disabled={brisanjeUToku.has(s.sifra_tbl)}
                            title="Obriši ugovorenu cijenu"
                            className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            {brisanjeUToku.has(s.sifra_tbl) ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </td>
                      )}
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
  const [brisanjeUToku, setBrisanjeUToku] = useState<Set<number>>(new Set());

  // Zamjena za window.alert/confirm — modal na sredini ekrana. Ako je
  // "onPotvrdi" postavljen, prikazuju se dugmad Da/Ne (potvrda); inače samo "U redu".
  const [poruka, setPoruka] = useState<{
    naslov: string;
    poruka: string;
    tip: "info" | "greska" | "uspjeh" | "pitanje";
    onPotvrdi?: () => void;
  } | null>(null);

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/artikli/dogovorene-cijene-potpun`, {
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

  const deaktivirajNaServeru = async (
    partnerId: number,
    proizvodIds: number[],
  ) => {
    const res = await fetch(
      `${API_URL}/api/artikli/dogovorene-cijene/deaktiviraj`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          proizvodi: proizvodIds.map((proizvodId) => ({
            proizvod_id: proizvodId,
          })),
        }),
      },
    );
    if (!res.ok) throw new Error("Greška pri brisanju ugovorene cijene");
  };

  const izvrsiBrisanjeStavke = async (red: UgovorenaCijenaRed) => {
    setBrisanjeUToku((prev) => new Set(prev).add(red.sifra_tbl));
    try {
      await deaktivirajNaServeru(red.partner_id, [red.proizvod_id]);
      setRedovi((prev) => prev.filter((r) => r.sifra_tbl !== red.sifra_tbl));
    } catch (err) {
      setPoruka({
        naslov: "Greška",
        poruka:
          err instanceof Error ? err.message : "Greška pri brisanju ugovorene cijene",
        tip: "greska",
      });
    } finally {
      setBrisanjeUToku((prev) => {
        const novi = new Set(prev);
        novi.delete(red.sifra_tbl);
        return novi;
      });
    }
  };

  const obrisiStavku = (red: UgovorenaCijenaRed) => {
    setPoruka({
      naslov: "Brisanje ugovorene cijene",
      poruka: `Obrisati ugovorenu cijenu za "${red.naziv_proizvoda ?? `Proizvod #${red.proizvod_id}`}" (${red.naziv_partnera ?? `Partner #${red.partner_id}`})?`,
      tip: "pitanje",
      onPotvrdi: () => izvrsiBrisanjeStavke(red),
    });
  };

  // Poziva se samo iz pregleda "Po partneru", gdje je g.kljuc partner_id i sve
  // stavke grupe pripadaju istom partneru — šalje se jedan poziv sa svim
  // proizvodima odjednom (kako zahtijeva erp.artikli_dogovorene_cijene_deaktiviraj).
  const izvrsiBrisanjeGrupe = async (g: Grupa) => {
    const sifre = g.stavke.map((s) => s.sifra_tbl);
    const proizvodIds = g.stavke.map((s) => s.proizvod_id);
    setBrisanjeUToku((prev) => {
      const novi = new Set(prev);
      sifre.forEach((s) => novi.add(s));
      return novi;
    });
    try {
      await deaktivirajNaServeru(g.kljuc, proizvodIds);
      setRedovi((prev) => prev.filter((r) => !sifre.includes(r.sifra_tbl)));
    } catch (err) {
      setPoruka({
        naslov: "Greška",
        poruka:
          err instanceof Error ? err.message : "Greška pri brisanju ugovorenih cijena",
        tip: "greska",
      });
    } finally {
      setBrisanjeUToku((prev) => {
        const novi = new Set(prev);
        sifre.forEach((s) => novi.delete(s));
        return novi;
      });
    }
  };

  const obrisiGrupu = (g: Grupa) => {
    setPoruka({
      naslov: "Brisanje ugovorenih cijena",
      poruka: `Obrisati sve ugovorene cijene (${g.stavke.length}) za "${g.naslov}"?`,
      tip: "pitanje",
      onPotvrdi: () => izvrsiBrisanjeGrupe(g),
    });
  };

  const prosiriSve = () => setProsireno(new Set(grupe.map((g) => g.kljuc)));
  const skupiSve = () => setProsireno(new Set());
  const sveProsireno = grupe.length > 0 && prosireno.size >= grupe.length;

  const visinaGrupe = (g: Grupa) => {
    if (!prosireno.has(g.kljuc)) return VISINA_HEDERA_GRUPE;
    return (
      VISINA_HEDERA_GRUPE +
      VISINA_TABELE_DODATNO +
      VISINA_TABELE_HEDER +
      g.stavke.length * VISINA_TABELE_REDA
    );
  };
  const getItemSize = (index: number) => {
    const g = grupe[index];
    return g ? visinaGrupe(g) : VISINA_HEDERA_GRUPE;
  };
  const visinaListe = useMemo(() => {
    const ukupno = grupe.reduce((zbir, g) => zbir + visinaGrupe(g), 0);
    return Math.min(MAX_VISINA_LISTE, Math.max(ukupno, VISINA_HEDERA_GRUPE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupe, prosireno]);

  const listaRef = useRef<VariableSizeList>(null);
  useEffect(() => {
    listaRef.current?.resetAfterIndex(0);
  }, [grupe, prosireno]);

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

        {!loading && !greska && grupe.length > 0 && (
          <VariableSizeList
            ref={listaRef}
            height={visinaListe}
            width="100%"
            itemCount={grupe.length}
            itemSize={getItemSize}
            estimatedItemSize={VISINA_HEDERA_GRUPE}
            overscanCount={4}
          >
            {({ index, style }) => (
              <GrupaRed
                g={grupe[index]}
                index={index}
                style={style}
                grupisiPoProizvodu={grupisiPoProizvodu}
                otvoreno={prosireno.has(grupe[index].kljuc)}
                brisanjeUToku={brisanjeUToku}
                onPrekidacProsirenja={prekidacProsirenja}
                onObrisiGrupu={obrisiGrupu}
                onObrisiStavku={obrisiStavku}
              />
            )}
          </VariableSizeList>
        )}
      </div>

      {poruka && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !poruka.onPotvrdi) {
              setPoruka(null);
            }
          }}
        >
          <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[420px] max-w-[92vw] max-h-[85vh] overflow-hidden flex flex-col">
            <div
              className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
              style={{
                background:
                  poruka.tip === "greska"
                    ? "#ef4444"
                    : poruka.tip === "uspjeh"
                      ? ACCENT
                      : PRIMARY,
              }}
            >
              {poruka.tip === "greska" ? (
                <XCircle size={18} className="text-white flex-shrink-0" />
              ) : poruka.tip === "uspjeh" ? (
                <CheckCircle2 size={18} className="text-white flex-shrink-0" />
              ) : null}
              <div className="font-bold text-white text-base">{poruka.naslov}</div>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-[#c5bfd8] whitespace-pre-line overflow-y-auto flex-1 min-h-0">
              {poruka.poruka}
            </div>
            <div className="px-6 pb-5 pt-3 flex justify-end gap-2 flex-shrink-0 border-t border-gray-100 dark:border-[#2d2648]">
              {poruka.onPotvrdi ? (
                <>
                  <button
                    onClick={() => setPoruka(null)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-[#7d7498] border border-gray-200 dark:border-[#3a3158] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                  >
                    Ne
                  </button>
                  <button
                    onClick={() => {
                      const onPotvrdi = poruka.onPotvrdi;
                      setPoruka(null);
                      onPotvrdi?.();
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: PRIMARY }}
                  >
                    Da
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPoruka(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: PRIMARY }}
                >
                  U redu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
