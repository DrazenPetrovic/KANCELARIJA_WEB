import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Package,
  Search,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Paleta boja pozadine po grupi proizvoda — redom se dodjeljuje svakoj grupi
// (ciklično), da se grupe vizuelno razlikuju u tabeli. Svaka boja ima varijantu
// za svijetlu i tamnu temu.
const GRUPA_PALETA: { light: string; dark: string }[] = [
  { light: "#f4f1f9", dark: "#241f38" },
  { light: "#eaf2fb", dark: "#1b2536" },
  { light: "#eef6e4", dark: "#1f2a1c" },
  { light: "#fdf3e3", dark: "#332a1a" },
  { light: "#fbe9f0", dark: "#33202a" },
  { light: "#e3f7f3", dark: "#173330" },
  { light: "#fbebe9", dark: "#331e1c" },
  { light: "#efe9fb", dark: "#241a38" },
];

interface Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  nabavna_cijena: number | string;
  barkod: string;
  kolicina_proizvoda: number | string;
  kolicinaNaStanju: number;
  grupa_proizvoda: string;
  naziv_grupe: string;
  [key: string]: unknown;
}

interface ArtikalGrupa {
  sifra_grupe: string | number;
  naziv_grupe: string;
  [key: string]: unknown;
}

const TH = ({
  children,
  center,
  sortDir,
  onClick,
}: {
  children: React.ReactNode;
  center?: boolean;
  sortDir?: "asc" | "desc" | null;
  onClick?: () => void;
}) => (
  <th
    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-white ${center ? "text-center" : "text-left"} ${onClick ? "cursor-pointer select-none hover:brightness-110 transition-[filter]" : ""}`}
    style={{ backgroundColor: PRIMARY, borderBottom: `2px solid ${ACCENT}` }}
    onClick={onClick}
  >
    {onClick ? (
      <span className={`inline-flex items-center gap-1 ${center ? "justify-center" : ""}`}>
        {children}
        {sortDir === "asc" && <ArrowUp size={12} />}
        {sortDir === "desc" && <ArrowDown size={12} />}
        {!sortDir && <ArrowUpDown size={12} className="opacity-50" />}
      </span>
    ) : (
      children
    )}
  </th>
);

const TD = ({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) => (
  <td
    className={`px-4 py-2.5 text-sm whitespace-nowrap border-b border-gray-100 dark:border-[#2d2648] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
  >
    {children}
  </td>
);

const formatBroj = (v: number | string | undefined) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function ArtikliPregled() {
  const { theme } = useTheme();
  const [data, setData] = useState<Artikal[]>([]);
  const [grupe, setGrupe] = useState<ArtikalGrupa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [grupaFilter, setGrupaFilter] = useState("sve");
  const [sortPolje, setSortPolje] = useState<"sifra" | "naziv" | "grupa">(
    "naziv",
  );
  const [sortSmjer, setSortSmjer] = useState<"asc" | "desc">("asc");

  const handleSort = (polje: "sifra" | "naziv" | "grupa") => {
    if (sortPolje === polje) {
      setSortSmjer((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortPolje(polje);
      setSortSmjer("asc");
    }
  };

  useEffect(() => {
    const ucitaj = async () => {
      try {
        const [artikliRes, grupeRes] = await Promise.all([
          fetch(`${API_URL}/api/artikli`, { credentials: "include" }),
          fetch(`${API_URL}/api/artikli/grupe`, { credentials: "include" }),
        ]);
        if (!artikliRes.ok) throw new Error("Greška pri učitavanju artikala");
        const artikliJson = await artikliRes.json();
        setData(artikliJson.data ?? []);
        if (grupeRes.ok) {
          const grupeJson = await grupeRes.json();
          setGrupe(grupeJson.data ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        setLoading(false);
      }
    };
    void ucitaj();
  }, []);

  const filtrirani = useMemo(() => {
    return data
      .filter((a) => {
        const matchGrupa =
          grupaFilter === "sve" || String(a.grupa_proizvoda) === grupaFilter;

        if (!matchGrupa) return false;
        if (!pretraga.trim()) return true;

        const q = pretraga.toLowerCase();
        return (
          a.naziv_proizvoda?.toLowerCase().includes(q) ||
          String(a.sifra_proizvoda).toLowerCase().includes(q) ||
          a.barkod?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const polje =
          sortPolje === "sifra"
            ? "sifra_proizvoda"
            : sortPolje === "grupa"
              ? "naziv_grupe"
              : "naziv_proizvoda";
        const cmp = String(a[polje] ?? "").localeCompare(
          String(b[polje] ?? ""),
          "bs",
          { numeric: true },
        );
        return sortSmjer === "asc" ? cmp : -cmp;
      });
  }, [data, pretraga, grupaFilter, sortPolje, sortSmjer]);

  // Boja pozadine po grupi — dodjeljuje se redom kojim se grupe pojavljuju u
  // listi grupa sa servera (stabilan redoslijed, neovisan o filterima).
  const grupaBojaMap = useMemo(() => {
    const mapa = new Map<string, { light: string; dark: string }>();
    let idx = 0;
    const dodaj = (kljuc: string) => {
      if (mapa.has(kljuc)) return;
      mapa.set(kljuc, GRUPA_PALETA[idx % GRUPA_PALETA.length]);
      idx += 1;
    };
    grupe.forEach((g) => dodaj(String(g.sifra_grupe)));
    data.forEach((a) => dodaj(String(a.grupa_proizvoda)));
    return mapa;
  }, [grupe, data]);

  const bojaZaRed = (a: Artikal) => {
    const boja = grupaBojaMap.get(String(a.grupa_proizvoda));
    if (!boja) return undefined;
    return theme === "dark" ? boja.dark : boja.light;
  };

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <Package size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
              Pregled artikala
            </h2>
            {!loading && !error && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Ukupno: {filtrirani.length} / {data.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv, barkod..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={grupaFilter}
            onChange={(e) => setGrupaFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            <option value="sve">Sve grupe</option>
            {grupe.map((g) => (
              <option key={g.sifra_grupe} value={String(g.sifra_grupe)}>
                {g.naziv_grupe}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
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

        {!loading && !error && filtrirani.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              Nema podataka za prikaz.
            </p>
          </div>
        )}

        {!loading && !error && filtrirani.length > 0 && (
          <div
            className="overflow-auto"
            style={{ maxHeight: "70vh" }}
          >
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: 85 }} />
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 150 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr className="sticky top-0 z-10">
                  <TH
                    onClick={() => handleSort("sifra")}
                    sortDir={sortPolje === "sifra" ? sortSmjer : null}
                  >
                    Šifra
                  </TH>
                  <TH center> </TH>
                  <TH
                    onClick={() => handleSort("naziv")}
                    sortDir={sortPolje === "naziv" ? sortSmjer : null}
                  >
                    Naziv artikla
                  </TH>
                  <TH
                    onClick={() => handleSort("grupa")}
                    sortDir={sortPolje === "grupa" ? sortSmjer : null}
                  >
                    Grupa
                  </TH>
                  <TH center>JM</TH>
                  <TH center>Količina</TH>
                  <TH center>Nabavna</TH>
                  <TH center>VPC</TH>
                  <TH center>MPC</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((a) => (
                  <tr
                    key={a.sifra_proizvoda}
                    className="transition-colors"
                    style={{ backgroundColor: bojaZaRed(a) }}
                  >
                    <TD>
                      <span className="font-mono font-semibold text-xs" style={{ color: PRIMARY }}>
                        {a.sifra_proizvoda}
                      </span>
                    </TD>
                    <TD center>
                      {Number(a.kolicina_proizvoda) === 0 && (
                        <span title="Nema na stanju" className="inline-flex">
                          <AlertTriangle
                            size={13}
                            className="text-red-500 dark:text-red-400"
                          />
                        </span>
                      )}
                    </TD>
                    <TD>
                      <span
                        className="block truncate font-medium"
                        title={a.naziv_proizvoda}
                      >
                        {a.naziv_proizvoda}
                      </span>
                      {a.barkod && a.barkod !== "0" && (
                        <span className="block truncate text-xs text-gray-400 dark:text-[#5f5878]">
                          {a.barkod}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <span className="block truncate" title={a.naziv_grupe}>
                        {a.naziv_grupe || "–"}
                      </span>
                    </TD>
                    <TD center>{a.jm || "–"}</TD>
                    <TD center>{formatBroj(a.kolicina_proizvoda)}</TD>
                    <TD center>{formatBroj(a.nabavna_cijena)}</TD>
                    <TD center>{formatBroj(a.vpc)}</TD>
                    <TD center>{formatBroj(a.mpc)}</TD>
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
