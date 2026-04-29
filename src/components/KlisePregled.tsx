import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ClipboardList,
  Factory,
  Filter,
  HelpCircle,
  Layers,
  Loader2,
  Printer,
  Search,
  Wallet,
} from "lucide-react";
import { usePrint } from "../context/PrintContext";
import { useBaza } from "../context/BazaContext";
import { KlisePregledTemplate } from "../print/templates/KlisePregledTemplate";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

interface Klise {
  sifra: string;
  naziv_klisea: string;
  lokacija_partnera: string;
  dimenzija_za_stampu: string;
  povrsina_klisea: string;
  cijena_klisea: string;
  datum_narcucivanja: string;
  napomena: string;
  primljen_u_proizvodnju: number;
  naplacen_kancelarija: string;
  dobavljac_klisea: string;
  placeno_dobavljacu: number | string;
  povrsina_kod_dobavljaca: number | string;
  broj_racuna_od_dobavljaca: string;
  datum_racuna_od_dobavljaca: string;
  broj_nepopunjenih_polja: number;
}

const STATUS_CONFIG: Record<
  number,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  0: {
    bg: "#eff6ff",
    border: "#93c5fd",
    text: "#1d4ed8",
    icon: <ClipboardList size={13} />,
    label: "Naručen",
  },
  1: {
    bg: "#ede8f5",
    border: "#a78bdc",
    text: "#785E9E",
    icon: <Factory size={13} />,
    label: "Potvrđen u proizvodnji",
  },
  2: {
    bg: "#fefce8",
    border: "#fcd34d",
    text: "#b45309",
    icon: <Wallet size={13} />,
    label: "Kancelarija potvrdila naplatu",
  },
  3: {
    bg: "#edf7e0",
    border: "#86efac",
    text: "#15803d",
    icon: <BadgeCheck size={13} />,
    label: "Potvrđena cijena i površina",
  },
};

const NEPOZNAT = {
  bg: "#fef2f2",
  border: "#fca5a5",
  text: "#b91c1c",
  icon: <HelpCircle size={13} />,
  label: "Nepoznat status",
};

function StatusBadge({ status }: { status: number }) {
  const cfg = STATUS_CONFIG[status] ?? NEPOZNAT;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

const TH = ({
  children,
  center,
  narrow,
}: {
  children: React.ReactNode;
  center?: boolean;
  narrow?: boolean;
}) => (
  <th
    className={`${narrow ? "pl-1 pr-3" : "px-3"} py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${center ? "text-center" : "text-left"} bg-[#f4f1f9] dark:bg-[#2a2340]`}
    style={{ color: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  pending,
  noBorder,
  narrow,
  center,
}: {
  children: React.ReactNode;
  pending?: boolean;
  noBorder?: boolean;
  narrow?: boolean;
  center?: boolean;
}) => (
  <td
    className={`${narrow ? "pl-1 pr-3" : "px-3"} py-2.5 text-sm whitespace-nowrap ${
      noBorder ? "" : "border-b border-gray-100 dark:border-[#2d2648]"
    } ${pending ? "text-amber-500" : "text-gray-700 dark:text-[#c5bfd8]"} ${center ? "text-center" : ""}`}
  >
    {children}
  </td>
);

const STATUSI_OPTIONS = [
  { value: -1, label: "Svi statusi" },
  { value: 0, label: "Naručen" },
  { value: 1, label: "Potvrđen u proizvodnji" },
  { value: 2, label: "Kancelarija potvrdila naplatu" },
  { value: 3, label: "Potvrđena cijena i površina" },
];

export function KlisePregled() {
  const { openPrint } = usePrint();
  const { godina } = useBaza();
  const [data, setData] = useState<Klise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(-1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/klise/klise-pregled`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Greška pri učitavanju podataka");
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return data.filter((k) => {
      const matchSearch =
        search === "" ||
        k.naziv_klisea.toLowerCase().includes(search.toLowerCase()) ||
        k.sifra.toLowerCase().includes(search.toLowerCase()) ||
        k.dobavljac_klisea.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === -1 || k.primljen_u_proizvodnju === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]"
          >
            <Layers size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">Pregled kliša</h2>
            {!loading && !error && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Ukupno: {filtered.length} / {data.length}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() =>
            openPrint({
              title: `Pregled klišea${godina ? ` — Arhiva ${godina}` : ""}`,
              component: (
                <KlisePregledTemplate
                  data={filtered}
                  godina={godina}
                />
              ),
            })
          }
          disabled={loading || filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: PRIMARY }}
        >
          <Printer size={15} />
          Štampaj
        </button>
      </div>

      {/* Filter zona */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} style={{ color: PRIMARY }} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: PRIMARY }}
          >
            Filteri
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv, dobavljač..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-64 focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            {STATUSI_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div
            className="flex items-center px-3 py-2 text-xs text-gray-300 dark:text-[#5f5878] border border-dashed border-gray-200 dark:border-[#3a3158] rounded-xl"
            title="Prostor za dodatne filtere"
          >
            + filteri
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: PRIMARY }}
            />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">Učitavanje...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">Nema podataka za prikaz.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <TH>Šif</TH>
                  <TH narrow>Naziv kliša</TH>
                  <TH>Lokacija</TH>
                  <TH>Dimenzija</TH>
                  <TH narrow>Površina</TH>
                  <TH center>Cijena</TH>
                  <TH center>Datum</TH>
                  <TH center>Status</TH>
                  <TH center>Naplaćeno</TH>
                  <TH center>Dobavljač</TH>
                  <TH center>Plaćeno dob</TH>
                  <TH center>Površina</TH>
                  <TH center>Br. računa</TH>
                  <TH center>Datum računa</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k, i) => {
                  const hasPending = k.broj_nepopunjenih_polja > 0;
                  const rowBg = hasPending
                    ? "hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    : "hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40";
                  return (
                    <Fragment key={k.sifra ?? i}>
                      {/* Red 1 — podaci */}
                      <tr className={`transition-colors ${rowBg}`}>
                        <TD noBorder>
                          <span
                            className="font-mono font-semibold text-xs"
                            style={{ color: PRIMARY }}
                          >
                            {k.sifra}
                          </span>
                        </TD>
                        <TD noBorder narrow>
                          <span className="font-medium">{k.naziv_klisea}</span>
                        </TD>
                        <TD noBorder>{k.lokacija_partnera}</TD>
                        <TD noBorder>{k.dimenzija_za_stampu}</TD>
                        <TD noBorder narrow>
                          {k.povrsina_klisea}
                        </TD>
                        <TD noBorder center>
                          {k.cijena_klisea}
                        </TD>
                        <TD noBorder center>
                          {k.datum_narcucivanja}
                        </TD>
                        <TD noBorder center>
                          <StatusBadge status={k.primljen_u_proizvodnju} />
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={k.naplacen_kancelarija === "ceka"}
                        >
                          {k.naplacen_kancelarija === "ceka" ? "čeka" : k.naplacen_kancelarija}
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={k.dobavljac_klisea === "ceka"}
                        >
                          {k.dobavljac_klisea === "ceka" ? "čeka" : k.dobavljac_klisea}
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={Number(k.placeno_dobavljacu) < 0}
                        >
                          {Number(k.placeno_dobavljacu) < 0
                            ? "čeka"
                            : `${k.placeno_dobavljacu} KM`}
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={Number(k.povrsina_kod_dobavljaca) < 0}
                        >
                          {Number(k.povrsina_kod_dobavljaca) < 0
                            ? "čeka"
                            : `${k.povrsina_kod_dobavljaca} dm²`}
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={k.broj_racuna_od_dobavljaca === "ceka"}
                        >
                          {k.broj_racuna_od_dobavljaca === "ceka" ? "čeka" : k.broj_racuna_od_dobavljaca}
                        </TD>
                        <TD
                          noBorder
                          center
                          pending={k.datum_racuna_od_dobavljaca === "ceka"}
                        >
                          {k.datum_racuna_od_dobavljaca === "ceka" ? "čeka" : k.datum_racuna_od_dobavljaca}
                        </TD>
                      </tr>

                      {/* Red 2 — napomena */}
                      <tr className={`transition-colors ${rowBg}`}>
                        <td
                          colSpan={9}
                          className="px-4 pb-2.5 pt-0 text-xs border-b border-gray-100 dark:border-[#2d2648] text-gray-400 dark:text-[#5f5878]"
                        >
                          <span className="font-semibold text-gray-500 dark:text-[#7d7498]">
                            Napomena:{" "}
                          </span>
                          {k.napomena}
                        </td>
                        <td
                          colSpan={5}
                          className="px-3 pb-2.5 pt-0 text-xs border-b border-gray-100 dark:border-[#2d2648] text-center"
                        >
                          {Number(k.placeno_dobavljacu) > 0 && Number(k.povrsina_kod_dobavljaca) > 0 ? (
                            <span className="font-semibold" style={{ color: PRIMARY }}>
                              {(Number(k.placeno_dobavljacu) / Number(k.povrsina_kod_dobavljaca)).toFixed(3)} KM/dm²
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-[#5f5878]">–</span>
                          )}
                        </td>
                      </tr>
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
