import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  FileText,
  ListOrdered,
  Loader2,
  RefreshCcw,
  Search,
  Tags,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const ROBA_BOJA = ACCENT;
const PROIZVODI_BOJA = "#E0913A";

// Red sa erp.nivelacija_gl_pregled() — zaglavlje nivelacije.
interface NivelacijaGlavna {
  sifra_nivelacije: number;
  datum_nivelacije: string;
  ukupno_staro: number | string;
  ukupno_novo: number | string;
  nivelacija_robe: number | string;
}

// Red sa erp.nivelacija_po_pregled() — stavka (proizvod) nivelacije.
interface NivelacijaStavka {
  sifra_nivelacije: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string | null;
  jm: string | null;
  kolicina_proizvoda: number | string;
  cijena_stara: number | string;
  cijena_nova: number | string;
}

type BrziFilter = "sve" | "roba" | "proizvodi";

const BRZI_FILTERI: { kod: BrziFilter; naziv: string; boja: string }[] = [
  { kod: "sve", naziv: "Sve", boja: PRIMARY },
  { kod: "roba", naziv: "Roba", boja: ROBA_BOJA },
  { kod: "proizvodi", naziv: "Proizvodi", boja: PROIZVODI_BOJA },
];

const broj = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatBroj = (v: unknown, decimale = 2) =>
  broj(v)
    .toLocaleString("en-US", {
      minimumFractionDigits: decimale,
      maximumFractionDigits: decimale,
    })
    .replace(/,/g, " ");

const formatIznos = (v: unknown) => `${formatBroj(v)} KM`;

const pad = (n: number) => String(n).padStart(2, "0");

// Lokalni datum kao yyyy-MM-dd (bez toISOString, koji pomjera dan zbog UTC-a).
const formatDatumISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const prviDanMjeseca = () => {
  const d = new Date();
  return formatDatumISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => formatDatumISO(new Date());

const formatDatumDMY = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const formatDatumVrijeme = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const jeRoba = (n: NivelacijaGlavna) => broj(n.nivelacija_robe) === 1;

// Isti izgled kao StatTile u KarticaProizvoda — "prazno" (0) je sivo sa
// crvenim okvirom.
function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
  prazno,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
  prazno?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl shadow-sm px-4 py-3 flex-1 min-w-[150px] min-h-[60px] ${
        prazno
          ? "bg-gray-100 dark:bg-[#1a1626] border-2 border-red-300 dark:border-red-900/70"
          : "bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648]"
      }`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div
          className={`text-lg font-bold leading-tight whitespace-nowrap ${
            prazno
              ? "text-gray-400 dark:text-[#7d7498]"
              : "text-gray-800 dark:text-[#ede9f6]"
          }`}
        >
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

const TH = ({
  children,
  right,
  sekundarno,
}: {
  children?: React.ReactNode;
  right?: boolean;
  // Zaglavlje glavne tabele je u primarnoj boji; sekundarno (zelena) je za
  // tabelu stavki ispod reda.
  sekundarno?: boolean;
}) => (
  <th
    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: sekundarno ? ACCENT : PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  className?: string;
}) => (
  <td
    className={`px-2 py-2 whitespace-nowrap ${right ? "text-right tabular-nums" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"} ${className}`}
  >
    {children}
  </td>
);

const Znacka = ({ tekst, boja }: { tekst: string; boja: string }) => (
  <span
    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
    style={{ background: `${boja}1f`, color: boja }}
  >
    {tekst}
  </span>
);

// Otvorena nivelacija (red iz glavne tabele + njene stavke) ima istu pozadinu
// da izgleda kao jedna cjelina.
const OTVORENA_POZADINA = "bg-[#eef6e4] dark:bg-[#1f2a1c]";

const bojaRazlike = (v: number) =>
  v > 0 ? "!text-green-600" : v < 0 ? "!text-red-500" : "";

export function NivelacijePregled() {
  const [datumOd, setDatumOd] = useState(prviDanMjeseca());
  const [datumDo, setDatumDo] = useState(danas());
  // Primijenjeni period — mijenja se samo na klik "Prikaži".
  const [primenjeniOd, setPrimenjeniOd] = useState(datumOd);
  const [primenjeniDo, setPrimenjeniDo] = useState(datumDo);
  const [pretraga, setPretraga] = useState("");
  const [brziFilter, setBrziFilter] = useState<BrziFilter>("sve");
  const [nivelacije, setNivelacije] = useState<NivelacijaGlavna[]>([]);
  const [stavke, setStavke] = useState<NivelacijaStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [otvorene, setOtvorene] = useState<Set<number>>(new Set());
  const datumOdRef = useRef<HTMLInputElement>(null);
  const datumDoRef = useRef<HTMLInputElement>(null);

  const otvoriPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };

  const dohvati = async <T,>(putanja: string, poruka: string): Promise<T[]> => {
    const res = await fetch(`${API_URL}${putanja}`, { credentials: "include" });
    if (!res.ok) throw new Error(poruka);
    const json = await res.json();
    return json.data ?? [];
  };

  // Procedure ne primaju parametre (vraćaju sve) — period i pretraga se
  // filtriraju ovdje, a stavke se grupišu po šifri nivelacije.
  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    Promise.all([
      dohvati<NivelacijaGlavna>(
        "/api/nivelacije/glavni",
        "Greška pri učitavanju nivelacija",
      ),
      dohvati<NivelacijaStavka>(
        "/api/nivelacije/stavke",
        "Greška pri učitavanju stavki nivelacija",
      ),
    ])
      .then(([gl, po]) => {
        setNivelacije(gl);
        setStavke(po);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  const prikazi = () => {
    setPrimenjeniOd(datumOd);
    setPrimenjeniDo(datumDo);
    ucitaj();
  };

  const stavkePoNivelaciji = useMemo(() => {
    const m = new Map<number, NivelacijaStavka[]>();
    for (const s of stavke) {
      const kljuc = Number(s.sifra_nivelacije);
      const lista = m.get(kljuc);
      if (lista) lista.push(s);
      else m.set(kljuc, [s]);
    }
    return m;
  }, [stavke]);

  const filtrirano = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    return nivelacije
      .filter((n) => {
        const d = new Date(n.datum_nivelacije);
        if (isNaN(d.getTime())) return false;
        const dan = formatDatumISO(d);
        if (primenjeniOd && dan < primenjeniOd) return false;
        if (primenjeniDo && dan > primenjeniDo) return false;
        if (brziFilter === "roba" && !jeRoba(n)) return false;
        if (brziFilter === "proizvodi" && jeRoba(n)) return false;
        if (!q) return true;
        if (String(n.sifra_nivelacije) === q) return true;
        // Pretraga i po proizvodima unutar nivelacije (šifra ili naziv).
        return (stavkePoNivelaciji.get(Number(n.sifra_nivelacije)) ?? []).some(
          (s) =>
            String(s.sifra_proizvoda) === q ||
            (s.naziv_proizvoda ?? "").toLowerCase().includes(q),
        );
      })
      .sort((a, b) => {
        const t =
          new Date(b.datum_nivelacije).getTime() -
          new Date(a.datum_nivelacije).getTime();
        return t !== 0 ? t : Number(b.sifra_nivelacije) - Number(a.sifra_nivelacije);
      });
  }, [
    nivelacije,
    stavkePoNivelaciji,
    pretraga,
    brziFilter,
    primenjeniOd,
    primenjeniDo,
  ]);

  const ukupnoStaro = filtrirano.reduce((s, n) => s + broj(n.ukupno_staro), 0);
  const ukupnoNovo = filtrirano.reduce((s, n) => s + broj(n.ukupno_novo), 0);
  const ukupnaRazlika = ukupnoNovo - ukupnoStaro;
  const brojRoba = filtrirano.filter(jeRoba).length;
  const brojProizvoda = filtrirano.length - brojRoba;
  const brojStavki = filtrirano.reduce(
    (s, n) =>
      s + (stavkePoNivelaciji.get(Number(n.sifra_nivelacije))?.length ?? 0),
    0,
  );

  // Sve stavke filtriranih nivelacija u jednoj nevidljivoj tabeli — njena
  // širina je širina najšire moguće tabele stavki (table-auto kolone se šire
  // po najdužem sadržaju), pa glavna tabela unaprijed dobije toliko mjesta.
  const sveFiltriraneStavke = useMemo(
    () =>
      filtrirano.flatMap(
        (n) => stavkePoNivelaciji.get(Number(n.sifra_nivelacije)) ?? [],
      ),
    [filtrirano, stavkePoNivelaciji],
  );

  // Širina glavne tabele = veće od: 115% njene prirodne (table-auto) širine,
  // ili širina najšire tabele stavki + padding ćelije. Stalna je — ne mijenja
  // se pri otvaranju/zatvaranju nivelacija, a stavke staju bez klizača.
  const glavnaTabelaRef = useRef<HTMLTableElement>(null);
  const mjeraStavkiRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const t = glavnaTabelaRef.current;
    if (!t) return;
    t.style.minWidth = "";
    const prirodna = Math.ceil(t.offsetWidth * 1.15);
    const stavkeSirina = mjeraStavkiRef.current
      ? mjeraStavkiRef.current.offsetWidth + 28 // px-3 ćelije (2×12) + okvir
      : 0;
    t.style.minWidth = `${Math.max(prirodna, stavkeSirina)}px`;
  }, [filtrirano, sveFiltriraneStavke, loading]);

  // Traka filtera iznad je iste širine kao glavna tabela — prati se stvarna
  // širina okvira tabele (mijenja se sa sadržajem i veličinom prozora).
  const glavniOkvirRef = useRef<HTMLDivElement>(null);
  const [sirinaGlavne, setSirinaGlavne] = useState<number | null>(null);
  useEffect(() => {
    const el = glavniOkvirRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSirinaGlavne(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prebaci = (sifra: number) =>
    setOtvorene((prev) => {
      const s = new Set(prev);
      if (s.has(sifra)) s.delete(sifra);
      else s.add(sifra);
      return s;
    });

  const datumPolje = (
    naziv: string,
    vrijednost: string,
    postavi: (v: string) => void,
    ref: React.RefObject<HTMLInputElement>,
  ) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
        {naziv}
      </span>
      <div
        className="relative cursor-pointer"
        onClick={() => otvoriPicker(ref)}
      >
        <input
          ref={ref}
          type="date"
          value={vrijednost}
          onChange={(e) => postavi(e.target.value)}
          style={{ color: "transparent" }}
          className="w-32 px-2.5 py-1.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-lg focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
        />
        <div className="absolute inset-0 flex items-center px-2.5 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
          {formatDatumDMY(vrijednost) ?? "Izaberite"}
        </div>
      </div>
    </div>
  );

  const renderStavke = (lista: NivelacijaStavka[]) => {
    const zbirStaro = lista.reduce(
      (s, r) => s + broj(r.kolicina_proizvoda) * broj(r.cijena_stara),
      0,
    );
    const zbirNovo = lista.reduce(
      (s, r) => s + broj(r.kolicina_proizvoda) * broj(r.cijena_nova),
      0,
    );
    return (
      <div className="w-fit max-w-full mx-auto rounded-xl border border-[#8FC74A]/40 overflow-x-auto">
        <table className="table-auto text-sm">
          <thead>
            <tr>
              <TH sekundarno>#</TH>
              <TH sekundarno>Šifra</TH>
              <TH sekundarno>Proizvod</TH>
              <TH sekundarno>JM</TH>
              <TH sekundarno right>Količina</TH>
              <TH sekundarno right>Stara cijena</TH>
              <TH sekundarno right>Nova cijena</TH>
              <TH sekundarno right>Promjena %</TH>
              <TH sekundarno right>Iznos staro</TH>
              <TH sekundarno right>Iznos novo</TH>
              <TH sekundarno right>Razlika</TH>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-6 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                >
                  Nivelacija nema stavki.
                </td>
              </tr>
            )}
            {lista.map((s, i) => {
              const kol = broj(s.kolicina_proizvoda);
              const stara = broj(s.cijena_stara);
              const nova = broj(s.cijena_nova);
              const razlika = kol * (nova - stara);
              return (
                <tr
                  key={`${s.sifra_proizvoda}-${i}`}
                  className="border-b border-gray-200 dark:border-[#3a3158]"
                >
                  <TD>{i + 1}</TD>
                  <TD className="font-mono text-xs">{s.sifra_proizvoda}</TD>
                  <TD bold>{s.naziv_proizvoda || "—"}</TD>
                  <TD>{s.jm || "—"}</TD>
                  <TD right>{formatBroj(kol, 3)}</TD>
                  <TD right>{formatBroj(stara)}</TD>
                  <TD right bold>
                    {formatBroj(nova)}
                  </TD>
                  <TD right className={bojaRazlike(nova - stara)}>
                    {stara > 0
                      ? `${formatBroj(((nova - stara) / stara) * 100)} %`
                      : "—"}
                  </TD>
                  <TD right>{formatBroj(kol * stara)}</TD>
                  <TD right>{formatBroj(kol * nova)}</TD>
                  <TD right className={bojaRazlike(razlika)}>
                    {formatBroj(razlika)}
                  </TD>
                </tr>
              );
            })}
          </tbody>
          {lista.length > 1 && (
            <tfoot>
              <tr className="border-t-2 border-[#8FC74A]/40">
                <TD bold>Ukupno</TD>
                <td colSpan={7} />
                <TD right bold>
                  {formatBroj(zbirStaro)}
                </TD>
                <TD right bold>
                  {formatBroj(zbirNovo)}
                </TD>
                <TD right bold className={bojaRazlike(zbirNovo - zbirStaro)}>
                  {formatBroj(zbirNovo - zbirStaro)}
                </TD>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Naslov + filteri u jednom redu (kompaktno). Grid 1fr|auto|1fr drži
          filtere tačno na sredini ekrana, nezavisno od širine naslova. */}
      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <Tags size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight text-gray-800 dark:text-[#ede9f6]">
              Pregled nivelacija
            </h2>
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Klik na red prikazuje stavke
            </p>
          </div>
        </div>

        <div
          className="self-center max-w-full bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-2 flex flex-wrap items-center gap-2"
          style={sirinaGlavne ? { width: sirinaGlavne } : undefined}
        >
          {datumPolje("Od", datumOd, setDatumOd, datumOdRef)}
          {datumPolje("Do", datumDo, setDatumDo, datumDoRef)}
          <button
            type="button"
            onClick={prikazi}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            Prikaži
            {!loading && (
              <span className="ml-0.5 px-1.5 rounded-full bg-white/20 text-xs font-bold">
                {filtrirano.length}
              </span>
            )}
          </button>
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              placeholder="Br. nivelacije, šifra, naziv..."
              title="Broj nivelacije, šifra ili naziv proizvoda"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-lg focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            />
          </div>
          <div className="flex gap-1">
            {BRZI_FILTERI.map((f) => {
              const aktivan = brziFilter === f.kod;
              return (
                <button
                  key={f.kod}
                  type="button"
                  onClick={() => setBrziFilter(f.kod)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${aktivan ? "text-white" : "bg-white dark:bg-[#1e1a2d] border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:border-[#785E9E]"}`}
                  style={
                    aktivan
                      ? { background: f.boja, borderColor: f.boja }
                      : undefined
                  }
                >
                  {f.naziv}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {greska && (
        <div className="rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          {greska}
        </div>
      )}

      {/* Nevidljiva mjera najšire tabele stavki (vidi mjeraStavkiRef) */}
      <div
        aria-hidden
        className="fixed left-0 top-0 h-0 overflow-hidden invisible pointer-events-none"
      >
        <div ref={mjeraStavkiRef} className="inline-block">
          {renderStavke(sveFiltriraneStavke)}
        </div>
      </div>

      {/* Glavna tabela + vertikalna rekapitulacija (kao u kartici artikla) */}
      <div className="relative flex flex-col gap-4 xl:block">
        {/* Tabela — širina prati sadržaj, centrirano u odnosu na cijeli ekran */}
        <div
          ref={glavniOkvirRef}
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden w-fit max-w-full xl:max-w-[calc(100%-36rem)] mx-auto"
        >
          <div className="overflow-x-auto">
            <table ref={glavnaTabelaRef} className="table-auto text-sm">
              <thead>
                <tr>
                  <TH />
                  <TH>Broj</TH>
                  <TH>Datum</TH>
                  <TH>Vrsta</TH>
                  <TH right>Stavki</TH>
                  <TH right>Ukupno staro</TH>
                  <TH right>Ukupno novo</TH>
                  <TH right>Razlika</TH>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center">
                      <Loader2
                        size={20}
                        className="inline animate-spin"
                        style={{ color: PRIMARY }}
                      />
                    </td>
                  </tr>
                )}
                {!loading && filtrirano.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-10 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                    >
                      Nema nivelacija za izabrani period.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtrirano.map((n) => {
                    const sifra = Number(n.sifra_nivelacije);
                    const otvorena = otvorene.has(sifra);
                    const lista = stavkePoNivelaciji.get(sifra) ?? [];
                    const staro = broj(n.ukupno_staro);
                    const novo = broj(n.ukupno_novo);
                    return (
                      <Fragment key={sifra}>
                        <tr
                          onClick={() => prebaci(sifra)}
                          className={`cursor-pointer transition-colors ${otvorena ? OTVORENA_POZADINA : "border-b border-gray-200 dark:border-[#3a3158] hover:bg-purple-50/60 dark:hover:bg-[#2d2648]"}`}
                        >
                          <TD>
                            <ChevronRight
                              size={14}
                              className={`transition-transform duration-200 ${otvorena ? "rotate-90" : ""}`}
                              style={{ color: PRIMARY }}
                            />
                          </TD>
                          <TD bold>{sifra}</TD>
                          <TD>{formatDatumVrijeme(n.datum_nivelacije)}</TD>
                          <TD>
                            {jeRoba(n) ? (
                              <Znacka tekst="ROBA" boja={ROBA_BOJA} />
                            ) : (
                              <Znacka tekst="PROIZVODI" boja={PROIZVODI_BOJA} />
                            )}
                          </TD>
                          <TD right>{lista.length}</TD>
                          <TD right>{formatIznos(staro)}</TD>
                          <TD right bold>
                            {formatIznos(novo)}
                          </TD>
                          <TD right className={bojaRazlike(novo - staro)}>
                            {formatIznos(novo - staro)}
                          </TD>
                        </tr>
                        {otvorena && (
                          <tr
                            className={`${OTVORENA_POZADINA} border-b border-gray-200 dark:border-[#3a3158]`}
                          >
                            <td colSpan={8} className="px-3 pb-3 pt-1">
                              {/* Širina 0 + min-width 100%: stavke ne utiču na
                                  širinu glavne tabele, a unutar reda su
                                  centrirane (višak se pomjera vodoravno). */}
                              <div style={{ width: 0, minWidth: "100%" }}>
                                {renderStavke(lista)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && !greska && (
          <>
            {/* Lijevo — broj nivelacija, apsolutno pozicionirano (xl+) da
                tabela ostane centrirana prema cijelom ekranu */}
            <div className="flex flex-col gap-3 w-full xl:w-64 flex-shrink-0 xl:absolute xl:top-0 xl:left-[1%]">
              <div
                className="rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: PRIMARY }}
              >
                Nivelacije
              </div>
              <StatTile
                icon={<FileText size={16} />}
                vrijednost={String(filtrirano.length)}
                naziv="Broj nivelacija"
                boja={PRIMARY}
                prazno={filtrirano.length === 0}
              />
              <StatTile
                icon={<Tags size={16} />}
                vrijednost={String(brojRoba)}
                naziv="Nivelacija robe"
                boja={ROBA_BOJA}
              />
              <StatTile
                icon={<Tags size={16} />}
                vrijednost={String(brojProizvoda)}
                naziv="Nivelacija proizvoda"
                boja={PROIZVODI_BOJA}
              />
              <StatTile
                icon={<ListOrdered size={16} />}
                vrijednost={String(brojStavki)}
                naziv="Ukupno stavki"
                boja={PRIMARY}
              />
            </div>

            {/* Desno — finansijski zbirovi, na istoj visini kao lijevo */}
            <div className="flex flex-col gap-3 w-full xl:w-64 flex-shrink-0 xl:absolute xl:top-0 xl:right-[1%]">
              <div
                className="rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: PRIMARY }}
              >
                Financijsko stanje
              </div>
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatIznos(ukupnoStaro)}
                naziv="Ukupno staro"
                boja="#6b7280"
              />
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatIznos(ukupnoNovo)}
                naziv="Ukupno novo"
                boja={PRIMARY}
              />
              <StatTile
                icon={
                  ukupnaRazlika >= 0 ? (
                    <TrendingUp size={16} />
                  ) : (
                    <TrendingDown size={16} />
                  )
                }
                vrijednost={formatIznos(ukupnaRazlika)}
                naziv="Razlika (novo − staro)"
                boja={ukupnaRazlika >= 0 ? "#16a34a" : "#e0564f"}
                prazno={ukupnaRazlika === 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
