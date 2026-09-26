import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Search,
  X,
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

// Jedinica mjere za formu izmjene — sifra ide u JSON, naziv_jm je tekst za operatera.
interface JedinicaMjereOpcija {
  sifra: string | number;
  naziv_jm: string;
  [key: string]: unknown;
}

// Vrsta "Nije definisano" (-1) je samo placeholder — forsira operatera da
// eksplicitno izabere pravu vrstu, forma se ne može sačuvati dok je izabrana.
// Vrsta "Sirovina" (0) automatski postavlja sirovina_da, bez posebnog checkboxa.
const VRSTA_NIJE_DEFINISANO = "-1";
const VRSTA_SIROVINA = "0";
const VRSTA_OPCIJE = [
  { value: VRSTA_NIJE_DEFINISANO, label: "Nije definisano" },
  { value: VRSTA_SIROVINA, label: "Sirovina" },
  { value: "1", label: "Proizvodi" },
  { value: "2", label: "Roba" },
  { value: "3", label: "Usluga" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

const TH = ({
  children,
  center,
  sortDir,
  onClick,
  padLeft = 8,
  padRight = 8,
}: {
  children: React.ReactNode;
  center?: boolean;
  sortDir?: "asc" | "desc" | null;
  onClick?: () => void;
  padLeft?: number;
  padRight?: number;
}) => (
  <th
    className={`py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-white ${center ? "text-center" : "text-left"} ${onClick ? "cursor-pointer select-none hover:brightness-110 transition-[filter]" : ""}`}
    style={{
      backgroundColor: PRIMARY,
      borderBottom: `2px solid ${ACCENT}`,
      paddingLeft: padLeft,
      paddingRight: padRight,
    }}
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
  padLeft = 8,
  padRight = 8,
}: {
  children: React.ReactNode;
  center?: boolean;
  padLeft?: number;
  padRight?: number;
}) => (
  <td
    className={`py-2.5 text-sm whitespace-nowrap border-b border-gray-300 dark:border-[#453a68] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
    style={{ paddingLeft: padLeft, paddingRight: padRight }}
  >
    {children}
  </td>
);

const formatBroj = (v: number | string | undefined) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Marža = koliko je VPC veći od nabavne cijene, u procentima.
const izracunajMarzu = (
  nabavna: number | string | undefined,
  vpc: number | string | undefined,
) => {
  const n = Number(nabavna);
  const v = Number(vpc);
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(v)) return null;
  return ((v - n) / n) * 100;
};

// Fin. vrijednost artikla na stanju = količina * VPC.
const izracunajFinVrijednost = (
  kolicina: number | string | undefined,
  vpc: number | string | undefined,
) => {
  const k = Number(kolicina);
  const v = Number(vpc);
  if (!Number.isFinite(k) || !Number.isFinite(v)) return 0;
  return k * v;
};

export function ArtikliPregled() {
  const { theme } = useTheme();
  const [data, setData] = useState<Artikal[]>([]);
  const [grupe, setGrupe] = useState<ArtikalGrupa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [grupaFilter, setGrupaFilter] = useState("sve");
  const [sakrijBezStanja, setSakrijBezStanja] = useState(true);
  const [sortPolje, setSortPolje] = useState<"sifra" | "naziv" | "grupa">(
    "naziv",
  );
  const [sortSmjer, setSortSmjer] = useState<"asc" | "desc">("asc");

  // Izmjena artikla — modal sa istim poljima kao unos, minus šifra (koja se
  // samo prikazuje, ne mijenja).
  const [artikalZaIzmjenu, setArtikalZaIzmjenu] = useState<Artikal | null>(
    null,
  );
  const [nazivIzmjena, setNazivIzmjena] = useState("");
  const [jmIzmjena, setJmIzmjena] = useState("");
  const [barkodIzmjena, setBarkodIzmjena] = useState("");
  const [grupaIzmjena, setGrupaIzmjena] = useState("0");
  const [vrstaIzmjena, setVrstaIzmjena] = useState(VRSTA_NIJE_DEFINISANO);
  const [kolicinaIzmjena, setKolicinaIzmjena] = useState("0");
  const [cijenaBezIzmjena, setCijenaBezIzmjena] = useState("");
  const [vpcIzmjena, setVpcIzmjena] = useState("");
  const [marzaIzmjena, setMarzaIzmjena] = useState("");
  const [marzaZaKalkulacijuIzmjena, setMarzaZaKalkulacijuIzmjena] =
    useState("");
  const [minimalnaProdajnaIzmjena, setMinimalnaProdajnaIzmjena] =
    useState("");
  const [ogranicenaMarzaIzmjena, setOgranicenaMarzaIzmjena] = useState(false);
  const [koristitiZaPonuduIzmjena, setKoristitiZaPonuduIzmjena] =
    useState(true);
  const [grupeZaIzmjenu, setGrupeZaIzmjenu] = useState<ArtikalGrupa[]>([]);
  const [jediniceMjere, setJediniceMjere] = useState<JedinicaMjereOpcija[]>(
    [],
  );
  const [cuvanjeIzmjene, setCuvanjeIzmjene] = useState(false);
  const [greskaIzmjena, setGreskaIzmjena] = useState<string | null>(null);
  const [uspjehIzmjena, setUspjehIzmjena] = useState<string | null>(null);

  const handleSort = (polje: "sifra" | "naziv" | "grupa") => {
    if (sortPolje === polje) {
      setSortSmjer((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortPolje(polje);
      setSortSmjer("asc");
    }
  };

  const ucitajArtikle = async () => {
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

  useEffect(() => {
    void ucitajArtikle();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/artikli/grupe-unos`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => setGrupeZaIzmjenu(json.data ?? []))
      .catch(() => setGrupeZaIzmjenu([]));

    fetch(`${API_URL}/api/artikli/jedinica-mjere`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => setJediniceMjere(json.data ?? []))
      .catch(() => setJediniceMjere([]));
  }, []);

  const otvoriIzmjenu = (a: Artikal) => {
    setArtikalZaIzmjenu(a);
    setNazivIzmjena(a.naziv_proizvoda);
    setBarkodIzmjena(a.barkod && a.barkod !== "0" ? a.barkod : "");
    setGrupaIzmjena(String(a.grupa_proizvoda ?? "0"));
    setKolicinaIzmjena(String(a.kolicina_proizvoda ?? "0"));
    setCijenaBezIzmjena(String(a.nabavna_cijena ?? ""));
    setVpcIzmjena(String(a.vpc ?? ""));
    const marza = izracunajMarzu(a.nabavna_cijena, a.vpc);
    setMarzaIzmjena(marza === null ? "" : marza.toFixed(2));
    const poklapanjeJm = jediniceMjere.find(
      (j) => j.naziv_jm?.toLowerCase() === String(a.jm ?? "").toLowerCase(),
    );
    setJmIzmjena(
      poklapanjeJm
        ? String(poklapanjeJm.sifra)
        : jediniceMjere[0]
          ? String(jediniceMjere[0].sifra)
          : "",
    );
    // Ovi podaci nisu dio pregleda artikala (sp_artikli_pregled), pa se
    // otvaraju sa podrazumijevanim vrijednostima — korisnik ih po potrebi
    // popravi prije snimanja. Vrsta se otvara kao "Nije definisano" da
    // operater mora eksplicitno potvrditi pravu vrstu prije snimanja.
    setVrstaIzmjena(VRSTA_NIJE_DEFINISANO);
    setMarzaZaKalkulacijuIzmjena("");
    setMinimalnaProdajnaIzmjena("");
    setOgranicenaMarzaIzmjena(false);
    setKoristitiZaPonuduIzmjena(true);
    setGreskaIzmjena(null);
    setUspjehIzmjena(null);
  };

  const zatvoriIzmjenu = () => {
    setArtikalZaIzmjenu(null);
  };

  const handleSacuvajIzmjenu = async () => {
    if (!artikalZaIzmjenu) return;
    setGreskaIzmjena(null);

    if (!nazivIzmjena.trim()) {
      setGreskaIzmjena("Naziv proizvoda je obavezan");
      return;
    }
    if (!Number.isFinite(Number(jmIzmjena)) || Number(jmIzmjena) <= 0) {
      setGreskaIzmjena("Jedinica mjere (JM) je obavezna");
      return;
    }
    if (vrstaIzmjena === VRSTA_NIJE_DEFINISANO) {
      setGreskaIzmjena("Vrsta artikla je obavezna — izaberite jednu od opcija");
      return;
    }

    const payload = {
      sifra_proizvoda: Number(artikalZaIzmjenu.sifra_proizvoda),
      naziv_proizvoda: nazivIzmjena.trim(),
      jm: Number(jmIzmjena),
      kolicina_proizvoda: Number(kolicinaIzmjena) || 0,
      cijena_bez: Number(cijenaBezIzmjena) || 0,
      vpc: Number(vpcIzmjena) || 0,
      marza: Number(marzaIzmjena) || 0,
      sirovina_da: vrstaIzmjena === VRSTA_SIROVINA ? 1 : 0,
      ogranicena_marza: ogranicenaMarzaIzmjena ? 1 : 0,
      marza_za_kalkulaciju: Number(marzaZaKalkulacijuIzmjena) || 0,
      grupa_proizvoda: Number(grupaIzmjena) || 0,
      vrsta: Number(vrstaIzmjena) || 0,
      minimalna_prodajna: Number(minimalnaProdajnaIzmjena) || 0,
      barkod: barkodIzmjena.trim(),
      koristiti_za_ponudu: koristitiZaPonuduIzmjena ? 1 : 0,
    };

    setCuvanjeIzmjene(true);
    try {
      const res = await fetch(`${API_URL}/api/artikli/izmjena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri izmjeni artikla");
      }
      setUspjehIzmjena(`Artikal "${nazivIzmjena.trim()}" je sačuvan.`);
      await ucitajArtikle();
    } catch (err) {
      setGreskaIzmjena(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setCuvanjeIzmjene(false);
    }
  };

  const filtrirani = useMemo(() => {
    return data
      .filter((a) => {
        if (sakrijBezStanja && Number(a.kolicina_proizvoda) <= 0) return false;

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
  }, [data, pretraga, grupaFilter, sakrijBezStanja, sortPolje, sortSmjer]);

  const finVrijednostZaliha = useMemo(
    () =>
      filtrirani.reduce(
        (zbir, a) => zbir + izracunajFinVrijednost(a.kolicina_proizvoda, a.vpc),
        0,
      ),
    [filtrirani],
  );

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
      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-nowrap items-center gap-3">
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

            <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sakrijBezStanja}
                onChange={(e) => setSakrijBezStanja(e.target.checked)}
                className="w-4 h-4 rounded accent-[#785E9E]"
              />
              Sakrij artikle bez stanja
            </label>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50] shrink-0">
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

          {!loading && !error ? (
            <div className="flex flex-col items-end justify-self-end">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: PRIMARY }}
              >
                Fin vrijednost zaliha
              </span>
              <span className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                {formatBroj(finVrijednostZaliha)}
              </span>
            </div>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Tabela */}
      {(loading || error || filtrirani.length === 0) && (
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
        </div>
      )}

      {!loading && !error && filtrirani.length > 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden w-fit max-w-full mx-auto">
          <div className="overflow-x-auto">
            <table className="table-auto border-collapse">
              <thead>
                <tr>
                  <TH
                    onClick={() => handleSort("sifra")}
                    sortDir={sortPolje === "sifra" ? sortSmjer : null}
                    padRight={0}
                  >
                    Šifra
                  </TH>
                  <TH
                    onClick={() => handleSort("naziv")}
                    sortDir={sortPolje === "naziv" ? sortSmjer : null}
                    padLeft={0}
                  >
                    Naziv artikla
                  </TH>
                  <TH center padLeft={0} padRight={0}>
                    {" "}
                  </TH>
                  <TH center>Barkod</TH>
                  <TH center>JM</TH>
                  <TH center>Količina</TH>
                  <TH center>Nabavna</TH>
                  <TH center>VPC</TH>
                  <TH center>Marža</TH>
                  <TH center>Fin. vrijednost</TH>
                  <TH center>MPC</TH>
                  <TH
                    onClick={() => handleSort("grupa")}
                    sortDir={sortPolje === "grupa" ? sortSmjer : null}
                  >
                    Grupa
                  </TH>
                  <TH center>Akcije</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((a) => (
                  <tr
                    key={a.sifra_proizvoda}
                    className="transition-colors"
                    style={{ backgroundColor: bojaZaRed(a) }}
                  >
                    <TD padRight={0}>
                      <span className="font-mono font-semibold text-xs" style={{ color: PRIMARY }}>
                        {a.sifra_proizvoda}
                      </span>
                    </TD>
                    <TD padLeft={0}>
                      <span
                        className="block max-w-[421px] truncate font-medium"
                        title={a.naziv_proizvoda}
                      >
                        {a.naziv_proizvoda}
                      </span>
                    </TD>
                    <TD center padLeft={0} padRight={0}>
                      {Number(a.kolicina_proizvoda) === 0 ? (
                        <span title="Nema na stanju" className="inline-flex">
                          <AlertTriangle
                            size={13}
                            className="text-red-500 dark:text-red-400"
                          />
                        </span>
                      ) : (
                        <span title="Ima na stanju" className="inline-flex">
                          <CheckCircle2
                            size={13}
                            className="text-green-600 dark:text-green-400"
                          />
                        </span>
                      )}
                    </TD>
                    <TD>
                      {a.barkod && a.barkod !== "0" && (
                        <span
                          className="block max-w-[140px] truncate text-xs text-gray-500 dark:text-[#a99fc2]"
                          title={a.barkod}
                        >
                          {a.barkod}
                        </span>
                      )}
                    </TD>
                    <TD center>{a.jm || "–"}</TD>
                    <TD center>
                      {Number(a.kolicina_proizvoda) > 0 ? (
                        <span className="font-bold text-green-700 dark:text-green-400">
                          {formatBroj(a.kolicina_proizvoda)}
                        </span>
                      ) : (
                        formatBroj(a.kolicina_proizvoda)
                      )}
                    </TD>
                    <TD center>{formatBroj(a.nabavna_cijena)}</TD>
                    <TD center>{formatBroj(a.vpc)}</TD>
                    <TD center>
                      {(() => {
                        const marza = izracunajMarzu(a.nabavna_cijena, a.vpc);
                        return marza === null
                          ? "–"
                          : `${formatBroj(marza)}%`;
                      })()}
                    </TD>
                    <TD center>
                      {formatBroj(izracunajFinVrijednost(a.kolicina_proizvoda, a.vpc))}
                    </TD>
                    <TD center>{formatBroj(a.mpc)}</TD>
                    <TD>
                      <span
                        className="block max-w-[160px] truncate"
                        title={a.naziv_grupe}
                      >
                        {a.naziv_grupe || "–"}
                      </span>
                    </TD>
                    <TD center>
                      <button
                        type="button"
                        onClick={() => otvoriIzmjenu(a)}
                        title="Izmijeni artikal"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"
                        style={{ color: PRIMARY }}
                      >
                        <Pencil size={14} />
                      </button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — izmjena artikla */}
      {artikalZaIzmjenu && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) zatvoriIzmjenu();
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2 border-gray-100 dark:border-[#2d2648]">
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: PRIMARY }}
            >
              <div className="flex items-center gap-2">
                <Pencil size={17} className="text-white" />
                <h3 className="text-base font-bold text-white">
                  Izmjena artikla
                </h3>
              </div>
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {uspjehIzmjena && (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 size={15} />
                  {uspjehIzmjena}
                </div>
              )}
              {greskaIzmjena && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={15} />
                  {greskaIzmjena}
                </div>
              )}

              {/* Zaključana polja — trenutno se ne mogu mijenjati ovdje */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Šifra proizvoda">
                  <input
                    type="text"
                    value={artikalZaIzmjenu.sifra_proizvoda}
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </Field>
                <Field label="Količina">
                  <input
                    type="number"
                    value={kolicinaIzmjena}
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </Field>
                <Field label="Nabavna cijena (bez PDV-a)">
                  <input
                    type="number"
                    step="0.01"
                    value={cijenaBezIzmjena}
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </Field>
                <Field label="VPC">
                  <input
                    type="number"
                    step="0.01"
                    value={vpcIzmjena}
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </Field>
              </div>

              {/* Polja koja se mogu mijenjati */}
              <div
                className="rounded-2xl border-2 p-4 space-y-4"
                style={{ borderColor: ACCENT }}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Naziv proizvoda *" className="col-span-2">
                    <input
                      type="text"
                      value={nazivIzmjena}
                      onChange={(e) => setNazivIzmjena(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="JM *">
                    <select
                      value={jmIzmjena}
                      onChange={(e) => setJmIzmjena(e.target.value)}
                      className={inputClass}
                    >
                      {jediniceMjere.length === 0 && (
                        <option value="">–</option>
                      )}
                      {jediniceMjere.map((j) => (
                        <option key={j.sifra} value={String(j.sifra)}>
                          {j.naziv_jm}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Barkod">
                    <input
                      type="text"
                      value={barkodIzmjena}
                      onChange={(e) => setBarkodIzmjena(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Grupa proizvoda">
                    <select
                      value={grupaIzmjena}
                      onChange={(e) => setGrupaIzmjena(e.target.value)}
                      className={inputClass}
                    >
                      {grupeZaIzmjenu.map((g) => (
                        <option
                          key={g.sifra_grupe}
                          value={String(g.sifra_grupe)}
                        >
                          {g.naziv_grupe}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Vrsta">
                    <select
                      value={vrstaIzmjena}
                      onChange={(e) => setVrstaIzmjena(e.target.value)}
                      className={inputClass}
                    >
                      {VRSTA_OPCIJE.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Marža (%)">
                    <input
                      type="number"
                      step="0.01"
                      value={marzaIzmjena}
                      onChange={(e) => setMarzaIzmjena(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Marža za kalkulaciju (%)">
                    <input
                      type="number"
                      step="0.01"
                      value={marzaZaKalkulacijuIzmjena}
                      onChange={(e) =>
                        setMarzaZaKalkulacijuIzmjena(e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Minimalna prodajna cijena">
                    <input
                      type="number"
                      step="0.01"
                      value={minimalnaProdajnaIzmjena}
                      onChange={(e) =>
                        setMinimalnaProdajnaIzmjena(e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ogranicenaMarzaIzmjena}
                      onChange={(e) =>
                        setOgranicenaMarzaIzmjena(e.target.checked)
                      }
                      className="w-4 h-4 rounded"
                      style={{ accentColor: PRIMARY }}
                    />
                    Ograničena marža
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={koristitiZaPonuduIzmjena}
                      onChange={(e) =>
                        setKoristitiZaPonuduIzmjena(e.target.checked)
                      }
                      className="w-4 h-4 rounded"
                      style={{ accentColor: PRIMARY }}
                    />
                    Koristiti za ponudu
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2d2648] flex justify-end gap-2">
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={() => void handleSacuvajIzmjenu()}
                disabled={cuvanjeIzmjene}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                {cuvanjeIzmjene ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Pencil size={15} />
                )}
                Sačuvaj izmjene
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
