import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FilePlus,
  X,
  Layers,
  ListTree,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const BOJA = "#0d9488"; // boja sekvence "Unos novog radnog naloga"
const BOJA_UNOS = "#16a34a"; // dugme "Unesi novi radni nalog" i potvrda

interface Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  kolicina_proizvoda: number | string;
  nabavna_cijena: number | string;
  grupa_proizvoda: string;
  naziv_grupe: string;
}

interface Proizvod extends Artikal {
  stanje_m1: number;
  ima_normativ: boolean;
}

interface NormativStavka {
  sifra_tabele: number;
  sifra_proizvoda: number;
  sifra_sirovine: number;
  naziv_sirovine: string;
  jm_sirovine: string;
  kolicina_sirovine: number | string;
}

// Stavka sastava radnog naloga (sirovina koja ulazi u nalog)
interface SastavStavka {
  sifra_sirovine: string;
  naziv_sirovine: string;
  jm: string;
  kolicina_normativ: number | null; // null = dodato ručno
  kolicina: string; // količina koju operater unosi (može sa zarezom)
  izvor: "normativ" | "rucno";
  izmijenjena: boolean; // operater ručno promijenio količinu -> ne preračunava se više
}

const uBroj = (v: string) => {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const uTekst = (n: number) => String(n).replace(".", ",");

const ocisti = (v: string) => v.replace(/[^\d.,]/g, "");

// Količina sirovine = normativ (za 1 JM proizvoda) × količina proizvoda
const izracunaj = (normativ: number | null, kolProizvoda: string) => {
  const q = uBroj(kolProizvoda);
  if (normativ === null || !(q > 0)) return "";
  return uTekst(Math.round(normativ * q * 1000) / 1000);
};

const fmt = (v: number | string | null | undefined, dec = 2) => {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th
    className={`sticky top-0 z-10 px-1 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const Pretraga = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => (
  <div className="relative flex-1 min-w-[160px]">
    <Search
      size={14}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
    />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
    />
  </div>
);

const Kartica = ({
  ikona,
  naslov,
  brojac,
  alati,
  children,
  istaknuta,
}: {
  ikona: React.ReactNode;
  naslov: React.ReactNode;
  brojac?: React.ReactNode;
  alati?: React.ReactNode;
  children: React.ReactNode;
  istaknuta?: boolean;
}) => (
  <div
    className={`bg-white dark:bg-[#261f38] rounded-2xl shadow-sm overflow-hidden ${istaknuta ? "border-2" : "border border-gray-100 dark:border-[#2d2648]"}`}
    style={istaknuta ? { borderColor: BOJA } : {}}
  >
    <div className="p-3 border-b border-gray-100 dark:border-[#2d2648] space-y-2">
      <div className="flex items-center gap-2" style={{ color: istaknuta ? BOJA : PRIMARY }}>
        {ikona}
        <span className="text-xs font-bold uppercase tracking-wider truncate">{naslov}</span>
        {brojac && (
          <span className="ml-auto text-xs font-normal text-gray-400 dark:text-[#5f5878]">
            {brojac}
          </span>
        )}
      </div>
      {alati && <div className="flex flex-wrap items-center gap-2">{alati}</div>}
    </div>
    {children}
  </div>
);

const Chip = ({
  aktivan,
  onClick,
  children,
}: {
  aktivan: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
      aktivan
        ? "text-white border-transparent"
        : "text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] border-gray-200 dark:border-[#3a3158] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
    }`}
    style={aktivan ? { background: BOJA } : {}}
  >
    {children}
  </button>
);

const filtriraj = <T extends Artikal>(lista: T[], q: string) => {
  const t = q.trim().toLowerCase();
  if (!t) return lista;
  return lista.filter(
    (a) =>
      String(a.sifra_proizvoda).toLowerCase().includes(t) ||
      a.naziv_proizvoda.toLowerCase().includes(t),
  );
};

const praznaCelija = (tekst: string, colSpan: number) => (
  <tr>
    <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
      {tekst}
    </td>
  </tr>
);

export function RadniNalogUnos() {
  const [sirovine, setSirovine] = useState<Artikal[]>([]);
  const [proizvodi, setProizvodi] = useState<Proizvod[]>([]);
  const [normativi, setNormativi] = useState<NormativStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchS, setSearchS] = useState("");
  const [searchP, setSearchP] = useState("");
  const [grupaFilter, setGrupaFilter] = useState<string>("");
  const [samoSaNormativom, setSamoSaNormativom] = useState(false);

  const [proizvod, setProizvod] = useState<Proizvod | null>(null);
  const [sastav, setSastav] = useState<SastavStavka[]>([]);
  const [fokus, setFokus] = useState<string | null>(null); // ručno dodata sirovina -> fokus na količinu
  const [kolicinaProizvoda, setKolicinaProizvoda] = useState("");
  const [potvrda, setPotvrda] = useState(false);
  const [poruka, setPoruka] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/radni-nalog/unos-podaci`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Greška pri učitavanju sirovina i proizvoda");
        const json = await res.json();
        setSirovine(json.sirovine || []);
        setProizvodi(json.proizvodi || []);
        setNormativi(json.normativi || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sirovineMapa = useMemo(() => {
    const m = new Map<string, Artikal>();
    for (const s of sirovine) m.set(String(s.sifra_proizvoda), s);
    return m;
  }, [sirovine]);

  const normativZa = (sifraProizvoda: string, kolProizvoda: string): SastavStavka[] =>
    normativi
      .filter((n) => String(n.sifra_proizvoda) === String(sifraProizvoda))
      .map((n) => ({
        sifra_sirovine: String(n.sifra_sirovine),
        naziv_sirovine: n.naziv_sirovine,
        jm: n.jm_sirovine,
        kolicina_normativ: Number(n.kolicina_sirovine),
        kolicina: izracunaj(Number(n.kolicina_sirovine), kolProizvoda),
        izvor: "normativ" as const,
        izmijenjena: false,
      }));

  // Promjena proizvoda = novi sastav (iz normativa novog proizvoda), količina ispočetka
  const izaberiProizvod = (p: Proizvod) => {
    if (proizvod?.sifra_proizvoda === p.sifra_proizvoda) return;
    setProizvod(p);
    setKolicinaProizvoda("");
    setSastav(normativZa(p.sifra_proizvoda, ""));
  };

  // Promjena količine proizvoda preračunava sirovine iz normativa (osim ručno izmijenjenih)
  const promijeniKolicinuProizvoda = (v: string) => {
    const cist = ocisti(v);
    setKolicinaProizvoda(cist);
    setSastav((prev) =>
      prev.map((x) =>
        x.izvor === "normativ" && !x.izmijenjena
          ? { ...x, kolicina: izracunaj(x.kolicina_normativ, cist) }
          : x,
      ),
    );
  };

  const dodajSirovinu = (s: Artikal) => {
    if (!proizvod) return;
    if (!uSastavu.has(String(s.sifra_proizvoda))) setFokus(String(s.sifra_proizvoda));
    setSastav((prev) =>
      prev.some((x) => x.sifra_sirovine === String(s.sifra_proizvoda))
        ? prev
        : [
            ...prev,
            {
              sifra_sirovine: String(s.sifra_proizvoda),
              naziv_sirovine: s.naziv_proizvoda,
              jm: s.jm,
              kolicina_normativ: null,
              kolicina: "",
              izvor: "rucno",
              izmijenjena: true,
            },
          ],
    );
  };

  const ukloniSirovinu = (sifra: string) =>
    setSastav((prev) => prev.filter((x) => x.sifra_sirovine !== sifra));

  const promijeniKolicinu = (sifra: string, v: string) =>
    setSastav((prev) =>
      prev.map((x) =>
        x.sifra_sirovine === sifra ? { ...x, kolicina: ocisti(v), izmijenjena: true } : x,
      ),
    );

  // Provjera količine prema stanju sirovine
  const provjeraZa = (x: SastavStavka) => {
    const stanje = Number(sirovineMapa.get(x.sifra_sirovine)?.kolicina_proizvoda) || 0;
    const kol = x.kolicina.trim() === "" ? NaN : uBroj(x.kolicina);
    const unesena = Number.isFinite(kol) && kol > 0;
    const nedostaje = unesena && kol > stanje ? kol - stanje : 0;
    return { stanje, kol, unesena, nedostaje };
  };

  const vratiNormativ = () =>
    proizvod && setSastav(normativZa(proizvod.sifra_proizvoda, kolicinaProizvoda));

  const uSastavu = useMemo(() => new Set(sastav.map((x) => x.sifra_sirovine)), [sastav]);

  const grupe = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proizvodi) m.set(String(p.grupa_proizvoda), p.naziv_grupe);
    return Array.from(m, ([sifra, naziv]) => ({ sifra, naziv })).sort(
      (a, b) => Number(a.sifra) - Number(b.sifra),
    );
  }, [proizvodi]);

  const filtriraneS = useMemo(() => filtriraj(sirovine, searchS), [sirovine, searchS]);

  const filtriraniP = useMemo(
    () =>
      filtriraj(proizvodi, searchP).filter(
        (p) =>
          (!grupaFilter || String(p.grupa_proizvoda) === grupaFilter) &&
          (!samoSaNormativom || p.ima_normativ),
      ),
    [proizvodi, searchP, grupaFilter, samoSaNormativom],
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
        <span className="text-sm text-gray-500 dark:text-[#7d7498]">Učitavanje...</span>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      </div>
    );

  const izmijenjenSastav =
    !!proizvod &&
    (sastav.some((x) => x.izmijenjena) ||
      sastav.length !== normativZa(proizvod.sifra_proizvoda, "").length);

  const provjere = sastav.map(provjeraZa);
  const brojNedostaje = provjere.filter((p) => p.nedostaje > 0).length;
  const brojBezKolicine = provjere.filter((p) => !p.unesena).length;

  const kolProizvodaOk = uBroj(kolicinaProizvoda) > 0;

  const razlogBlokade = !kolProizvodaOk
    ? "Unesite količinu proizvoda."
    : sastav.length === 0
      ? "Sastav je prazan — dodajte sirovine."
      : brojBezKolicine > 0
        ? "Unesite količinu za sve sirovine."
        : brojNedostaje > 0
          ? `Nema dovoljno na stanju za ${brojNedostaje} ${brojNedostaje === 1 ? "sirovinu" : "sirovine"} — smanjite količinu ili uklonite sirovinu.`
          : "";
  const mozeUnos = !!proizvod && razlogBlokade === "";

  // Procedura za snimanje još nije data — za sada samo poruka.
  const potvrdiUnos = () => {
    setPotvrda(false);
    setPoruka("Procedura za snimanje radnog naloga još nije povezana. Nalog nije snimljen.");
  };


  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)_minmax(0,0.75fr)] gap-3 items-start">
      {/* ── SIROVINE ── */}
      <Kartica
        ikona={<Layers size={16} />}
        naslov="Sirovine"
        brojac={`${filtriraneS.length} / ${sirovine.length}`}
        alati={
          <Pretraga value={searchS} onChange={setSearchS} placeholder="Šifra, naziv sirovine..." />
        }
      >
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <TH>Šifra</TH>
                <TH>Sirovina</TH>
                <TH>JM</TH>
                <TH right>Stanje</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {filtriraneS.map((s, i) => {
                const vecU = uSastavu.has(String(s.sifra_proizvoda));
                return (
                  <tr
                    key={s.sifra_proizvoda}
                    onClick={() => dodajSirovinu(s)}
                    title={
                      !proizvod
                        ? "Prvo izaberite proizvod"
                        : vecU
                          ? "Sirovina je već u sastavu"
                          : "Klik — dodaj u sastav"
                    }
                    className={`border-b border-gray-200 dark:border-[#3a3158] transition-colors [&>td]:px-1 [&>td]:py-1 [&>td]:whitespace-nowrap ${
                      vecU
                        ? "bg-teal-50 dark:bg-teal-950/30"
                        : `${i % 2 === 1 ? "bg-[#fcfbfe] dark:bg-[#2a2240]" : ""} ${proizvod ? "cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648]" : ""}`
                    }`}
                  >
                    <td className="text-[10px] text-gray-400 dark:text-[#5f5878]">{s.sifra_proizvoda}</td>
                    <td className="w-full font-semibold text-gray-800 dark:text-[#ede9f6] !whitespace-normal">
                      {s.naziv_proizvoda}
                    </td>
                    <td className="text-gray-600 dark:text-[#c5bfd8]">{s.jm}</td>
                    <td className="text-right font-bold text-gray-800 dark:text-[#ede9f6]">
                      {fmt(s.kolicina_proizvoda, 3)}
                    </td>
                    <td className="w-6 text-center">
                      {proizvod && !vecU && <Plus size={14} style={{ color: BOJA }} />}
                    </td>
                  </tr>
                );
              })}
              {filtriraneS.length === 0 && praznaCelija("Nema sirovina za prikaz.", 5)}
            </tbody>
          </table>
        </div>
      </Kartica>

      {/* ── SASTAV (sredina) ── */}
      <Kartica
        istaknuta
        ikona={<ListTree size={16} />}
        naslov={proizvod ? `Sastav — ${proizvod.naziv_proizvoda}` : "Sastav radnog naloga"}
        brojac={proizvod ? `${sastav.length} sir.` : undefined}
        alati={
          proizvod ? (
            <>
              <span className="text-[11px] text-gray-500 dark:text-[#9a92b4]">
                Šifra {proizvod.sifra_proizvoda} · {proizvod.jm} · Stanje M1{" "}
                <b>{fmt(proizvod.stanje_m1, 3)}</b>
              </span>
              {izmijenjenSastav && (
                <button
                  type="button"
                  onClick={vratiNormativ}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
                  title="Vrati sastav na normativ proizvoda"
                >
                  <RotateCcw size={12} />
                  Vrati normativ
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {!proizvod ? (
          <div className="px-4 py-16 text-center text-sm text-gray-400 dark:text-[#5f5878]">
            Izaberite proizvod (desno).
            <br />
            Sastav se puni iz normativa, a sirovine se dodaju klikom lijevo.
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            {/* Količina proizvoda koja se pravi */}
            <div className="px-3 py-3 flex flex-wrap items-center gap-3 bg-teal-50/60 dark:bg-teal-950/20 border-b border-gray-100 dark:border-[#2d2648]">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: BOJA }}>
                Količina proizvoda
              </label>
              <div className="relative">
                <input
                  key={proizvod.sifra_proizvoda}
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={kolicinaProizvoda}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => promijeniKolicinuProizvoda(e.target.value)}
                  placeholder="0"
                  className={`w-40 pl-3 pr-12 py-2 text-right text-lg font-bold rounded-xl border-2 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:ring-4 transition-all ${
                    kolProizvodaOk
                      ? "border-teal-400 focus:border-teal-500 focus:ring-teal-200 dark:border-teal-700 dark:focus:ring-teal-900/50"
                      : "border-amber-400 focus:ring-amber-200 dark:focus:ring-amber-900/50"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 dark:text-[#7d7498]">
                  {proizvod.jm}
                </span>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-[#9a92b4]">
                Sirovine iz normativa = normativ (za 1 {proizvod.jm}) × količina
              </span>
            </div>
            {sastav.length > 0 && (brojNedostaje > 0 || brojBezKolicine > 0) && (
              <div className="px-3 py-2 space-y-1 text-xs font-semibold border-b border-gray-100 dark:border-[#2d2648]">
                {brojNedostaje > 0 && (
                  <p className="text-red-600 dark:text-red-400">
                    ⚠ Nema dovoljno na stanju: {brojNedostaje}{" "}
                    {brojNedostaje === 1 ? "sirovina" : "sirovine"}
                  </p>
                )}
                {brojBezKolicine > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Bez unesene količine: {brojBezKolicine}
                  </p>
                )}
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TH>Šifra</TH>
                  <TH>Sirovina</TH>
                  <TH>JM</TH>
                  <TH right>Norm. / 1 {proizvod.jm}</TH>
                  <TH right>Količina</TH>
                  <TH right>Stanje</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {sastav.map((x, idx) => {
                  const { stanje, unesena, nedostaje } = provjere[idx];
                  return (
                    <tr
                      key={x.sifra_sirovine}
                      className={`border-b border-gray-200 dark:border-[#3a3158] [&>td]:px-2 [&>td]:py-1 [&>td]:whitespace-nowrap ${
                        nedostaje > 0 ? "bg-red-50 dark:bg-red-950/30" : ""
                      }`}
                    >
                      <td className="text-[10px] text-gray-400 dark:text-[#5f5878]">{x.sifra_sirovine}</td>
                      <td className="font-semibold text-gray-800 dark:text-[#ede9f6] !whitespace-normal">
                        {x.naziv_sirovine}
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold align-middle ${
                            x.izvor === "normativ"
                              ? "text-white"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          }`}
                          style={x.izvor === "normativ" ? { background: BOJA } : {}}
                        >
                          {x.izvor === "normativ" ? "NORMATIV" : "RUČNO"}
                        </span>
                      </td>
                      <td className="text-gray-600 dark:text-[#c5bfd8]">{x.jm}</td>
                      <td className="text-right text-gray-500 dark:text-[#9a92b4]">
                        {x.kolicina_normativ === null ? "–" : fmt(x.kolicina_normativ, 3)}
                      </td>
                      <td className="text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={x.kolicina}
                          autoFocus={fokus === x.sifra_sirovine}
                          onFocus={(e) => {
                            e.target.select();
                            if (fokus === x.sifra_sirovine) setFokus(null);
                          }}
                          onChange={(e) => promijeniKolicinu(x.sifra_sirovine, e.target.value)}
                          placeholder="0"
                          className={`w-24 px-2 py-1 text-right text-sm font-bold rounded-lg border-2 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:ring-4 transition-all ${
                            nedostaje > 0
                              ? "border-red-400 focus:ring-red-200 dark:focus:ring-red-900/50"
                              : !unesena
                                ? "border-amber-300 focus:ring-amber-200 dark:focus:ring-amber-900/50"
                                : "border-teal-300 focus:border-teal-500 focus:ring-teal-200 dark:border-teal-800 dark:focus:ring-teal-900/50"
                          }`}
                        />
                        {nedostaje > 0 && (
                          <div className="text-[10px] font-semibold text-red-600 dark:text-red-400 mt-0.5">
                            nedostaje {fmt(nedostaje, 3)}
                          </div>
                        )}
                      </td>
                      <td
                        className={`text-right font-semibold ${
                          nedostaje > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-[#c5bfd8]"
                        }`}
                      >
                        {fmt(stanje, 3)}
                      </td>
                      <td className="w-8 text-center">
                        <button
                          type="button"
                          onClick={() => ukloniSirovinu(x.sifra_sirovine)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Ukloni iz sastava"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sastav.length === 0 &&
                  praznaCelija(
                    proizvod.ima_normativ
                      ? "Sastav je prazan — dodajte sirovine klikom lijevo."
                      : "Proizvod nema normativ — dodajte sirovine klikom lijevo.",
                    7,
                  )}
              </tbody>
            </table>
          </div>
        )}
        {proizvod && (
          <div className="p-3 border-t border-gray-100 dark:border-[#2d2648] space-y-2">
            {!mozeUnos && (
              <p
                className={`text-[11px] text-center ${brojNedostaje > 0 && brojBezKolicine === 0 && kolProizvodaOk ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-500 dark:text-[#9a92b4]"}`}
              >
                {razlogBlokade}
              </p>
            )}
            <button
              type="button"
              disabled={!mozeUnos}
              onClick={() => setPotvrda(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: BOJA_UNOS }}
            >
              <FilePlus size={16} />
              Unesi novi radni nalog
            </button>
          </div>
        )}
      </Kartica>

      {/* ── MODAL POTVRDE ── */}
      {potvrda && proizvod && mozeUnos && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3 text-white font-bold"
              style={{ background: BOJA_UNOS }}
            >
              <span className="flex items-center gap-2">
                <FilePlus size={18} />
                Potvrda novog radnog naloga
              </span>
              <button onClick={() => setPotvrda(false)} className="opacity-80 hover:opacity-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="rounded-lg border border-gray-200 dark:border-[#3a3158] p-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#7d7498]">
                  Proizvod
                </div>
                <div className="font-bold text-gray-800 dark:text-[#ede9f6]">
                  {proizvod.sifra_proizvoda} — {proizvod.naziv_proizvoda}
                </div>
                <div className="mt-1 text-gray-600 dark:text-[#c5bfd8]">
                  Količina: <b className="text-base">{fmt(uBroj(kolicinaProizvoda), 3)}</b>{" "}
                  {proizvod.jm}
                </div>
              </div>

              <div className="max-h-[40vh] overflow-auto rounded-lg border border-gray-200 dark:border-[#3a3158]">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <TH>Sirovina</TH>
                      <TH>JM</TH>
                      <TH right>Količina</TH>
                      <TH right>Stanje</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {sastav.map((x, idx) => {
                      const { stanje, kol, nedostaje } = provjere[idx];
                      return (
                        <tr
                          key={x.sifra_sirovine}
                          className={`border-b border-gray-200 dark:border-[#3a3158] [&>td]:px-1 [&>td]:py-1 ${
                            nedostaje > 0 ? "bg-red-50 dark:bg-red-950/30" : ""
                          }`}
                        >
                          <td className="text-gray-800 dark:text-[#ede9f6]">{x.naziv_sirovine}</td>
                          <td className="text-gray-600 dark:text-[#c5bfd8]">{x.jm}</td>
                          <td className="text-right font-bold text-gray-800 dark:text-[#ede9f6] whitespace-nowrap">
                            {fmt(kol, 3)}
                          </td>
                          <td
                            className={`text-right whitespace-nowrap ${nedostaje > 0 ? "font-bold text-red-600 dark:text-red-400" : "text-gray-600 dark:text-[#c5bfd8]"}`}
                          >
                            {fmt(stanje, 3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {brojNedostaje > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Za {brojNedostaje} {brojNedostaje === 1 ? "sirovinu" : "sirovine"} nema dovoljno na
                  stanju.
                </div>
              )}

              <p className="text-gray-600 dark:text-[#c5bfd8]">
                Da li želite unijeti ovaj radni nalog?
              </p>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 dark:bg-[#1e1a2d] border-t border-gray-200 dark:border-[#2d2648]">
              <button
                onClick={() => setPotvrda(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
              >
                Otkaži
              </button>
              <button
                onClick={potvrdiUnos}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white hover:brightness-110"
                style={{ background: BOJA_UNOS }}
              >
                <Check size={16} />
                Potvrdi unos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PORUKA ── */}
      {poruka && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-amber-300 p-6 space-y-4">
            <p className="text-sm text-gray-700 dark:text-[#ede9f6]">{poruka}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setPoruka(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: BOJA }}
              >
                U redu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROIZVODI ── */}
      <Kartica
        ikona={<Package size={16} />}
        naslov="Proizvodi"
        brojac={`${filtriraniP.length} / ${proizvodi.length}`}
        alati={
          <>
            <Pretraga value={searchP} onChange={setSearchP} placeholder="Šifra, naziv proizvoda..." />
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              <Chip aktivan={grupaFilter === ""} onClick={() => setGrupaFilter("")}>
                Sve grupe
              </Chip>
              {grupe.map((g) => (
                <Chip
                  key={g.sifra}
                  aktivan={grupaFilter === g.sifra}
                  onClick={() => setGrupaFilter(g.sifra)}
                >
                  {g.naziv}
                </Chip>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={samoSaNormativom}
                  onChange={(e) => setSamoSaNormativom(e.target.checked)}
                  className="accent-[#0d9488]"
                />
                Samo sa normativom
              </label>
            </div>
          </>
        }
      >
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <TH>Šifra</TH>
                <TH>Proizvod</TH>
                <TH>JM</TH>
                <TH right>Stanje M1</TH>
              </tr>
            </thead>
            <tbody>
              {filtriraniP.map((p) => {
                const aktivan = proizvod?.sifra_proizvoda === p.sifra_proizvoda;
                return (
                  <tr
                    key={p.sifra_proizvoda}
                    onClick={() => izaberiProizvod(p)}
                    title={p.ima_normativ ? "Proizvod ima normativ" : "Proizvod nema normativ"}
                    className={`cursor-pointer border-b border-gray-200 dark:border-[#3a3158] transition-colors [&>td]:px-1 [&>td]:py-1 [&>td]:whitespace-nowrap ${
                      aktivan
                        ? "bg-teal-100 dark:bg-teal-900/40"
                        : p.ima_normativ
                          ? "bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                          : "hover:bg-purple-50/60 dark:hover:bg-[#2d2648]"
                    }`}
                    style={aktivan ? { boxShadow: `inset 3px 0 0 ${BOJA}` } : {}}
                  >
                    <td className="text-[10px] text-gray-400 dark:text-[#5f5878]">{p.sifra_proizvoda}</td>
                    <td className="w-full font-semibold text-gray-800 dark:text-[#ede9f6] !whitespace-normal">
                      {p.naziv_proizvoda}
                    </td>
                    <td className="text-gray-600 dark:text-[#c5bfd8]">{p.jm}</td>
                    <td
                      className={`text-right font-bold ${p.stanje_m1 > 0 ? "text-gray-800 dark:text-[#ede9f6]" : "text-gray-300 dark:text-[#5f5878]"}`}
                    >
                      {fmt(p.stanje_m1, 3)}
                    </td>
                  </tr>
                );
              })}
              {filtriraniP.length === 0 && praznaCelija("Nema proizvoda za prikaz.", 4)}
            </tbody>
          </table>
        </div>
      </Kartica>
    </div>
  );
}
