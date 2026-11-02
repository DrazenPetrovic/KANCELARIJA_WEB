import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Search,
  ShoppingCart,
  Truck,
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

export function SintetikaPartnera() {
  const [data, setData] = useState<SintetikaRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [datum, setDatum] = useState(danasnjiDatum);
  const [prikaziBezPrometa, setPrikaziBezPrometa] = useState(false);
  const [sakrijSaldoNula, setSakrijSaldoNula] = useState(false);
  const [sortPolje, setSortPolje] = useState<SortPolje>("sifra");
  const [sortSmjer, setSortSmjer] = useState<SmjerSortiranja>("asc");

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
  }, [data, pretraga, prikaziBezPrometa, sakrijSaldoNula, sortPolje, sortSmjer]);

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
                {filtrirani.map((r) => (
                  <tr
                    key={`${r.sifra_partnera}-${r.konto}`}
                    className={`border-b border-gray-200 dark:border-[#3a3158] ${Number(r.saldo) === 0 ? "bg-green-100/70 dark:bg-green-900/30" : ""} ${Number(r.konto) === 2 ? "[&_*]:!text-red-500" : ""}`}
                  >
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
                        className={Number(r.saldo) < 0 ? "text-red-500" : ""}
                      >
                        {formatIznos(r.saldo)}
                      </span>
                    </TD>
                    <TD>
                      {Number(r.konto) === 1 ? (
                        <span title="Kupac">
                          <ShoppingCart size={15} style={{ color: PRIMARY }} />
                        </span>
                      ) : (
                        <span title="Dobavljač">
                          <Truck size={15} className="text-amber-600" />
                        </span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
