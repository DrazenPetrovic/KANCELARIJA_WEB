import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  PackageOpen,
  Search,
  Truck,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const BOJA = "#d97706"; // boja sekvence "Prenos proizvoda"

interface Magacin1Stavka {
  sifra_proizvoda: number | string;
  naziv_proizvoda: string;
  jm: string;
  kolicina_proizvoda: number | string;
  proizvodna_cijena: number | string;
  transferna_cijena: number | string;
  VPC: number | string;
  Proizvodna_vrijednost: number | string;
  Transferna_vrijednos: number | string;
}

interface Magacin2Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  kolicina_proizvoda: number | string;
  nabavna_cijena: number | string;
  grupa_proizvoda: string;
}

export interface PrenosPayload {
  sifra_proizvoda: number;
  kolicina: number;
  transferna_cijena: number;
  vpc: number;
}

const fmt = (v: number | string | null | undefined, dec = 2) => {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

// Prihvata i zarez i tačku kao decimalni separator.
const parseBroj = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (t === "") return NaN;
  return Number(t);
};

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th
    className={`sticky top-0 px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const inputCls =
  "w-full px-3 py-2 text-sm text-right border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-[#231d36] dark:disabled:text-[#7d7498]";

const Polje = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) => (
  <label className="block">
    <span className="block mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-[#9a92b4]">
      {label}
    </span>
    {children}
    {hint && <span className="block mt-1 text-[11px]">{hint}</span>}
  </label>
);

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1 text-sm border-b border-gray-100 dark:border-[#2d2648] last:border-0">
    <span className="text-gray-500 dark:text-[#9a92b4]">{label}</span>
    <span className="font-semibold text-gray-800 dark:text-[#ede9f6]">{value}</span>
  </div>
);

export function RadniNalogPrenos() {
  const [magacin1, setMagacin1] = useState<Magacin1Stavka[]>([]);
  const [magacin2, setMagacin2] = useState<Magacin2Artikal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [samoSaStanjem, setSamoSaStanjem] = useState(true);

  const [izabrani, setIzabrani] = useState<Magacin1Stavka | null>(null);
  const [kolicina, setKolicina] = useState("");
  const [transferna, setTransferna] = useState("");
  const [vpcUnos, setVpcUnos] = useState("");

  const [potvrda, setPotvrda] = useState(false);
  const [poruka, setPoruka] = useState<string | null>(null);

  const ucitaj = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/api/radni-nalog/magacin-1`, { credentials: "include" }),
        fetch(`${API_URL}/api/radni-nalog/magacin-2`, { credentials: "include" }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("Greška pri učitavanju magacina");
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      setMagacin1(j1.data || []);
      setMagacin2(j2.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ucitaj();
  }, []);

  const magacin2Mapa = useMemo(() => {
    const m = new Map<string, Magacin2Artikal>();
    for (const a of magacin2) m.set(String(a.sifra_proizvoda), a);
    return m;
  }, [magacin2]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return magacin1.filter((p) => {
      if (samoSaStanjem && !(Number(p.kolicina_proizvoda) > 0)) return false;
      if (!q) return true;
      return (
        String(p.sifra_proizvoda).toLowerCase().includes(q) ||
        p.naziv_proizvoda.toLowerCase().includes(q)
      );
    });
  }, [magacin1, search, samoSaStanjem]);

  // Artikal u magacinu 2 i njegovo stanje
  const m2 = izabrani ? magacin2Mapa.get(String(izabrani.sifra_proizvoda)) : undefined;
  const stanjeM2 = Number(m2?.kolicina_proizvoda) || 0;
  const vpcIzM2 = !!m2 && stanjeM2 > 0;

  const izaberi = (p: Magacin1Stavka) => {
    setIzabrani(p);
    setKolicina("");
    setTransferna(Number(p.transferna_cijena) > 0 ? String(Number(p.transferna_cijena)) : "");
    const a = magacin2Mapa.get(String(p.sifra_proizvoda));
    const vpc = Number(a?.vpc) > 0 ? Number(a?.vpc) : Number(p.VPC) || 0;
    setVpcUnos(vpc > 0 ? String(vpc) : "");
  };

  const kol = parseBroj(kolicina);
  const tc = parseBroj(transferna);
  const vpc = vpcIzM2 ? Number(m2!.vpc) : parseBroj(vpcUnos);
  const stanjeM1 = Number(izabrani?.kolicina_proizvoda) || 0;

  const greske: string[] = [];
  if (izabrani) {
    if (!m2) greske.push("Proizvod ne postoji u magacinu 2 (artikli grupe 1/2).");
    if (!(kol > 0)) greske.push("Unesite količinu veću od 0.");
    else if (kol > stanjeM1)
      greske.push(`Količina je veća od stanja u magacinu 1 (${fmt(stanjeM1, 3)}).`);
    if (!(tc > 0)) greske.push("Unesite transfernu cijenu.");
    if (!(vpc > 0)) greske.push("Unesite VPC.");
  }
  const moze = !!izabrani && greske.length === 0;

  const payload: PrenosPayload | null = moze
    ? {
        sifra_proizvoda: Number(izabrani!.sifra_proizvoda),
        kolicina: kol,
        transferna_cijena: tc,
        vpc,
      }
    : null;

  const snimi = async () => {
    // TODO: poziv procedure za snimanje prenosa (čeka se procedura).
    console.log("Prenos — payload za snimanje:", payload);
    setPotvrda(false);
    setPoruka("Procedura za snimanje prenosa još nije povezana.");
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      {/* MAGACIN 1 */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100 dark:border-[#2d2648]">
          <div className="flex items-center gap-2">
            <PackageOpen size={16} style={{ color: PRIMARY }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
              Magacin 1 — proizvodnja
            </span>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv proizvoda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-64 focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#c5bfd8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={samoSaStanjem}
              onChange={(e) => setSamoSaStanjem(e.target.checked)}
              className="accent-[#785E9E]"
            />
            Samo sa stanjem
          </label>
          {!loading && !error && (
            <span className="ml-auto text-xs text-gray-400 dark:text-[#5f5878]">
              {filtered.length} / {magacin1.length}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">Učitavanje...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center text-sm text-gray-400 dark:text-[#5f5878]">
            Nema proizvoda za prikaz.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TH>Šifra</TH>
                  <TH>Proizvod</TH>
                  <TH>JM</TH>
                  <TH right>Stanje M1</TH>
                  <TH right>Proizv. cij.</TH>
                  <TH right>Transf. cij.</TH>
                  <TH right>VPC</TH>
                  <TH right>Stanje M2</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const aktivan = izabrani?.sifra_proizvoda === p.sifra_proizvoda;
                  const a = magacin2Mapa.get(String(p.sifra_proizvoda));
                  return (
                    <tr
                      key={p.sifra_proizvoda}
                      onClick={() => izaberi(p)}
                      className={`cursor-pointer border-b border-gray-200 dark:border-[#3a3158] transition-colors [&>td]:px-2 [&>td]:py-1 [&>td]:whitespace-nowrap ${
                        aktivan
                          ? "bg-amber-50 dark:bg-amber-950/30"
                          : i % 2 === 1
                            ? "bg-[#fcfbfe] dark:bg-[#2a2240] hover:bg-purple-50/60 dark:hover:bg-[#2d2648]"
                            : "hover:bg-purple-50/60 dark:hover:bg-[#2d2648]"
                      }`}
                      style={aktivan ? { boxShadow: `inset 3px 0 0 ${BOJA}` } : {}}
                    >
                      <td className="text-[10px] text-gray-400 dark:text-[#5f5878]">{p.sifra_proizvoda}</td>
                      <td className="font-semibold text-gray-800 dark:text-[#ede9f6]">{p.naziv_proizvoda}</td>
                      <td className="text-gray-600 dark:text-[#c5bfd8]">{p.jm}</td>
                      <td className="text-right font-bold text-gray-800 dark:text-[#ede9f6]">
                        {fmt(p.kolicina_proizvoda, 3)}
                      </td>
                      <td className="text-right text-gray-600 dark:text-[#c5bfd8]">{fmt(p.proizvodna_cijena, 3)}</td>
                      <td className="text-right text-gray-600 dark:text-[#c5bfd8]">{fmt(p.transferna_cijena)}</td>
                      <td className="text-right text-gray-600 dark:text-[#c5bfd8]">{fmt(p.VPC)}</td>
                      <td className="text-right text-gray-600 dark:text-[#c5bfd8]">
                        {a ? fmt(a.kolicina_proizvoda, 3) : <span className="text-red-500">nema</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORMA PRENOSA */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden xl:sticky xl:top-4">
        <div
          className="flex items-center gap-2 px-4 py-3 text-white text-sm font-bold"
          style={{ background: BOJA }}
        >
          <Truck size={16} />
          Prenos u magacin 2
        </div>

        {!izabrani ? (
          <div className="px-4 py-16 text-center text-sm text-gray-400 dark:text-[#5f5878]">
            Izaberite proizvod iz magacina 1.
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <p className="text-base font-bold text-gray-800 dark:text-[#ede9f6]">
                {izabrani.naziv_proizvoda}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                Šifra {izabrani.sifra_proizvoda} · {izabrani.jm}
              </p>
            </div>

            <div className="rounded-xl bg-[#faf9fc] dark:bg-[#1e1a2d] px-3 py-1">
              <Info label="Stanje magacin 1" value={fmt(stanjeM1, 3)} />
              <Info label="Proizvodna cijena" value={fmt(izabrani.proizvodna_cijena, 3)} />
              <Info
                label="Stanje magacin 2"
                value={m2 ? fmt(stanjeM2, 3) : <span className="text-red-500">ne postoji</span>}
              />
              {m2 && <Info label="VPC magacin 2" value={fmt(m2.vpc)} />}
            </div>

            <Polje label="Količina za prenos">
              <input
                autoFocus
                inputMode="decimal"
                value={kolicina}
                onChange={(e) => setKolicina(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Polje>

            <Polje label="Transferna cijena (nabavna u M2)">
              <input
                inputMode="decimal"
                value={transferna}
                onChange={(e) => setTransferna(e.target.value)}
                className={inputCls}
                placeholder="0,00"
              />
            </Polje>

            <Polje
              label="VPC"
              hint={
                vpcIzM2 ? (
                  <span className="text-gray-400 dark:text-[#7d7498]">
                    Proizvod ima stanje u magacinu 2 — VPC se preuzima iz magacina 2.
                  </span>
                ) : (
                  <span className="text-amber-600">
                    Nema stanja u magacinu 2 — VPC se može unijeti.
                  </span>
                )
              }
            >
              <input
                inputMode="decimal"
                value={vpcIzM2 ? fmt(m2!.vpc) : vpcUnos}
                onChange={(e) => setVpcUnos(e.target.value)}
                disabled={vpcIzM2}
                className={inputCls}
                placeholder="0,00"
              />
            </Polje>

            {kol > 0 && tc > 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] px-3 py-1">
                <Info label="Transferna vrijednost" value={`${fmt(kol * tc)} KM`} />
                {vpc > 0 && <Info label="VPC vrijednost" value={`${fmt(kol * vpc)} KM`} />}
              </div>
            )}

            {greske.length > 0 && (kolicina !== "" || !m2) && (
              <ul className="space-y-1 text-xs text-red-500">
                {greske.map((g) => (
                  <li key={g}>• {g}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIzabrani(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
              >
                Odustani
              </button>
              <button
                type="button"
                disabled={!moze}
                onClick={() => setPotvrda(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: BOJA }}
              >
                Prenesi
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL POTVRDE */}
      {potvrda && payload && izabrani && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3 text-white font-bold"
              style={{ background: BOJA }}
            >
              <span className="flex items-center gap-2">
                <Truck size={16} />
                Potvrda prenosa
              </span>
              <button onClick={() => setPotvrda(false)} className="opacity-80 hover:opacity-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                Prenijeti iz <b>magacina 1</b> u <b>magacin 2</b>:
              </p>
              <div>
                <p className="font-bold text-gray-800 dark:text-[#ede9f6]">{izabrani.naziv_proizvoda}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                  Šifra {izabrani.sifra_proizvoda}
                </p>
              </div>
              <div className="rounded-xl bg-[#faf9fc] dark:bg-[#1e1a2d] px-3 py-1">
                <Info label="Količina" value={`${fmt(payload.kolicina, 3)} ${izabrani.jm}`} />
                <Info label="Transferna cijena" value={fmt(payload.transferna_cijena)} />
                <Info label="VPC" value={fmt(payload.vpc)} />
                <Info label="Transferna vrijednost" value={`${fmt(payload.kolicina * payload.transferna_cijena)} KM`} />
                <Info
                  label="Stanje M1 nakon prenosa"
                  value={fmt(stanjeM1 - payload.kolicina, 3)}
                />
                <Info label="Stanje M2 nakon prenosa" value={fmt(stanjeM2 + payload.kolicina, 3)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setPotvrda(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={snimi}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110"
                style={{ background: BOJA }}
              >
                Potvrdi prenos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PORUKA */}
      {poruka && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-amber-300 p-6">
            <div className="flex justify-center mb-3">
              <AlertTriangle size={40} className="text-amber-500" />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {poruka}
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setPoruka(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold hover:brightness-110"
                style={{ background: PRIMARY }}
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
