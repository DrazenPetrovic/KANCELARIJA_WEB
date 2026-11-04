import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  Undo2,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

interface SintetikaRed {
  sifra_partnera: number;
  naziv_partnera: string | null;
  adresa_partnera: string | null;
  // Naziv kolone dolazi iz pogleda ziralni.q_partneri, s velikim početnim slovom.
  Naziv_grada: string | null;
  ukupno_rac: number | string | null;
  ukupno_uplata: number | string | null;
  saldo: number | string | null;
  konto: string | number | null;
}

function formatIznos(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "–";
  const [cijeliDio, decimalniDio] = Number(v).toFixed(2).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const grupisano = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negativan ? "-" : ""}${grupisano}.${decimalniDio} KM`;
}

const danasnjiDatum = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Vrijednost je yyyy-MM-dd, prikaz dd.MM.yyyy; klik bilo gdje otvara kalendar.
function DatumPolje({
  value,
  onChange,
}: {
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
  const [godina, mjesec, dan] = value.split("-");
  return (
    <div className="relative w-36 cursor-pointer" onClick={otvoriPicker}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        style={{ color: "transparent" }}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
      />
      <div className="absolute inset-0 flex items-center px-3 text-sm tabular-nums pointer-events-none text-gray-800 dark:text-[#ede9f6]">
        {`${dan}.${mjesec}.${godina}`}
      </div>
    </div>
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
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

type SortPolje = "sifra" | "naziv";
type SmjerSortiranja = "asc" | "desc";

const SortableTH = ({
  children,
  aktivno,
  smjer,
  onClick,
}: {
  children: React.ReactNode;
  aktivno: boolean;
  smjer: SmjerSortiranja;
  onClick: () => void;
}) => (
  <th
    onClick={onClick}
    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white text-left cursor-pointer select-none"
    style={{ background: PRIMARY }}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {aktivno ? (
        smjer === "asc" ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-50" />
      )}
    </span>
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
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

// Jedna stavka prometa — vidi erp.kartica_partnera_pregled.
interface KarticaStavka {
  rb: number;
  datum: string | null;
  opis: string | null;
  duguje: number;
  potrazuje: number;
  saldo: number;
  izvor_id: number | null;
  vrsta_prometa: number;
  vrsta_prometa_opis: string;
  vrsta_uplate_opis: string | null;
}

// vrsta_prometa: 1 račun, 2 kalkulacija, 3 KUF, 4 početno stanje, 5 uplata.
const VRSTA_PROMETA_UPLATA = 5;

// Plaćenost se preko erp.izvodi_uplate_azuriranje_placenosti može označiti
// samo za račune i kalkulacije — KUF nema tu mogućnost.
const TIP_DOKUMENTA_PLACENOST: Record<number, "RACUN" | "KALKULACIJA"> = {
  1: "RACUN",
  2: "KALKULACIJA",
};

// Knjižna odobrenja (opis "KO MP-...", "KO VP-...", "KO USLUGA-...") se ne
// vraćaju u neplaćene.
const jeKnjiznoOdobrenje = (s: KarticaStavka) =>
  Number(s.vrsta_prometa) === 1 && !!s.opis?.startsWith("KO ");

function TabelaStavki({
  naslov,
  stavke,
  iznos,
  placen,
  siriOpis,
  promijeniPlacenost,
}: {
  naslov: string;
  stavke: KarticaStavka[];
  iznos: (s: KarticaStavka) => number;
  placen?: (s: KarticaStavka) => boolean;
  siriOpis?: boolean;
  promijeniPlacenost?: (s: KarticaStavka, placen: 0 | 1) => Promise<void>;
}) {
  const [oznacava, setOznacava] = useState<number | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const brojKolona = promijeniPlacenost ? 5 : 4;

  const [zaPotvrdu, setZaPotvrdu] = useState<{
    stavka: KarticaStavka;
    placen: 0 | 1;
  } | null>(null);

  const klikOznaci = (s: KarticaStavka, novoPlacen: 0 | 1) => {
    if (!promijeniPlacenost || oznacava !== null) return;
    setGreska(null);
    setZaPotvrdu({ stavka: s, placen: novoPlacen });
  };

  const potvrdiOznacavanje = async () => {
    if (!promijeniPlacenost || !zaPotvrdu || oznacava !== null) return;
    setOznacava(zaPotvrdu.stavka.rb);
    setGreska(null);
    try {
      await promijeniPlacenost(zaPotvrdu.stavka, zaPotvrdu.placen);
      setZaPotvrdu(null);
    } catch (e) {
      setGreska(
        e instanceof Error ? e.message : "Greška pri ažuriranju plaćenosti",
      );
    } finally {
      setOznacava(null);
    }
  };

  const ukupno = stavke.reduce((z, s) => z + iznos(s), 0);
  // Najnoviji dokument prvi; stavke bez datuma (početno stanje) idu na kraj.
  const vrijeme = (s: KarticaStavka) =>
    s.datum ? new Date(s.datum.replace(" ", "T")).getTime() : -Infinity;
  const sortirane = [...stavke].sort((a, b) => vrijeme(b) - vrijeme(a));
  return (
    <div className="flex-1 min-w-[360px]">
      <div
        className="mb-1.5 text-xs font-bold uppercase tracking-wide"
        style={{ color: PRIMARY }}
      >
        {naslov}
      </div>
      <div className="rounded-xl border-2 border-red-500 overflow-hidden">
        <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <TH>Datum</TH>
                <TH>Vrsta</TH>
                <TH>Opis</TH>
                <TH right>Iznos</TH>
                {promijeniPlacenost && <TH>{null}</TH>}
              </tr>
            </thead>
            <tbody>
              {stavke.length === 0 && (
                <tr>
                  <td
                    colSpan={brojKolona}
                    className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                  >
                    Nema stavki
                  </td>
                </tr>
              )}
              {sortirane.map((s) => (
                <tr
                  key={s.rb}
                  className={`border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1 ${placen?.(s) ? "bg-green-100/70 dark:bg-green-900/30" : ""}`}
                >
                  <TD>{formatDatum(s.datum)}</TD>
                  <TD>{s.vrsta_uplate_opis || s.vrsta_prometa_opis}</TD>
                  <TD>
                    <span
                      className={
                        siriOpis
                          ? "block min-w-[320px] max-w-[560px] whitespace-normal"
                          : "block max-w-[240px] truncate"
                      }
                      title={s.opis ?? undefined}
                    >
                      {s.opis || "—"}
                    </span>
                  </TD>
                  <TD right>{formatIznos(iznos(s))}</TD>
                  {promijeniPlacenost && (
                    <TD>
                      {s.izvor_id != null &&
                        TIP_DOKUMENTA_PLACENOST[Number(s.vrsta_prometa)] &&
                        (!placen?.(s) ? (
                          <button
                            type="button"
                            onClick={() => klikOznaci(s, 1)}
                            disabled={oznacava !== null}
                            title="Označi kao plaćen"
                            className="p-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40"
                          >
                            {oznacava === s.rb ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Banknote size={14} />
                            )}
                          </button>
                        ) : (
                          !jeKnjiznoOdobrenje(s) && (
                            <button
                              type="button"
                              onClick={() => klikOznaci(s, 0)}
                              disabled={oznacava !== null}
                              title="Vrati u neplaćene"
                              className="p-1 rounded-lg text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-40"
                            >
                              {oznacava === s.rb ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Undo2 size={14} />
                              )}
                            </button>
                          )
                        ))}
                    </TD>
                  )}
                </tr>
              ))}
            </tbody>
            {stavke.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d] [&>td]:py-1">
                  <TD bold>Ukupno</TD>
                  <TD>{null}</TD>
                  <TD>{null}</TD>
                  <TD right bold>
                    {formatIznos(ukupno)}
                  </TD>
                  {promijeniPlacenost && <TD>{null}</TD>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {zaPotvrdu &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[460px] max-w-[95vw] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ background: PRIMARY }}
              >
                {zaPotvrdu.placen === 1 ? (
                  <Banknote size={18} className="text-white flex-shrink-0" />
                ) : (
                  <Undo2 size={18} className="text-white flex-shrink-0" />
                )}
                <div className="font-bold text-white text-base">
                  {zaPotvrdu.placen === 1
                    ? "Označavanje plaćenosti"
                    : "Vraćanje u neplaćene"}
                </div>
              </div>

              <div className="px-5 py-4 space-y-3 text-sm text-gray-600 dark:text-[#c5bfd8]">
                <p>
                  Da li želite označiti{" "}
                  {zaPotvrdu.stavka.vrsta_prometa_opis.toLowerCase()}{" "}
                  {zaPotvrdu.placen === 1 ? "plaćenim" : "neplaćenim"}?
                </p>
                <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] bg-[#faf9fc] dark:bg-[#1e1a2d] px-4 py-3 space-y-1">
                  <div className="font-bold text-gray-800 dark:text-[#ede9f6]">
                    {zaPotvrdu.stavka.opis || "—"}
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{formatDatum(zaPotvrdu.stavka.datum)}</span>
                    <span className="font-bold text-gray-800 dark:text-[#ede9f6]">
                      {formatIznos(iznos(zaPotvrdu.stavka))}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  Izmjena se odmah upisuje u bazu.
                </div>
                {greska && (
                  <div className="text-xs font-medium text-red-500">
                    {greska}
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-[#2d2648]">
                <button
                  type="button"
                  onClick={() => setZaPotvrdu(null)}
                  disabled={oznacava !== null}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={() => void potvrdiOznacavanje()}
                  disabled={oznacava !== null}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 ${zaPotvrdu.placen === 1 ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}`}
                >
                  {oznacava !== null && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {zaPotvrdu.placen === 1
                    ? "Označi plaćenim"
                    : "Označi neplaćenim"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const formatDatum = (v: string | null) => {
  if (!v) return "–";
  const [godina, mjesec, dan] = v.slice(0, 10).split("-");
  return `${dan}.${mjesec}.${godina}.`;
};

// Dokumenti partnera do izabranog datuma: kupac (konto 1) ima račune i uplate,
// a dobavljač (konto 2) kalkulacije, KUF i uplate. Procedura nema parametar za
// datum, pa se stavke filtriraju ovdje.
function StavkePartnera({
  sifraPartnera,
  konto,
  datum,
}: {
  sifraPartnera: number;
  konto: number;
  datum: string;
}) {
  const [stavke, setStavke] = useState<KarticaStavka[]>([]);
  // Plaćeni dokumenti po vrsti prometa (1 račun, 2 kalkulacija, 3 KUF).
  const [placeni, setPlaceni] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ucitaj = (url: string) =>
      fetch(url, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(),
      );
    Promise.all([
      ucitaj(`${API_URL}/api/kartice/partner/${sifraPartnera}`),
      ucitaj(
        `${API_URL}/api/partneri/sintetika/${sifraPartnera}/placeni?konto=${konto}`,
      ),
    ])
      .then(([k, p]) => {
        if (cancelled) return;
        const kartica = konto === 1 ? k.data?.kupac : k.data?.dobavljac;
        setStavke(kartica?.stavke ?? []);
        setPlaceni({
          1: new Set(p.data?.racuni ?? []),
          2: new Set(p.data?.kalkulacije ?? []),
          3: new Set(p.data?.kuf ?? []),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Greška pri učitavanju dokumenata");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sifraPartnera, konto]);

  const prikazane = useMemo(
    () => stavke.filter((s) => !s.datum || s.datum.slice(0, 10) <= datum),
    [stavke, datum],
  );
  const dokumenti = prikazane.filter(
    (s) => Number(s.vrsta_prometa) !== VRSTA_PROMETA_UPLATA,
  );
  const uplate = prikazane.filter(
    (s) => Number(s.vrsta_prometa) === VRSTA_PROMETA_UPLATA,
  );
  // Kupcu dokumenti povećavaju dug (duguje), a uplate ga smanjuju (potražuje);
  // kod dobavljača je obrnuto. Pozajmice i povrati pretplate idu sa minusom.
  const iznosDokumenta = (s: KarticaStavka) =>
    konto === 1 ? Number(s.duguje) : Number(s.potrazuje);
  const iznosUplate = (s: KarticaStavka) =>
    konto === 1
      ? Number(s.potrazuje) - Number(s.duguje)
      : Number(s.duguje) - Number(s.potrazuje);

  // Isto kao kod unosa uplata iz izvoda — erp.izvodi_uplate_azuriranje_placenosti.
  const promijeniPlacenost = async (s: KarticaStavka, placen: 0 | 1) => {
    const vrsta = Number(s.vrsta_prometa);
    const res = await fetch(`${API_URL}/api/izvodi/azuriranje-placenosti`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dokumenti: [
          {
            tip_dokumenta: TIP_DOKUMENTA_PLACENOST[vrsta],
            sifra_dokumenta: s.izvor_id,
            placen,
          },
        ],
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) {
      throw new Error(d.message || d.error || "Greška pri ažuriranju plaćenosti");
    }
    setPlaceni((prev) => {
      const skup = new Set(prev[vrsta]);
      if (placen === 1) skup.add(Number(s.izvor_id));
      else skup.delete(Number(s.izvor_id));
      return { ...prev, [vrsta]: skup };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2
          size={16}
          className="animate-spin"
          style={{ color: PRIMARY }}
        />
        <span className="text-sm text-gray-500 dark:text-[#7d7498]">
          Učitavanje...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-3 py-8 text-center text-sm text-red-500 dark:text-red-400">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <TabelaStavki
        naslov={konto === 1 ? "Računi" : "Kalkulacije i KUF"}
        stavke={dokumenti}
        iznos={iznosDokumenta}
        placen={(s) =>
          s.izvor_id != null &&
          !!placeni[Number(s.vrsta_prometa)]?.has(Number(s.izvor_id))
        }
        promijeniPlacenost={promijeniPlacenost}
      />
      <TabelaStavki
        naslov="Uplate"
        stavke={uplate}
        iznos={iznosUplate}
        siriOpis
      />
    </div>
  );
}

export function SintetikaPartnera() {
  const [data, setData] = useState<SintetikaRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [datum, setDatum] = useState(danasnjiDatum);
  const [prikaziBezPrometa, setPrikaziBezPrometa] = useState(false);
  const [sakrijSaldoNula, setSakrijSaldoNula] = useState(false);
  const [kontoFilter, setKontoFilter] = useState("");
  const [sortPolje, setSortPolje] = useState<SortPolje>("sifra");
  const [sortSmjer, setSortSmjer] = useState<SmjerSortiranja>("asc");
  const [otvoreniRed, setOtvoreniRed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/partneri/sintetika?datum=${datum}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setData(d.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Greška pri učitavanju sintetike partnera");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datum]);

  const filtrirani = useMemo(() => {
    const q = pretraga.toLowerCase().trim();
    const smjer = sortSmjer === "asc" ? 1 : -1;
    return data
      .filter(
        (r) =>
          (prikaziBezPrometa ||
            Number(r.ukupno_rac) !== 0 ||
            Number(r.ukupno_uplata) !== 0) &&
          (!sakrijSaldoNula || Number(r.saldo) !== 0) &&
          (!kontoFilter || String(r.konto) === kontoFilter) &&
          (!q ||
            String(r.sifra_partnera).includes(q) ||
            r.naziv_partnera?.toLowerCase().includes(q) ||
            r.adresa_partnera?.toLowerCase().includes(q) ||
            r.Naziv_grada?.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        sortPolje === "sifra"
          ? (a.sifra_partnera - b.sifra_partnera) * smjer
          : (a.naziv_partnera ?? "").localeCompare(
              b.naziv_partnera ?? "",
              "sr",
            ) * smjer,
      );
  }, [
    data,
    pretraga,
    prikaziBezPrometa,
    sakrijSaldoNula,
    kontoFilter,
    sortPolje,
    sortSmjer,
  ]);

  const promijeniSortiranje = (polje: SortPolje) => {
    if (sortPolje === polje) {
      setSortSmjer((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortPolje(polje);
      setSortSmjer("asc");
    }
  };

  return (
    <div className="space-y-2 w-fit max-w-full mx-auto">
      {/* Pretraga */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv, adresa, grad..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <DatumPolje value={datum} onChange={setDatum} />

          <select
            value={kontoFilter}
            onChange={(e) => setKontoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            <option value="">Kupci i dobavljači</option>
            <option value="1">Kupci</option>
            <option value="2">Dobavljači</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#c5bfd8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={prikaziBezPrometa}
              onChange={(e) => setPrikaziBezPrometa(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#785E9E]"
            />
            Prikaži i partnere bez prometa
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#c5bfd8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sakrijSaldoNula}
              onChange={(e) => setSakrijSaldoNula(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#785E9E]"
            />
            Sakrij partnere sa saldom 0
          </label>

          {!loading && !error && (
            <span className="ml-auto text-xs text-gray-400 dark:text-[#5f5878]">
              Ukupno: {filtrirani.length} / {data.length}
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="w-full min-w-[320px] bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
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

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && filtrirani.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              Nema podataka za prikaz.
            </p>
          </div>
        )}

        {!loading && !error && filtrirani.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-auto text-sm">
              <thead>
                <tr>
                  <TH>{null}</TH>
                  <SortableTH
                    aktivno={sortPolje === "sifra"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("sifra")}
                  >
                    Šifra
                  </SortableTH>
                  <SortableTH
                    aktivno={sortPolje === "naziv"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("naziv")}
                  >
                    Naziv
                  </SortableTH>
                  <TH>Adresa</TH>
                  <TH>Grad</TH>
                  <TH right>Računi</TH>
                  <TH right>Uplate</TH>
                  <TH right>Saldo</TH>
                  <TH>Konto</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r) => {
                  const kljuc = `${r.sifra_partnera}-${r.konto}`;
                  const otvoren = otvoreniRed === kljuc;
                  return (
                    <Fragment key={kljuc}>
                      <tr
                        className={`border-b border-gray-200 dark:border-[#3a3158] ${Number(r.saldo) === 0 ? "bg-green-100/70 dark:bg-green-900/30" : ""} ${Number(r.konto) === 2 ? "[&_*]:!text-red-500" : ""}`}
                      >
                        <TD>
                          <button
                            type="button"
                            onClick={() =>
                              setOtvoreniRed(otvoren ? null : kljuc)
                            }
                            title={otvoren ? "Zatvori" : "Prikaži dokumente"}
                            className="p-1 rounded-lg hover:bg-[#ede8f5] dark:hover:bg-[#312a50] transition-colors"
                            style={{ color: PRIMARY }}
                          >
                            {otvoren ? <Minus size={14} /> : <Plus size={14} />}
                          </button>
                        </TD>
                        <TD>
                          <span
                            className="font-mono font-semibold text-xs"
                            style={{ color: PRIMARY }}
                          >
                            {r.sifra_partnera}
                          </span>
                        </TD>
                        <TD bold>{r.naziv_partnera || "—"}</TD>
                        <TD>{r.adresa_partnera || "—"}</TD>
                        <TD>{r.Naziv_grada || "—"}</TD>
                        <TD right>{formatIznos(r.ukupno_rac)}</TD>
                        <TD right>{formatIznos(r.ukupno_uplata)}</TD>
                        <TD right bold>
                          <span
                            className={
                              Number(r.saldo) < 0 ? "text-red-500" : ""
                            }
                          >
                            {formatIznos(r.saldo)}
                          </span>
                        </TD>
                        <TD>
                          {Number(r.konto) === 1 ? (
                            <span title="Kupac">
                              <ShoppingCart
                                size={15}
                                style={{ color: PRIMARY }}
                              />
                            </span>
                          ) : (
                            <span title="Dobavljač">
                              <Truck size={15} className="text-amber-600" />
                            </span>
                          )}
                        </TD>
                      </tr>
                      {otvoren && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-3 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                          >
                            <StavkePartnera
                              sifraPartnera={r.sifra_partnera}
                              konto={Number(r.konto)}
                              datum={datum}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
