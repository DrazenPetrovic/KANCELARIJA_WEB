import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight, Filter, Loader2, Search } from "lucide-react";
import { formatDatum } from "./IzvodiPregled";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

interface ZatvoreniNalog {
  sifra_naloga: number;
  sifra_sirovine: number | string;
  naziv_proizvoda: string;
  jm: string;
  Tezina: number | string;
  datum_zatvaranja: string;
  sifra_radinka: number | string;
  Naziv_radnika: string;
  status_proizvonje_0_1: number;
  sifra_masine: number | string;
  tezina_otpada: number | string;
  tezina_ostatka: number | string;
  broj_rn: number | string;
  status_magacin: number | string;
  gramatura: number | string;
  sirina_rolne: number | string;
  tezina_sirovine_nakon_rada: number | string;
  tezina_sirovine: number | string;
}

interface NalogDetalj {
  sifra_tabele_magacin: number;
  sifra_zavrsena_proizvodnja_masina: number;
  sifra_radnog_naloga: number;
  sifra_narudzbe: number | string;
  sifra_proizvoda: number | string;
  naziv_proizvoda: string;
  jm: string;
  trazena_kolicina: number | string;
  uradjena_kolicina: number | string;
  prihvacena_kolicina: number | string;
  datum_unosa: string;
  status: number | string;
  napomena: string | null;
}

const fmtBroj = (v: number | string | null | undefined, dec = 2) => {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

const TH = ({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
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
    className={`px-2 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"} ${className}`}
  >
    {children}
  </td>
);

const BROJ_KOLONA = 12;

function Detalji({ sifra }: { sifra: number }) {
  const [data, setData] = useState<NalogDetalj[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktivan = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/radni-nalog/zatvoreni/${sifra}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Greška pri učitavanju detalja");
        const json = await res.json();
        if (aktivan) setData(json.data || []);
      } catch (err) {
        if (aktivan)
          setError(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        if (aktivan) setLoading(false);
      }
    })();
    return () => {
      aktivan = false;
    };
  }, [sifra]);

  if (loading)
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500 dark:text-[#7d7498]">
        <Loader2 size={16} className="animate-spin" style={{ color: PRIMARY }} />
        Učitavanje detalja...
      </div>
    );

  if (error)
    return <p className="px-3 py-4 text-sm text-red-500">{error}</p>;

  return (
    <div className="rounded-xl border-2 border-red-500 overflow-hidden">
      <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <TH>Šif. mag.</TH>
              <TH>Narudžba</TH>
              <TH>Proizvod</TH>
              <TH>JM</TH>
              <TH right>Tražena</TH>
              <TH right>Urađena</TH>
              <TH right>Prihvaćena</TH>
              <TH>Datum unosa</TH>
              <TH>Status</TH>
              <TH>Napomena</TH>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#261f38]">
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                >
                  Nema stavki
                </td>
              </tr>
            )}
            {data.map((d) => (
              <tr
                key={d.sifra_tabele_magacin}
                className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1"
              >
                <TD>{d.sifra_tabele_magacin}</TD>
                <TD>{d.sifra_narudzbe}</TD>
                <TD bold>
                  {d.naziv_proizvoda}
                  <span className="ml-2 text-[10px] font-normal text-gray-400 dark:text-[#5f5878]">
                    {d.sifra_proizvoda}
                  </span>
                </TD>
                <TD>{d.jm}</TD>
                <TD right>{fmtBroj(d.trazena_kolicina)}</TD>
                <TD right>{fmtBroj(d.uradjena_kolicina)}</TD>
                <TD right bold>
                  {fmtBroj(d.prihvacena_kolicina)}
                </TD>
                <TD>{formatDatum(d.datum_unosa)}</TD>
                <TD>{d.status}</TD>
                <TD className="!whitespace-normal min-w-[160px] text-xs">
                  {d.napomena || "–"}
                </TD>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d] [&>td]:py-1">
                <TD bold>Ukupno</TD>
                <TD />
                <TD />
                <TD />
                <TD right bold>
                  {fmtBroj(data.reduce((s, d) => s + (Number(d.trazena_kolicina) || 0), 0))}
                </TD>
                <TD right bold>
                  {fmtBroj(data.reduce((s, d) => s + (Number(d.uradjena_kolicina) || 0), 0))}
                </TD>
                <TD right bold>
                  {fmtBroj(data.reduce((s, d) => s + (Number(d.prihvacena_kolicina) || 0), 0))}
                </TD>
                <TD />
                <TD />
                <TD />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function RadniNalogZatvoreni() {
  const [data, setData] = useState<ZatvoreniNalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [otvoren, setOtvoren] = useState<number | null>(null);
  const [statusProizvodnje, setStatusProizvodnje] = useState<0 | 1>(0);
  const [masinaFilter, setMasinaFilter] = useState("");
  const [radnikFilter, setRadnikFilter] = useState("");

  const brojPoStatusu = useMemo(() => {
    const b = { 0: 0, 1: 0 };
    for (const n of data) b[Number(n.status_proizvonje_0_1) === 1 ? 1 : 0]++;
    return b;
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/radni-nalog/zatvoreni`, {
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
    })();
  }, []);

  const masine = useMemo(
    () =>
      Array.from(new Set(data.map((n) => String(n.sifra_masine ?? ""))))
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b)),
    [data],
  );

  const radnici = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of data)
      if (n.sifra_radinka != null)
        m.set(String(n.sifra_radinka), n.Naziv_radnika || String(n.sifra_radinka));
    return Array.from(m, ([sifra, naziv]) => ({ sifra, naziv })).sort((a, b) =>
      a.naziv.localeCompare(b.naziv, "sr"),
    );
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((n) => {
      if ((Number(n.status_proizvonje_0_1) === 1 ? 1 : 0) !== statusProizvodnje)
        return false;
      if (masinaFilter && String(n.sifra_masine) !== masinaFilter) return false;
      if (radnikFilter && String(n.sifra_radinka) !== radnikFilter) return false;
      if (!q) return true;
      return [n.sifra_naloga, n.broj_rn, n.naziv_proizvoda, n.Naziv_radnika, n.sifra_sirovine]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [data, search, statusProizvodnje, masinaFilter, radnikFilter]);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} style={{ color: PRIMARY }} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: PRIMARY }}
          >
            Filteri
          </span>
          {!loading && !error && (
            <span className="ml-auto text-xs text-gray-400 dark:text-[#5f5878]">
              Ukupno: {filtered.length} / {data.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-gray-200 dark:border-[#3a3158] overflow-hidden">
          {([0, 1] as const).map((s) => {
            const isActive = statusProizvodnje === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusProizvodnje(s);
                  setOtvoren(null);
                }}
                className={`px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "text-white"
                    : "text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                }`}
                style={isActive ? { background: PRIMARY } : {}}
              >
                {s === 0 ? "Završeni nalozi" : "Nalozi u radu"}
                <span className="ml-2 text-[10px] opacity-80">
                  ({brojPoStatusu[s]})
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-fit">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
          />
          <input
            type="text"
            placeholder="Šifra naloga, proizvod, radnik, sirovina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-72 focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
          />
        </div>
        <select
          value={masinaFilter}
          onChange={(e) => {
            setMasinaFilter(e.target.value);
            setOtvoren(null);
          }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
        >
          <option value="">Sve mašine</option>
          {masine.map((m) => (
            <option key={m} value={m}>
              Mašina {m}
            </option>
          ))}
        </select>
        <select
          value={radnikFilter}
          onChange={(e) => {
            setRadnikFilter(e.target.value);
            setOtvoren(null);
          }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
        >
          <option value="">Svi radnici</option>
          {radnici.map((r) => (
            <option key={r.sifra} value={r.sifra}>
              {r.naziv}
            </option>
          ))}
        </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="w-fit max-w-full mx-auto bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
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

        {!loading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              Nema podataka za prikaz.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-auto text-sm">
              <thead>
                <tr>
                  <TH />
                  <TH>Šifra naloga</TH>
                  <TH>Proizvod</TH>
                  <TH>JM</TH>
                  <TH right>GR</TH>
                  <TH right>ŠIR.ROLNE</TH>
                  <TH right>Tež. sirovine</TH>
                  <TH right>Tež. nakon rada</TH>
                  <TH right>Otpad</TH>
                  <TH right>Ostatak</TH>
                  <TH>Radnik / mašina</TH>
                  <TH>Zatvoren</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => {
                  const jeOtvoren = otvoren === n.sifra_naloga;
                  return (
                    <Fragment key={n.sifra_naloga}>
                      <tr
                        onClick={() =>
                          setOtvoren(jeOtvoren ? null : n.sifra_naloga)
                        }
                        className={`cursor-pointer border-b border-gray-200 dark:border-[#3a3158] transition-colors hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${
                          jeOtvoren
                            ? "bg-purple-50 dark:bg-[#2d2648]"
                            : i % 2 === 1
                              ? "bg-[#fcfbfe] dark:bg-[#2a2240]"
                              : ""
                        }`}
                      >
                        <TD>
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${jeOtvoren ? "rotate-90" : ""}`}
                            style={{ color: PRIMARY }}
                          />
                        </TD>
                        <TD bold>
                          <span style={{ color: PRIMARY }}>{n.sifra_naloga}</span>
                          {Number(n.broj_rn) !== 0 && (
                            <span className="ml-2 text-[10px] font-normal text-gray-400 dark:text-[#5f5878]">
                              RN {n.broj_rn}
                            </span>
                          )}
                        </TD>
                        <TD bold>
                          {n.naziv_proizvoda}
                          <span className="ml-2 text-[10px] font-normal text-gray-400 dark:text-[#5f5878]">
                            {n.sifra_sirovine}
                          </span>
                        </TD>
                        <TD>{n.jm}</TD>
                        <TD right>{fmtBroj(n.gramatura, 0)}</TD>
                        <TD right>{fmtBroj(n.sirina_rolne, 0)}</TD>
                        <TD right>{fmtBroj(n.tezina_sirovine)}</TD>
                        <TD right>
                          {fmtBroj(n.tezina_sirovine_nakon_rada)}
                          <span
                            className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]"
                            title="Ukupna težina sirovine nakon rada"
                          >
                            uk. {fmtBroj(n.Tezina)}
                          </span>
                        </TD>
                        <TD right className="text-red-500 dark:text-red-400">
                          {fmtBroj(n.tezina_otpada)}
                        </TD>
                        <TD right>{fmtBroj(n.tezina_ostatka)}</TD>
                        <TD>
                          {n.Naziv_radnika}
                          <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                            maš. {n.sifra_masine}
                          </span>
                        </TD>
                        <TD>{formatDatum(n.datum_zatvaranja)}</TD>
                      </tr>
                      {jeOtvoren && (
                        <tr>
                          <td
                            colSpan={BROJ_KOLONA}
                            className="px-4 py-3 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                          >
                            <Detalji sifra={n.sifra_naloga} />
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
