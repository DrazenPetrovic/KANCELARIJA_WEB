import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  FileText,
  Landmark,
  Loader2,
  Percent,
  RefreshCcw,
  Search,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.kalkulacija_gl_pregled() — zaglavlje kalkulacije.
interface KalkulacijaGlavni {
  sifra_kalkulacije: number;
  datum_kalkulacije: string;
  sifra_dobavljaca: number;
  naziv_dobavljaca: string | null;
  adresa_dobavljaca: string | null;
  grad_dobavljaca: string | null;
  drzava_dobavljaca: string | null;
  jib_dobavljaca: string | null;
  pib_dobavljaca: string | null;
  broj_racuna: string | null;
  ukupno_km: number;
  ukupno_rab: number;
  datum_unosa_kalkulacije: string | null;
  duzi_se_za_iznos: number;
  racun_placen: string | number | null;
  vreme: string | null;
  vrsta_kalkulacije: string | null;
  valuta: string | null;
  veza: string | number | null;
  kalkulacija_robe: string | number | null;
  vp_vrednost: number;
  u_sistemu_pdv: string | number | null;
  sifra_knjizenja: string | number | null;
  sinhronizovano: string | number | null;
  tip_dokumenta_el_kuf: string | null;
}

// Red vraćen sa erp.kalkulacija_po_pregled() — stavka (proizvod) kalkulacije.
interface KalkulacijaStavka {
  sifra_tbl: number;
  sifra_kalkulacije: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string | null;
  jm: string | null;
  kolicina: number;
  cijena: number;
  rabat: number;
  fakturisana_cijena: number;
  vpc: number;
  nasa_ulazna_cijena: number;
  akcijski_rabat: number;
  stornirano: string | number | null;
}

// Red vraćen sa erp.kalkulacija_zavisni_trosak_pregled(). sifra_kalkulacije je
// KALK na koji se trošak odnosi, sifra_zavisnog_troska je šifra samog ZT-a
// (red u kalkulacija_gl_pregled).
interface ZavisniTrosak {
  sifra_kalkulacije: number;
  naziv_troska: string | null;
  ukupno_km: number;
  ukupno_pdv: number;
  sifra_zavisnog_troska: number;
  vrsta_pdv: string | number | null;
}

// KALK sa pripadajućim zavisnim troškovima (ZT) — vidi grupisanje u komponenti.
interface KalkulacijaGrupa {
  glavna: KalkulacijaGlavni;
  zt: KalkulacijaGlavni[];
}

const ZT_BOJA = "#E0913A";

// Brzi filteri iznad tabele — primjenjuju se odmah, bez klika na "Prikaži".
type BrziFilter =
  | "sve"
  | "sa-zt"
  | "bez-zt"
  | "neplacene"
  | "sirovina"
  | "roba"
  | "ko";

const KO_BOJA = "#2A9D8F";

const jeKo = (k: { vrsta_kalkulacije: string | null }) =>
  (k.vrsta_kalkulacije ?? "").trim().toUpperCase() === "KO";

const BRZI_FILTERI: { kod: BrziFilter; naziv: string; boja: string }[] = [
  { kod: "sve", naziv: "Sve", boja: PRIMARY },
  { kod: "sa-zt", naziv: "Sa ZT", boja: ZT_BOJA },
  { kod: "bez-zt", naziv: "Bez ZT", boja: PRIMARY },
  { kod: "neplacene", naziv: "Neplaćene", boja: "#e0564f" },
  { kod: "sirovina", naziv: "Sirovina", boja: "#b45309" },
  { kod: "roba", naziv: "Roba", boja: ACCENT },
  { kod: "ko", naziv: "KO", boja: KO_BOJA },
];

// Artikal iz erp.artikli_pregled_sve — treba samo oznaka sirovine (1 = sirovina).
interface ArtikalSirovina {
  sifra_proizvoda: number;
  sirovina?: number | string | null;
}

// ZT-ovi grupe u redoslijedu prikaza (iznad KALK-a): opadajuće po šifri.
const ztOdozgo = (g: KalkulacijaGrupa) =>
  [...g.zt].sort(
    (a, b) => Number(b.sifra_kalkulacije) - Number(a.sifra_kalkulacije),
  );

const jeZt = (k: KalkulacijaGlavni) =>
  (k.vrsta_kalkulacije ?? "").trim().toUpperCase() === "ZT";

const formatBroj =(v: number | null | undefined, decimale = 2) =>
  Number(v ?? 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: decimale,
      maximumFractionDigits: decimale,
    })
    .replace(/,/g, " ");

const formatIznos = (v: number | null | undefined) => `${formatBroj(v)} KM`;

// Formatira lokalni datum kao yyyy-MM-dd (bez prolaska kroz UTC, jer
// toISOString() pomjera datum unazad za korisnike u zonama ispred UTC-a).
const formatDatumISO = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const prviDanMjeseca = () => {
  const d = new Date();
  return formatDatumISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => formatDatumISO(new Date());

const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const formatSifru = (v: string | number | null | undefined): string =>
  v && String(v) !== "0" ? String(v) : "-";

// Flagovi (racun_placen, u_sistemu_pdv, stornirano...) mogu stići kao 0/1,
// "0"/"1" ili "DA"/"NE" — sve se svodi na boolean.
const jeDa = (v: string | number | null | undefined): boolean => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toUpperCase();
  return s === "1" || s === "DA" || s === "D" || s === "TRUE";
};

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl shadow-sm px-4 py-3 flex-1 min-w-[170px] border border-gray-100 dark:border-[#2d2648]">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-gray-800 dark:text-[#ede9f6]">
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
  primarno,
}: {
  children: React.ReactNode;
  right?: boolean;
  // Zaglavlje u primarnoj boji sa bijelim tekstom (tabela stavki u modalu).
  primarno?: boolean;
}) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${primarno ? "text-white" : "bg-[#faf9fc] dark:bg-[#1e1a2d] text-gray-400 dark:text-[#5f5878]"} ${right ? "text-right" : "text-left"}`}
    style={primarno ? { background: PRIMARY } : undefined}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
  naglaseno,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  // Bold u primarnoj boji — KALK red koji ima zavisne troškove.
  naglaseno?: boolean;
}) => (
  <td
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold || naglaseno ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
    style={naglaseno ? { color: PRIMARY } : undefined}
  >
    {children}
  </td>
);

const Znacka = ({ tekst, boja }: { tekst: string; boja: string }) => (
  <span
    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
    style={{ background: `${boja}1f`, color: boja }}
  >
    {tekst}
  </span>
);

export function KalkulacijePregled() {
  const [datumOd, setDatumOd] = useState(prviDanMjeseca());
  const [datumDo, setDatumDo] = useState(danas());
  // Primijenjeni period — mijenja se samo na klik "Prikaži", da odabir datuma
  // sam po sebi ne filtrira tabelu.
  const [primenjeniOd, setPrimenjeniOd] = useState(datumOd);
  const [primenjeniDo, setPrimenjeniDo] = useState(datumDo);
  const [pretraga, setPretraga] = useState("");
  const [brziFilter, setBrziFilter] = useState<BrziFilter>("sve");
  const [kalkulacije, setKalkulacije] = useState<KalkulacijaGlavni[]>([]);
  const [stavke, setStavke] = useState<KalkulacijaStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [odabrana, setOdabrana] = useState<KalkulacijaGlavni | null>(null);
  const [zavisniTroskovi, setZavisniTroskovi] = useState<ZavisniTrosak[]>([]);
  const [artikli, setArtikli] = useState<ArtikalSirovina[]>([]);
  const datumOdRef = useRef<HTMLInputElement>(null);
  const datumDoRef = useRef<HTMLInputElement>(null);

  const otvoriPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  };

  const dohvati = async <T,>(putanja: string, poruka: string): Promise<T[]> => {
    const res = await fetch(`${API_URL}${putanja}`, { credentials: "include" });
    if (!res.ok) throw new Error(poruka);
    const json = await res.json();
    return json.data ?? [];
  };

  // Procedure ne primaju parametre (vraćaju sve) — period i pretraga se
  // filtriraju ovdje, a stavke i ZT troškovi se grupišu po šifri.
  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    Promise.all([
      dohvati<KalkulacijaGlavni>(
        "/api/kalkulacije/glavni",
        "Greška pri učitavanju kalkulacija",
      ),
      dohvati<KalkulacijaStavka>(
        "/api/kalkulacije/stavke",
        "Greška pri učitavanju stavki kalkulacija",
      ),
      dohvati<ZavisniTrosak>(
        "/api/kalkulacije/zavisni-troskovi",
        "Greška pri učitavanju zavisnih troškova",
      ),
      // Oznaka sirovine po artiklu — za brze filtere Sirovina / Roba.
      dohvati<ArtikalSirovina>(
        "/api/artikli/pregled-sve",
        "Greška pri učitavanju artikala",
      ),
    ])
      .then(([gl, po, zt, art]) => {
        setKalkulacije(gl);
        setStavke(po);
        setZavisniTroskovi(zt);
        setArtikli(art);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  useEffect(() => {
    if (!odabrana) return;
    const naTipku = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOdabrana(null);
    };
    window.addEventListener("keydown", naTipku);
    return () => window.removeEventListener("keydown", naTipku);
  }, [odabrana]);

  const prikazi = () => {
    setPrimenjeniOd(datumOd);
    setPrimenjeniDo(datumDo);
    ucitaj();
  };

  const stavkePoKalkulaciji = useMemo(() => {
    const m = new Map<number, KalkulacijaStavka[]>();
    for (const s of stavke) {
      const kljuc = Number(s.sifra_kalkulacije);
      const lista = m.get(kljuc);
      if (lista) lista.push(s);
      else m.set(kljuc, [s]);
    }
    return m;
  }, [stavke]);

  // Sastav kalkulacije po nestorniranim stavkama: ima li sirovina i/ili robe
  // (artikal koji nije sirovina). Mješovita kalkulacija ima oba i pojavljuje
  // se i pod filterom Sirovina i pod filterom Roba.
  const sastavKalkulacije = useMemo(() => {
    const sirovine = new Set<number>();
    for (const a of artikli) {
      if (Number(a.sirovina) === 1) sirovine.add(Number(a.sifra_proizvoda));
    }
    const m = new Map<number, { sirovina: boolean; roba: boolean }>();
    for (const [sifra, lista] of stavkePoKalkulaciji) {
      const sastav = { sirovina: false, roba: false };
      for (const s of lista) {
        if (jeDa(s.stornirano)) continue;
        if (sirovine.has(Number(s.sifra_proizvoda))) sastav.sirovina = true;
        else sastav.roba = true;
      }
      m.set(sifra, sastav);
    }
    return m;
  }, [artikli, stavkePoKalkulaciji]);

  // Troškovi po šifri ZT dokumenta (za modal) i veza ZT → KALK.
  const troskoviPoZt = useMemo(() => {
    const m = new Map<number, ZavisniTrosak[]>();
    for (const t of zavisniTroskovi) {
      const kljuc = Number(t.sifra_zavisnog_troska);
      const lista = m.get(kljuc);
      if (lista) lista.push(t);
      else m.set(kljuc, [t]);
    }
    return m;
  }, [zavisniTroskovi]);

  const kalkZaZt = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of zavisniTroskovi) {
      m.set(Number(t.sifra_zavisnog_troska), Number(t.sifra_kalkulacije));
    }
    return m;
  }, [zavisniTroskovi]);

  // Grupisanje KALK + ZT: ZT ide uz KALK naveden u
  // kalkulacija_zavisni_trosak_pregled. Ako ZT tamo nema vezu (ili KALK nije
  // u listi), pripada posljednjem KALK-u prije njega po šifri (KALK 780 → ZT
  // 781, 782 … dok ne naiđe sljedeći KALK). ZT bez ikakvog KALK-a je svoja grupa.
  const grupe = useMemo(() => {
    const sortirano = [...kalkulacije].sort(
      (a, b) => Number(a.sifra_kalkulacije) - Number(b.sifra_kalkulacije),
    );
    const rezultat: KalkulacijaGrupa[] = [];
    const grupaPoKalk = new Map<number, KalkulacijaGrupa>();
    for (const k of sortirano) {
      if (!jeZt(k)) {
        const g: KalkulacijaGrupa = { glavna: k, zt: [] };
        rezultat.push(g);
        grupaPoKalk.set(Number(k.sifra_kalkulacije), g);
      }
    }
    let posljednjaKalk: KalkulacijaGrupa | undefined;
    for (const k of sortirano) {
      if (!jeZt(k)) {
        posljednjaKalk = grupaPoKalk.get(Number(k.sifra_kalkulacije));
        continue;
      }
      const vezaniKalk = kalkZaZt.get(Number(k.sifra_kalkulacije));
      const grupa =
        (vezaniKalk !== undefined ? grupaPoKalk.get(vezaniKalk) : undefined) ??
        posljednjaKalk;
      if (grupa) grupa.zt.push(k);
      else rezultat.push({ glavna: k, zt: [] });
    }
    return rezultat;
  }, [kalkulacije, kalkZaZt]);

  // Period se gleda po datumu KALK-a (ZT idu uz svoj KALK i kad imaju
  // drugačiji datum); pretraga pogađa grupu ako odgovara bilo koji član.
  const grupeFiltrirano = useMemo(() => {
    const od = primenjeniOd ? new Date(`${primenjeniOd}T00:00:00`) : null;
    const doo = primenjeniDo ? new Date(`${primenjeniDo}T23:59:59`) : null;
    const q = pretraga.trim().toLowerCase();
    const odgovara = (k: KalkulacijaGlavni) =>
      String(k.sifra_kalkulacije).includes(q) ||
      (k.broj_racuna ?? "").toLowerCase().includes(q) ||
      (k.naziv_dobavljaca ?? "").toLowerCase().includes(q);
    return grupe
      .filter((g) => {
        const d = new Date(g.glavna.datum_kalkulacije);
        if (isNaN(d.getTime())) return false;
        if (od && d < od) return false;
        if (doo && d > doo) return false;
        if (brziFilter === "sa-zt" && g.zt.length === 0) return false;
        if (brziFilter === "bez-zt" && g.zt.length > 0) return false;
        if (brziFilter === "neplacene" && jeDa(g.glavna.racun_placen))
          return false;
        if (brziFilter === "ko" && !jeKo(g.glavna)) return false;
        if (brziFilter === "sirovina" || brziFilter === "roba") {
          const sastav = sastavKalkulacije.get(
            Number(g.glavna.sifra_kalkulacije),
          );
          if (!sastav?.[brziFilter]) return false;
        }
        if (!q) return true;
        return odgovara(g.glavna) || g.zt.some(odgovara);
      })
      // Redoslijed po datumu unosa KALK-a (najnoviji prvi), pa po šifri.
      .sort((a, b) => {
        const vrijeme = (k: KalkulacijaGlavni) => {
          const t = new Date(k.datum_unosa_kalkulacije ?? "").getTime();
          return isNaN(t) ? 0 : t;
        };
        return (
          vrijeme(b.glavna) - vrijeme(a.glavna) ||
          b.glavna.sifra_kalkulacije - a.glavna.sifra_kalkulacije
        );
      });
  }, [
    grupe,
    primenjeniOd,
    primenjeniDo,
    pretraga,
    brziFilter,
    sastavKalkulacije,
  ]);

  const filtrirano = useMemo(
    () => grupeFiltrirano.flatMap((g) => [...ztOdozgo(g), g.glavna]),
    [grupeFiltrirano],
  );

  const brojKalk = useMemo(
    () => grupeFiltrirano.filter((g) => !jeZt(g.glavna)).length,
    [grupeFiltrirano],
  );
  const ukupnoZt = useMemo(
    () =>
      filtrirano
        .filter(jeZt)
        .reduce((s, k) => s + Number(k.ukupno_km || 0), 0),
    [filtrirano],
  );

  const ukupnoKm = useMemo(
    () => filtrirano.reduce((s, k) => s + Number(k.ukupno_km || 0), 0),
    [filtrirano],
  );
  const ukupnoRab = useMemo(
    () => filtrirano.reduce((s, k) => s + Number(k.ukupno_rab || 0), 0),
    [filtrirano],
  );
  const ukupnoVp = useMemo(
    () => filtrirano.reduce((s, k) => s + Number(k.vp_vrednost || 0), 0),
    [filtrirano],
  );

  const odabranaJeZt = odabrana ? jeZt(odabrana) : false;
  const odabraneStavke = odabrana
    ? (stavkePoKalkulaciji.get(Number(odabrana.sifra_kalkulacije)) ?? [])
    : [];
  const odabraniTroskovi = odabrana
    ? (troskoviPoZt.get(Number(odabrana.sifra_kalkulacije)) ?? [])
    : [];
  const vezaniKalkOdabranog = odabrana
    ? kalkZaZt.get(Number(odabrana.sifra_kalkulacije))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Calculator size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Pregled kalkulacija
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Kalkulacije za izabrani period — klik na red otvara stavke
          </p>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum od
            </span>
            <div
              className="relative cursor-pointer"
              onClick={() => otvoriPicker(datumOdRef)}
            >
              <input
                ref={datumOdRef}
                type="date"
                value={datumOd}
                onChange={(e) => setDatumOd(e.target.value)}
                style={{ color: "transparent" }}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
              />
              <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
                {formatDatumDMY(datumOd) ?? "Izaberite datum"}
              </div>
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum do
            </span>
            <div
              className="relative cursor-pointer"
              onClick={() => otvoriPicker(datumDoRef)}
            >
              <input
                ref={datumDoRef}
                type="date"
                value={datumDo}
                onChange={(e) => setDatumDo(e.target.value)}
                style={{ color: "transparent" }}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
              />
              <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
                {formatDatumDMY(datumDo) ?? "Izaberite datum"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={prikazi}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
            {!loading && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                {filtrirano.length}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-[180px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Pretraga
            </span>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
              />
              <input
                type="text"
                value={pretraga}
                onChange={(e) => setPretraga(e.target.value)}
                placeholder="Dobavljač, broj računa ili šifra kalkulacije"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Brzi filter
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BRZI_FILTERI.map((f) => {
                const aktivan = brziFilter === f.kod;
                return (
                  <button
                    key={f.kod}
                    type="button"
                    onClick={() => setBrziFilter(f.kod)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${aktivan ? "text-white" : "bg-white dark:bg-[#1e1a2d] border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:border-[#785E9E]"}`}
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
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<FileText size={16} />}
            vrijednost={String(brojKalk)}
            naziv="Broj kalkulacija (KALK)"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Truck size={16} />}
            vrijednost={formatIznos(ukupnoZt)}
            naziv="Zavisni troškovi (ZT)"
            boja={ZT_BOJA}
          />
          <StatTile
            icon={<TrendingUp size={16} />}
            vrijednost={formatIznos(ukupnoKm)}
            naziv="Ukupno KM"
            boja={ACCENT}
          />
          <StatTile
            icon={<Percent size={16} />}
            vrijednost={formatIznos(ukupnoRab)}
            naziv="Ukupno rabat"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Landmark size={16} />}
            vrijednost={formatIznos(ukupnoVp)}
            naziv="VP vrijednost"
            boja={PRIMARY}
          />
        </div>
      )}

      {loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {greska && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          <button
            type="button"
            onClick={ucitaj}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {!loading && !greska && filtrirano.length === 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
          <Calculator size={28} />
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Nema kalkulacija za izabrani period.
          </p>
        </div>
      )}

      {!loading && !greska && filtrirano.length > 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#2d2648] sticky top-0 z-10">
                  <TH>Šifra</TH>
                  <TH>Datum unosa</TH>
                  <TH>Broj računa / datum kalk.</TH>
                  <TH>Dobavljač</TH>
                  <TH>JIB / PIB</TH>
                  <TH>Vrsta</TH>
                  <TH right>Stavki</TH>
                  <TH right>Rabat</TH>
                  <TH right>VP vrijednost</TH>
                  <TH right>Ukupno</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {grupeFiltrirano.flatMap((g) => {
                  const ztUkupno = g.zt.reduce(
                    (s, z) => s + Number(z.ukupno_km || 0),
                    0,
                  );
                  // ZT redovi idu iznad, opadajuće po šifri, tako da je najmanji
                  // ZT odmah iznad nosećeg KALK-a na dnu grupe (… 834, 833, 832).
                  return [...ztOdozgo(g), g.glavna].map((k, i) => {
                    const zt = jeZt(k);
                    const prviUGrupi = i === 0;
                    // KALK koji ima ZT dijeli pozadinu sa svojim ZT redovima,
                    // a tekst mu je bold u primarnoj boji.
                    const kalkSaZt = !zt && g.zt.length > 0;
                    const naglasi = kalkSaZt ? { color: PRIMARY } : undefined;
                    return (
                  <tr
                    key={k.sifra_kalkulacije}
                    onClick={() => setOdabrana(k)}
                    className={`${prviUGrupi ? "border-t-2 border-gray-200 dark:border-[#3a3158]" : "border-t border-dashed border-gray-100 dark:border-[#2d2648]"} transition-colors cursor-pointer ${zt || kalkSaZt ? "hover:brightness-95" : "hover:bg-[#faf9fc] dark:hover:bg-[#1e1a2d]"}`}
                    style={
                      zt || kalkSaZt
                        ? { background: `${ZT_BOJA}12` }
                        : undefined
                    }
                  >
                    <td
                      className="px-3 py-2.5 whitespace-nowrap text-gray-600 dark:text-[#c5bfd8]"
                      style={{
                        borderLeft: `4px solid ${zt ? ZT_BOJA : PRIMARY}`,
                      }}
                    >
                      {zt && k !== g.glavna ? (
                        <span className="pl-3" style={{ color: ZT_BOJA }}>
                          ↳ {k.sifra_kalkulacije}
                        </span>
                      ) : (
                        <span
                          className={`${kalkSaZt ? "font-bold" : "font-semibold"} text-gray-800 dark:text-[#ede9f6]`}
                          style={naglasi}
                        >
                          {k.sifra_kalkulacije}
                        </span>
                      )}
                    </td>
                    <TD naglaseno={kalkSaZt}>
                      {formatDatumDMY(k.datum_unosa_kalkulacije) ?? "—"}
                    </TD>
                    <TD>
                      <div
                        className={`${kalkSaZt ? "font-bold" : "font-semibold"} text-gray-800 dark:text-[#ede9f6]`}
                        style={naglasi}
                      >
                        {k.broj_racuna || "—"}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {formatDatumDMY(k.datum_kalkulacije) ?? "—"}
                      </div>
                    </TD>
                    <TD>
                      <div
                        className={`${kalkSaZt ? "font-bold" : "font-semibold"} text-gray-800 dark:text-[#ede9f6] truncate max-w-[260px]`}
                        style={naglasi}
                      >
                        {k.naziv_dobavljaca || "—"}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878] truncate max-w-[260px]">
                        {[k.adresa_dobavljaca, k.grad_dobavljaca]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </TD>
                    <TD naglaseno={kalkSaZt}>
                      <div>{formatSifru(k.jib_dobavljaca)}</div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {formatSifru(k.pib_dobavljaca)}
                      </div>
                    </TD>
                    <TD>
                      {k.vrsta_kalkulacije ? (
                        <Znacka
                          tekst={k.vrsta_kalkulacije.trim().toUpperCase()}
                          boja={zt ? ZT_BOJA : jeKo(k) ? KO_BOJA : PRIMARY}
                        />
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD right naglaseno={kalkSaZt}>
                      {(zt
                        ? troskoviPoZt
                        : stavkePoKalkulaciji
                      ).get(Number(k.sifra_kalkulacije))?.length ?? 0}
                    </TD>
                    <TD right naglaseno={kalkSaZt}>
                      {formatIznos(k.ukupno_rab)}
                    </TD>
                    <TD right naglaseno={kalkSaZt}>
                      {formatIznos(k.vp_vrednost)}
                    </TD>
                    <TD right bold naglaseno={kalkSaZt}>
                      <div>{formatIznos(k.ukupno_km)}</div>
                      {k === g.glavna && g.zt.length > 0 && (
                        <div
                          className="text-[10px] font-semibold"
                          style={{ color: ZT_BOJA }}
                          title="Kalkulacija + zavisni troškovi"
                        >
                          + ZT {formatIznos(ztUkupno)} ={" "}
                          {formatIznos(Number(k.ukupno_km || 0) + ztUkupno)}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        {jeDa(k.racun_placen) ? (
                          <Znacka tekst="PLAĆEN" boja={ACCENT} />
                        ) : (
                          <Znacka tekst="NEPLAĆEN" boja="#e0564f" />
                        )}
                        {jeDa(k.u_sistemu_pdv) && (
                          <Znacka tekst="PDV" boja={PRIMARY} />
                        )}
                      </div>
                    </TD>
                  </tr>
                    );
                  });
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                  <TD bold>Ukupno</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD right>{formatIznos(ukupnoRab)}</TD>
                  <TD right>{formatIznos(ukupnoVp)}</TD>
                  <TD right bold>
                    {formatIznos(ukupnoKm)}
                  </TD>
                  <TD>{""}</TD>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal sa stavkama kalkulacije */}
      {odabrana && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOdabrana(null)}
        >
          <div
            className="bg-white dark:bg-[#261f38] rounded-2xl shadow-xl border-2 w-full max-w-6xl max-h-[90vh] flex flex-col"
            style={{ borderColor: PRIMARY }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 px-5 py-4 rounded-t-[14px]"
              style={{ background: PRIMARY }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20">
                <Calculator size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">
                  {odabranaJeZt
                    ? `Zavisni trošak ${odabrana.sifra_kalkulacije}`
                    : `Stavke kalkulacije ${odabrana.sifra_kalkulacije}`}
                </h3>
                {odabranaJeZt && vezaniKalkOdabranog !== undefined && (
                  <p className="text-xs text-white/80">
                    Vezan za kalkulaciju {vezaniKalkOdabranog}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOdabrana(null)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {odabranaJeZt ? (
              <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <TH primarno>#</TH>
                      <TH primarno>Naziv troška</TH>
                      <TH primarno>Vrsta PDV</TH>
                      <TH primarno right>PDV</TH>
                      <TH primarno right>Ukupno</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {odabraniTroskovi.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                        >
                          Nema podataka o zavisnom trošku.
                        </td>
                      </tr>
                    )}
                    {odabraniTroskovi.map((t, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-200 dark:border-[#3a3158]"
                      >
                        <TD>{i + 1}</TD>
                        <TD>
                          <span className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                            {t.naziv_troska || "—"}
                          </span>
                        </TD>
                        <TD>{t.vrsta_pdv ?? "—"}</TD>
                        <TD right>{formatIznos(t.ukupno_pdv)}</TD>
                        <TD right bold>
                          {formatIznos(t.ukupno_km)}
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                  {odabraniTroskovi.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                        <TD bold>Ukupno</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD right>
                          {formatIznos(
                            odabraniTroskovi.reduce(
                              (s, t) => s + Number(t.ukupno_pdv || 0),
                              0,
                            ),
                          )}
                        </TD>
                        <TD right bold>
                          {formatIznos(
                            odabraniTroskovi.reduce(
                              (s, t) => s + Number(t.ukupno_km || 0),
                              0,
                            ),
                          )}
                        </TD>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              ) : (
              <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <TH primarno>#</TH>
                      <TH primarno>Proizvod</TH>
                      <TH primarno right>Količina</TH>
                      <TH primarno right>Cijena</TH>
                      <TH primarno right>Rabat %</TH>
                      <TH primarno right>Akc. rabat %</TH>
                      <TH primarno right>Fakt. cijena</TH>
                      <TH primarno right>Naša ulazna</TH>
                      <TH primarno right>VPC</TH>
                      <TH primarno right>Iznos (fakt.)</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {odabraneStavke.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                        >
                          Kalkulacija nema stavki.
                        </td>
                      </tr>
                    )}
                    {odabraneStavke.map((s, i) => {
                      const stornirano = jeDa(s.stornirano);
                      return (
                        <tr
                          key={s.sifra_tbl}
                          className={`border-b border-gray-200 dark:border-[#3a3158] ${stornirano ? "opacity-50 line-through" : ""}`}
                        >
                          <TD>{i + 1}</TD>
                          <TD>
                            <div className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                              {s.naziv_proizvoda || "—"}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                              šifra {s.sifra_proizvoda}
                              {s.jm ? ` · ${s.jm}` : ""}
                              {stornirano ? " · STORNIRANO" : ""}
                            </div>
                          </TD>
                          <TD right>{formatBroj(s.kolicina, 3)}</TD>
                          <TD right>{formatBroj(s.cijena, 3)}</TD>
                          <TD right>{formatBroj(s.rabat)}</TD>
                          <TD right>{formatBroj(s.akcijski_rabat)}</TD>
                          <TD right>{formatBroj(s.fakturisana_cijena, 3)}</TD>
                          <TD right>{formatBroj(s.nasa_ulazna_cijena, 3)}</TD>
                          <TD right>{formatBroj(s.vpc)}</TD>
                          <TD right bold>
                            {formatIznos(
                              Number(s.kolicina || 0) *
                                Number(s.fakturisana_cijena || 0),
                            )}
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                  {odabraneStavke.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                        <TD bold>Ukupno</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD>{""}</TD>
                        <TD right bold>
                          {formatIznos(
                            odabraneStavke
                              .filter((s) => !jeDa(s.stornirano))
                              .reduce(
                                (sum, s) =>
                                  sum +
                                  Number(s.kolicina || 0) *
                                    Number(s.fakturisana_cijena || 0),
                                0,
                              ),
                          )}
                        </TD>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
