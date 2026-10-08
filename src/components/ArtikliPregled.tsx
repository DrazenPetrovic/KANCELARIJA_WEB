import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FlaskConical,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
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
  // erp.artikli_pregled_sve — 1 ako je artikal sirovina (artikli_bez_sirovine_pregled
  // ih ne vraća, zato se ovdje koristi "sve" varijanta).
  sirovina?: number | string | null;
  [key: string]: unknown;
}

interface ArtikalGrupa {
  sifra_grupe: string | number;
  naziv_grupe: string;
  [key: string]: unknown;
}

// Normativ (sastav) proizvoda — koja sirovina i u kojoj količini ulazi u
// proizvod. Vidi erp.proizvodi_normativi_za_proizvod_pregled.
interface NormativStavka {
  sifra_tabele: number;
  sifra_proizvoda: string | number;
  sifra_sirovine: string | number;
  naziv_sirovine: string;
  jm_sirovine: string;
  kolicina_sirovine: number | string;
  [key: string]: unknown;
}

// Jedinica mjere za formu izmjene — erp.artikli.jm je VARCHAR, pa se u JSON
// šalje naziv_jm (tekst, npr. "kg"), a ne šifra iz posebne tabele jedinica
// mjere (INT).
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
  borderLeftColor,
}: {
  children: React.ReactNode;
  center?: boolean;
  padLeft?: number;
  padRight?: number;
  borderLeftColor?: string;
}) => (
  <td
    className={`py-2.5 text-sm whitespace-nowrap border-b border-gray-300 dark:border-[#453a68] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
    style={{
      paddingLeft: padLeft,
      paddingRight: padRight,
      borderLeft: borderLeftColor ? `3px solid ${borderLeftColor}` : undefined,
    }}
  >
    {children}
  </td>
);

const formatBroj = (v: number | string | undefined, decimale = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("bs-BA", { minimumFractionDigits: decimale, maximumFractionDigits: decimale });
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
  const [samoSaNormativom, setSamoSaNormativom] = useState(false);
  const [sortPolje, setSortPolje] = useState<"sifra" | "naziv" | "grupa">(
    "naziv",
  );
  const [sortSmjer, setSortSmjer] = useState<"asc" | "desc">("asc");

  // Normativi (sastav) proizvoda — povučeni odjednom za sve proizvode, pa se
  // grupišu po sifra_proizvoda (vidi normativiMap niže).
  const [normativi, setNormativi] = useState<NormativStavka[]>([]);
  const [prosirenaSifra, setProsirenaSifra] = useState<string | null>(null);

  // Izmjena pojedinačne stavke normativa — modal sa potvrdom prije snimanja.
  const [stavkaZaIzmjenuNormativa, setStavkaZaIzmjenuNormativa] =
    useState<NormativStavka | null>(null);
  const [kolicinaIzmjenaNormativa, setKolicinaIzmjenaNormativa] =
    useState("");
  const [cuvanjeNormativa, setCuvanjeNormativa] = useState(false);
  const [greskaNormativa, setGreskaNormativa] = useState<string | null>(null);

  // Brisanje pojedinačne stavke normativa — modal sa potvrdom prije brisanja.
  const [stavkaZaBrisanjeNormativa, setStavkaZaBrisanjeNormativa] =
    useState<NormativStavka | null>(null);
  const [brisanjeNormativaUToku, setBrisanjeNormativaUToku] = useState(false);
  const [greskaBrisanjaNormativa, setGreskaBrisanjaNormativa] = useState<
    string | null
  >(null);

  // Dodavanje nove sirovine u normativ — modal sa izborom sirovine (samo
  // artikli sa sirovina=1) i unosom količine (na 3 decimale).
  const [dodavanjeSirovineZaProizvod, setDodavanjeSirovineZaProizvod] =
    useState<Artikal | null>(null);
  const [sirovinaZaDodavanje, setSirovinaZaDodavanje] = useState("");
  const [kolicinaNovaSirovina, setKolicinaNovaSirovina] = useState("");
  const [cuvanjeNoveSirovine, setCuvanjeNoveSirovine] = useState(false);
  const [greskaNoveSirovine, setGreskaNoveSirovine] = useState<string | null>(
    null,
  );

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
        fetch(`${API_URL}/api/artikli/pregled-sve`, { credentials: "include" }),
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

    void ucitajNormative();
  }, []);

  const ucitajNormative = async () => {
    try {
      const res = await fetch(`${API_URL}/api/proizvodi/normativi`, {
        credentials: "include",
      });
      const json = await res.json();
      setNormativi(json.data ?? []);
    } catch {
      setNormativi([]);
    }
  };

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
        ? poklapanjeJm.naziv_jm
        : a.jm || jediniceMjere[0]?.naziv_jm || "",
    );
    // Ovi podaci nisu dio pregleda artikala (artikli_bez_sirovine_pregled), pa se
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

  const otvoriIzmjenuNormativa = (stavka: NormativStavka) => {
    setStavkaZaIzmjenuNormativa(stavka);
    setKolicinaIzmjenaNormativa(String(stavka.kolicina_sirovine ?? ""));
    setGreskaNormativa(null);
  };

  const zatvoriIzmjenuNormativa = () => {
    setStavkaZaIzmjenuNormativa(null);
  };

  const potvrdiIzmjenuNormativa = async () => {
    if (!stavkaZaIzmjenuNormativa) return;
    setGreskaNormativa(null);

    const kolicina = Number(kolicinaIzmjenaNormativa);
    if (!Number.isFinite(kolicina) || kolicina < 0) {
      setGreskaNormativa("Količina sirovine mora biti ispravan broj");
      return;
    }

    const payload = {
      sifra_tabele: Number(stavkaZaIzmjenuNormativa.sifra_tabele),
      sifra_proizvoda: Number(stavkaZaIzmjenuNormativa.sifra_proizvoda),
      sifra_sirovine: Number(stavkaZaIzmjenuNormativa.sifra_sirovine),
      kolicina_sirovine: kolicina,
    };

    setCuvanjeNormativa(true);
    try {
      const res = await fetch(`${API_URL}/api/proizvodi/normativi/izmjena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri izmjeni normativa");
      }
      setStavkaZaIzmjenuNormativa(null);
      await ucitajNormative();
    } catch (err) {
      setGreskaNormativa(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setCuvanjeNormativa(false);
    }
  };

  const obrisiStavkuNormativa = (stavka: NormativStavka) => {
    setStavkaZaBrisanjeNormativa(stavka);
    setGreskaBrisanjaNormativa(null);
  };

  const zatvoriBrisanjeNormativa = () => {
    setStavkaZaBrisanjeNormativa(null);
  };

  const potvrdiBrisanjeNormativa = async () => {
    if (!stavkaZaBrisanjeNormativa) return;
    setGreskaBrisanjaNormativa(null);
    setBrisanjeNormativaUToku(true);
    try {
      const res = await fetch(
        `${API_URL}/api/proizvodi/normativi/${stavkaZaBrisanjeNormativa.sifra_tabele}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri brisanju normativa");
      }
      setStavkaZaBrisanjeNormativa(null);
      await ucitajNormative();
    } catch (err) {
      setGreskaBrisanjaNormativa(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setBrisanjeNormativaUToku(false);
    }
  };

  const otvoriDodavanjeSirovine = (a: Artikal) => {
    setDodavanjeSirovineZaProizvod(a);
    setSirovinaZaDodavanje(
      sirovineOpcije[0] ? String(sirovineOpcije[0].sifra_proizvoda) : "",
    );
    setKolicinaNovaSirovina("");
    setGreskaNoveSirovine(null);
  };

  const zatvoriDodavanjeSirovine = () => {
    setDodavanjeSirovineZaProizvod(null);
  };

  const potvrdiDodavanjeSirovine = async () => {
    if (!dodavanjeSirovineZaProizvod) return;
    setGreskaNoveSirovine(null);

    if (!sirovinaZaDodavanje) {
      setGreskaNoveSirovine("Sirovina je obavezna");
      return;
    }
    const kolicina = Number(kolicinaNovaSirovina);
    if (!Number.isFinite(kolicina) || kolicina < 0) {
      setGreskaNoveSirovine("Količina sirovine mora biti ispravan broj");
      return;
    }

    const payload = {
      sifra_proizvoda: Number(dodavanjeSirovineZaProizvod.sifra_proizvoda),
      sifra_sirovine: Number(sirovinaZaDodavanje),
      kolicina_sirovine: kolicina,
    };

    setCuvanjeNoveSirovine(true);
    try {
      const res = await fetch(`${API_URL}/api/proizvodi/normativi/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu normativa");
      }
      setDodavanjeSirovineZaProizvod(null);
      await ucitajNormative();
    } catch (err) {
      setGreskaNoveSirovine(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setCuvanjeNoveSirovine(false);
    }
  };

  // Otvara Karticu artikla u novom tabu, sa unaprijed odabranim proizvodom.
  // Aplikacija nema URL rutiranje — stanje ekrana (aktivna sekcija, izabrani
  // proizvod) se čita iz query stringa pri pokretanju (vidi Dashboard.tsx).
  const otvoriKarticuNovomTabu = (a: Artikal) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}?section=artikli-kartica&sifra=${encodeURIComponent(a.sifra_proizvoda)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSacuvajIzmjenu = async () => {
    if (!artikalZaIzmjenu) return;
    setGreskaIzmjena(null);

    if (!nazivIzmjena.trim()) {
      setGreskaIzmjena("Naziv proizvoda je obavezan");
      return;
    }
    if (!jmIzmjena.trim()) {
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
      jm: jmIzmjena.trim(),
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

  // Normativi grupisani po sifra_proizvoda — za obilježavanje proizvoda sa
  // normativom i prikaz sastava na klik.
  const normativiMap = useMemo(() => {
    const mapa = new Map<string, NormativStavka[]>();
    normativi.forEach((n) => {
      const kljuc = String(n.sifra_proizvoda);
      const lista = mapa.get(kljuc);
      if (lista) lista.push(n);
      else mapa.set(kljuc, [n]);
    });
    return mapa;
  }, [normativi]);

  // Artikli koji su sirovina — za izbor u modalu "Dodaj sirovinu u normativ".
  const sirovineOpcije = useMemo(
    () => data.filter((p) => Number(p.sirovina) === 1),
    [data],
  );

  const filtrirani = useMemo(() => {
    return data
      .filter((a) => {
        if (sakrijBezStanja && Number(a.kolicina_proizvoda) <= 0) return false;
        if (samoSaNormativom && !normativiMap.has(String(a.sifra_proizvoda)))
          return false;

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
  }, [
    data,
    pretraga,
    grupaFilter,
    sakrijBezStanja,
    samoSaNormativom,
    normativiMap,
    sortPolje,
    sortSmjer,
  ]);

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

  // Istaknuta pozadina (sekundarna boja — ACCENT) za trenutno prošireni red +
  // panel sa normativom — jača od uobičajene boje grupe, da operater
  // vizuelno poveže oba dijela i odmah vidi za koji je proizvod normativ
  // otvoren.
  const bojaProsirenogReda = theme === "dark" ? "#33471f" : "#dcf0bd";

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

            <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={samoSaNormativom}
                onChange={(e) => setSamoSaNormativom(e.target.checked)}
                className="w-4 h-4 rounded accent-[#785E9E]"
              />
              Samo proizvodi sa normativom
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
                {filtrirani.map((a) => {
                  const sifra = String(a.sifra_proizvoda);
                  const sastavNormativa = normativiMap.get(sifra);
                  const imaNormativ = !!sastavNormativa;
                  const prosiren = prosirenaSifra === sifra;
                  return (
                  <>
                  <tr
                    key={sifra}
                    onClick={
                      imaNormativ
                        ? () => setProsirenaSifra(prosiren ? null : sifra)
                        : undefined
                    }
                    className={`transition-colors ${imaNormativ ? "cursor-pointer hover:brightness-95" : ""}`}
                    style={{
                      backgroundColor: prosiren
                        ? bojaProsirenogReda
                        : bojaZaRed(a),
                    }}
                  >
                    <TD
                      padRight={0}
                      borderLeftColor={prosiren ? ACCENT : undefined}
                    >
                      <span className="font-mono font-semibold text-xs" style={{ color: PRIMARY }}>
                        {a.sifra_proizvoda}
                      </span>
                    </TD>
                    <TD padLeft={0}>
                      <div className="flex items-center gap-1.5 max-w-[421px]">
                        {imaNormativ && (
                          <span
                            title="Proizvod ima normativ — klikni za sastav"
                            className="shrink-0 inline-flex items-center"
                            style={{ color: "#2563eb" }}
                          >
                            <FlaskConical size={13} />
                          </span>
                        )}
                        <span
                          className="min-w-0 truncate font-medium"
                          title={a.naziv_proizvoda}
                        >
                          {a.naziv_proizvoda}
                        </span>
                        {Number(a.sirovina) === 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            Sirovina
                          </span>
                        )}
                        {imaNormativ &&
                          (prosiren ? (
                            <ChevronUp size={13} className="shrink-0 text-gray-400" />
                          ) : (
                            <ChevronDown size={13} className="shrink-0 text-gray-400" />
                          ))}
                      </div>
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
                          {formatBroj(a.kolicina_proizvoda, 3)}
                        </span>
                      ) : (
                        formatBroj(a.kolicina_proizvoda, 3)
                      )}
                    </TD>
                    <TD center>{formatBroj(a.nabavna_cijena, 3)}</TD>
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
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            otvoriIzmjenu(a);
                          }}
                          title="Izmijeni artikal"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"
                          style={{ color: PRIMARY }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            otvoriKarticuNovomTabu(a);
                          }}
                          title="Otvori karticu artikla u novom tabu"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"
                          style={{ color: PRIMARY }}
                        >
                          <CreditCard size={14} />
                        </button>
                      </div>
                    </TD>
                  </tr>
                  {prosiren && sastavNormativa && (() => {
                    const sastavSortiran = [...sastavNormativa].sort(
                      (x, y) =>
                        Number(y.kolicina_sirovine) -
                        Number(x.kolicina_sirovine),
                    );
                    return (
                    <tr>
                      <td
                        colSpan={13}
                        style={{
                          padding: 0,
                          border: "none",
                          borderLeft: `3px solid ${ACCENT}`,
                        }}
                      >
                        <div
                          className="flex items-start justify-center gap-4 px-6 py-3 border-b border-gray-300 dark:border-[#453a68]"
                          style={{ backgroundColor: bojaProsirenogReda }}
                        >
                          <div className="flex items-center gap-1.5 shrink-0 pt-3">
                            <FlaskConical size={13} style={{ color: "#2563eb" }} />
                            <span
                              className="text-sm font-bold uppercase tracking-wider"
                              style={{ color: PRIMARY }}
                            >
                              Normativ — sastav proizvoda
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                otvoriDodavanjeSirovine(a);
                              }}
                              title="Dodaj sirovinu u normativ"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 hover:scale-105"
                              style={{ backgroundColor: ACCENT }}
                            >
                              <Plus size={14} strokeWidth={3} />
                              Dodaj sirovinu
                            </button>
                          </div>
                          <table className="table-auto border-collapse">
                            <thead>
                              <tr>
                                <TH>Šif</TH>
                                <TH>Naziv sirovine</TH>
                                <TH center>JM</TH>
                                <TH center>Količina</TH>
                                <TH center>Akcije</TH>
                              </tr>
                            </thead>
                            <tbody>
                              {sastavSortiran.map((n) => (
                                <tr key={n.sifra_tabele}>
                                  <td
                                    className="px-3 py-1.5 text-sm font-mono border-t-2 border-gray-400 dark:border-[#5a4f80]"
                                    style={{ color: PRIMARY }}
                                  >
                                    {n.sifra_sirovine}
                                  </td>
                                  <td className="min-w-[260px] px-3 py-1.5 text-sm text-gray-700 dark:text-[#c5bfd8] border-t-2 border-gray-400 dark:border-[#5a4f80]">
                                    {n.naziv_sirovine}
                                  </td>
                                  <td className="px-3 py-1.5 text-sm text-center text-gray-500 dark:text-[#a99fc2] border-t-2 border-gray-400 dark:border-[#5a4f80]">
                                    {n.jm_sirovine}
                                  </td>
                                  <td className="px-3 py-1.5 text-sm text-right font-semibold text-gray-700 dark:text-[#c5bfd8] border-t-2 border-gray-400 dark:border-[#5a4f80]">
                                    {formatBroj(n.kolicina_sirovine, 3)}
                                  </td>
                                  <td className="px-3 py-1.5 text-center border-t-2 border-gray-400 dark:border-[#5a4f80]">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          otvoriIzmjenuNormativa(n);
                                        }}
                                        title="Izmijeni stavku normativa"
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-black/20"
                                        style={{ color: PRIMARY }}
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          obrisiStavkuNormativa(n);
                                        }}
                                        title="Obriši stavku normativa"
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-black/20 text-red-500 dark:text-red-400"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                    );
                  })()}
                  </>
                  );
                })}
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
                        <option key={j.sifra} value={j.naziv_jm}>
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

      {/* Modal — izmjena stavke normativa (potvrda prije snimanja) */}
      {stavkaZaIzmjenuNormativa && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cuvanjeNormativa) {
              zatvoriIzmjenuNormativa();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2 border-gray-100 dark:border-[#2d2648]">
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: PRIMARY }}
            >
              <div className="flex items-center gap-2">
                <Pencil size={17} className="text-white" />
                <h3 className="text-base font-bold text-white">
                  Izmjena stavke normativa
                </h3>
              </div>
              <button
                type="button"
                onClick={zatvoriIzmjenuNormativa}
                disabled={cuvanjeNormativa}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {greskaNormativa && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={15} />
                  {greskaNormativa}
                </div>
              )}

              <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 bg-[#faf9fc] dark:bg-[#1e1a2d] text-sm">
                <p className="text-gray-500 dark:text-[#a99fc2]">Sirovina</p>
                <p className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                  {stavkaZaIzmjenuNormativa.naziv_sirovine} (šif.{" "}
                  {stavkaZaIzmjenuNormativa.sifra_sirovine})
                </p>
              </div>

              <Field label={`Količina sirovine (${stavkaZaIzmjenuNormativa.jm_sirovine})`}>
                <input
                  type="number"
                  step="0.001"
                  value={kolicinaIzmjenaNormativa}
                  onChange={(e) => setKolicinaIzmjenaNormativa(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </Field>

              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Potvrdom mijenjaš normativ za ovaj proizvod — provjeri
                količinu prije snimanja.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2d2648] flex justify-end gap-2">
              <button
                type="button"
                onClick={zatvoriIzmjenuNormativa}
                disabled={cuvanjeNormativa}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={() => void potvrdiIzmjenuNormativa()}
                disabled={cuvanjeNormativa}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                {cuvanjeNormativa ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Potvrdi izmjenu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — brisanje stavke normativa (potvrda prije brisanja) */}
      {stavkaZaBrisanjeNormativa && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !brisanjeNormativaUToku) {
              zatvoriBrisanjeNormativa();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2 border-red-200 dark:border-red-900">
            <div className="px-5 py-4 flex items-center justify-between gap-4 bg-red-500">
              <div className="flex items-center gap-2">
                <Trash2 size={17} className="text-white" />
                <h3 className="text-base font-bold text-white">
                  Brisanje stavke normativa
                </h3>
              </div>
              <button
                type="button"
                onClick={zatvoriBrisanjeNormativa}
                disabled={brisanjeNormativaUToku}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {greskaBrisanjaNormativa && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={15} />
                  {greskaBrisanjaNormativa}
                </div>
              )}

              <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 bg-[#faf9fc] dark:bg-[#1e1a2d] text-sm">
                <p className="text-gray-500 dark:text-[#a99fc2]">Sirovina</p>
                <p className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                  {stavkaZaBrisanjeNormativa.naziv_sirovine} (šif.{" "}
                  {stavkaZaBrisanjeNormativa.sifra_sirovine})
                </p>
              </div>

              <p className="text-sm text-gray-700 dark:text-[#c5bfd8]">
                Da li sigurno želiš obrisati ovu stavku normativa? Ova akcija
                se ne može poništiti.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2d2648] flex justify-end gap-2">
              <button
                type="button"
                onClick={zatvoriBrisanjeNormativa}
                disabled={brisanjeNormativaUToku}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={() => void potvrdiBrisanjeNormativa()}
                disabled={brisanjeNormativaUToku}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 transition-all hover:brightness-110 disabled:opacity-50"
              >
                {brisanjeNormativaUToku ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                Obriši
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — dodavanje nove sirovine u normativ */}
      {dodavanjeSirovineZaProizvod && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cuvanjeNoveSirovine) {
              zatvoriDodavanjeSirovine();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2 border-gray-100 dark:border-[#2d2648]">
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: ACCENT }}
            >
              <div className="flex items-center gap-2">
                <Plus size={17} className="text-white" />
                <h3 className="text-base font-bold text-white">
                  Dodaj sirovinu u normativ
                </h3>
              </div>
              <button
                type="button"
                onClick={zatvoriDodavanjeSirovine}
                disabled={cuvanjeNoveSirovine}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {greskaNoveSirovine && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={15} />
                  {greskaNoveSirovine}
                </div>
              )}

              {/* Proizvod na koji se normativ vezuje — prikazano i pored
                  fokusa radi dodatne sigurnosti operatera. */}
              <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 bg-[#faf9fc] dark:bg-[#1e1a2d] text-sm">
                <p className="text-gray-500 dark:text-[#a99fc2]">
                  Normativ se dodaje za proizvod
                </p>
                <p className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                  {dodavanjeSirovineZaProizvod.naziv_proizvoda} (šif.{" "}
                  {dodavanjeSirovineZaProizvod.sifra_proizvoda})
                </p>
              </div>

              <Field label="Sirovina *">
                <select
                  value={sirovinaZaDodavanje}
                  onChange={(e) => setSirovinaZaDodavanje(e.target.value)}
                  className={inputClass}
                >
                  {sirovineOpcije.length === 0 && (
                    <option value="">Nema dostupnih sirovina</option>
                  )}
                  {sirovineOpcije.map((s) => (
                    <option
                      key={s.sifra_proizvoda}
                      value={String(s.sifra_proizvoda)}
                    >
                      {s.naziv_proizvoda} (šif. {s.sifra_proizvoda})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Količina sirovine (na 3 decimale) *">
                <input
                  type="number"
                  step="0.001"
                  value={kolicinaNovaSirovina}
                  onChange={(e) => setKolicinaNovaSirovina(e.target.value)}
                  placeholder="0.000"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#2d2648] flex justify-end gap-2">
              <button
                type="button"
                onClick={zatvoriDodavanjeSirovine}
                disabled={cuvanjeNoveSirovine}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={() => void potvrdiDodavanjeSirovine()}
                disabled={cuvanjeNoveSirovine}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                {cuvanjeNoveSirovine ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
