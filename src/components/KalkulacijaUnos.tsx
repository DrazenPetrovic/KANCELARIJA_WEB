import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const SIROVINA_BOJA = "#b45309";
const PDV_STOPA = 0.17;
// Fiksni kurs konvertibilne marke (1 EUR = 1,95583 KM) — dugme €→KM kod cijene.
const KURS_EUR = 1.95583;
// TEST: pored upisa u bazu, "Zaključi kalkulaciju" preuzima i JSON poslat
// proceduri, radi provjere. Isključiti (false) kad testiranje završi —
// inače bi svako zaključenje ostavljalo fajl u Downloads.
const PREUZMI_JSON_PRI_ZAKLJUCENJU = true;
// Šifra države BiH (domaći partner) — vidi erp.sp_partneri_drzave i
// SIFRA_DRZAVE_BIH u racuniZiralni. Sve ostale države su ino.
const SIFRA_DRZAVE_BIH = 1;
// UIO (Uprava za indirektno oporezivanje) — uplata njima je PDV, a ne trošak
// proizvoda: uneseni iznos ZT stavke je uvijek domaći PDV, bez izbora.
const SIFRA_PARTNERA_UIO = 2020;

// Red sa /api/partneri/lista-sve (isti izvor kao PartneriPregled).
interface Partner {
  partner_id: number;
  naziv: string;
  jib: string | null;
  pib: string | null;
  pdv_obveznik: number | string | null;
  tip_partnera: string | null;
  adresa: string | null;
  grad: string | null;
  drzava: string | null;
  valuta_placanja: number | null;
  aktivan: number | string | null;
}

interface Drzava {
  sifra_drzave: number;
  naziv_drzave: string;
}

// Red sa erp.artikli_pregled_sve (/api/artikli/pregled-sve) — za razliku od
// /api/artikli vraća i sirovine, a kalkulacija mora moći da zaprimi oboje.
interface Artikal {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  nabavna_cijena: number | string;
  kolicina_proizvoda: number | string;
  barkod: string;
  vrsta_proizvoda: number | string;
  sirovina?: number | string | null;
  [key: string]: unknown;
}

// Jedna kalkulacija je ili ulaz sirovine ili ulaz robe — ne miješaju se.
// Sirovina nema VPC, pa se za nju VPC ne unosi niti šalje.
type VrstaKalkulacije = "sirovina" | "roba";

interface StavkaKalkulacije {
  id: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  cijena: number;
  rabat: number;
  akcijskiRabat: number;
  // true = fakturnu cijenu je operater upisao ručno (ne računa se iz cijene
  // i rabata).
  fakturnaRucno: boolean;
  fakturnaCijena: number;
  vpc: number;
}

// Red sa erp.kalkulacija_zavisan_trosak_vrste
// (/api/kalkulacije/zavisni-troskovi/vrste).
interface VrstaTroska {
  sifra: number;
  naziv_zavisnog_troska: string;
}

// Tip dokumenta za elektronsku KUF (isti šifarnik kao TIP_DOKUMENTA_NAZIV u
// Kuf.tsx); u bazu ide šifra ("01"...).
const TIP_DOKUMENTA = [
  { sifra: "01", naziv: "Ulazne fakture za robu i usluge iz zemlje" },
  { sifra: "02", naziv: "Ulazna faktura za vlastitu potrošnju" },
  { sifra: "03", naziv: "Ulazna faktura – avansna (Dati avansi)" },
  { sifra: "04", naziv: "JCI (Uvoz)" },
  {
    sifra: "05",
    naziv: "Ostalo (Fakture za usluge primljene iz inostranstva itd)",
  },
];

// PDV na vezani trošak bira operater: bez PDV-a, domaći ili ino PDV.
type PdvTroska = "bez" | "domaci" | "ino";

// Stavka računa vezanih troškova (prevoz, carinjenje, taksa...).
interface StavkaTroska {
  id: number;
  tipDokumenta: string;
  sifraVrste: number;
  nazivVrste: string;
  napomena: string;
  iznos: number;
  pdv: PdvTroska;
  // UIO: uneseni iznos je sam PDV (domaći), osnovica troška je 0 — ne ulazi
  // u nabavnu cijenu proizvoda.
  samoPdv?: boolean;
  pdvIznos?: number;
}

// Račun vezanih troškova jednog partnera — partner, broj i datum se unose
// jednom, a račun ima jednu ili više stavki. Kalkulacija može imati više
// računa.
interface VezaniRacun {
  id: number;
  partnerId: number;
  nazivPartnera: string;
  brojRacuna: string;
  datum: string;
  stavke: StavkaTroska[];
}

// Vezani (zavisni) trošak u ravnom obliku — jedna stavka računa sa podacima
// njenog računa. Ovako ide u JSON (zavisni_troskovi) i u obračun.
interface VezaniTrosak {
  id: number;
  sifraVrste: number;
  nazivVrste: string;
  partnerId: number;
  nazivPartnera: string;
  tipDokumenta: string;
  datum: string;
  brojRacuna: string;
  napomena: string;
  iznos: number;
  pdv: PdvTroska;
  samoPdv?: boolean;
  pdvIznos?: number;
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6] disabled:opacity-50";
// Polja samo za čitanje (nabavna, zadnje fakturisano, zaključana VPC) —
// prozirna siva podloga bez okvira, da je jasno da se u njih ne unosi.
const samoCitanjeClass =
  "w-full px-3 py-2.5 text-sm rounded-xl border border-dashed border-white/50 bg-black/20 text-white/90 tabular-nums cursor-not-allowed select-none focus:outline-none";
// Crveni okvir kartice kojoj nedostaje obavezan podatak.
const nedostajeClass =
  "!border-red-500 dark:!border-red-500 ring-[3px] ring-red-500";
// Number input bez strelica gore/dole (Chrome/Edge i Firefox).
const bezStrelica =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";
const karticaClass =
  "bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3";

const broj = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round5 = (n: number) => Math.round(n * 100000) / 100000;

const formatBroj = (v: number, decimale = 2) =>
  v.toLocaleString("bs-BA", {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  });

const p2 = (n: number) => String(n).padStart(2, "0");

// Polja koja u JSON idu kao decimalni broj sa tačno 5 decimala — npr.
// 52 → 52.00000. JSON.stringify sam ispisuje 52, pa se vrijednost privremeno
// pretvara u oznaku i vraća kao broj.
const DECIMALNA_POLJA = new Set([
  "cijena",
  "fakturisana_cijena",
  "nasa_ulazna_cijena",
]);

// Iznosi u KM: cijeli broj ostaje cijeli (20, 1750), a decimalni ide sa
// tačno 2 decimale (101.5 → 101.50).
const IZNOS_POLJA = new Set([
  "ukupno_km",
  "duzi_se_za_iznos",
  "ukupno_rab",
  "ukupno_pdv",
  "iznos",
  "iznos_pdv",
]);

const decimalniBroj = (n: number) => n.toFixed(5);

const uJsonSaDecimalama = (podaci: unknown, razmak?: number) =>
  JSON.stringify(
    podaci,
    (kljuc, v) => {
      if (typeof v !== "number" || !Number.isFinite(v)) return v;
      if (DECIMALNA_POLJA.has(kljuc)) return `__DEC__${decimalniBroj(v)}__`;
      if (IZNOS_POLJA.has(kljuc) && !Number.isInteger(v))
        return `__DEC__${v.toFixed(2)}__`;
      return v;
    },
    razmak,
  ).replace(/"__DEC__(-?\d+\.\d+)__"/g, "$1");

const preuzmiJson = (podaci: unknown, nazivFajla: string) => {
  const blob = new Blob([uJsonSaDecimalama(podaci, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nazivFajla;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Datum valute = datum fakture + dogovorena valuta partnera (dani).
const dodajDane = (datum: string, dani: number) => {
  const d = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dani);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// Vrste (vidi VRSTA_OPCIJE u ArtikliUnos): 0 sirovina, 1 proizvodi, 2 roba,
// 3 usluga.
const jeSirovina = (a: Artikal) =>
  Number(a.vrsta_proizvoda) === 0 || Number(a.sirovina ?? 0) === 1;

const imaStanje = (a: Artikal) => broj(a.kolicina_proizvoda) > 0;

// Rabati se obračunavaju kaskadno: prvo redovni, pa akcijski na ostatak.
const fakturnaCijena = (cijena: number, rabat: number, akcijski: number) =>
  round5(cijena * (1 - rabat / 100) * (1 - akcijski / 100));

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

const formatDatumDMY = (iso: string) => {
  const [g, m, d] = iso.split("-");
  return g && m && d ? `${d}.${m}.${g}` : null;
};

// Datum se uvijek prikazuje kao dd.MM.yyyy, a klik bilo gdje u polju otvara
// kalendar (isti obrazac kao filteri u KalkulacijePregled).
function DatumPolje({
  value,
  onChange,
  disabled,
  polje,
  okvir = "",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  // data-polje i dodatna klasa okvira — vidi useVodjenjeUnosa.
  polje?: string;
  okvir?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const otvoriPicker = () => {
    const input = ref.current;
    if (!input || disabled) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };
  return (
    <div
      className={`relative ${disabled ? "" : "cursor-pointer"}`}
      onClick={otvoriPicker}
    >
      <input
        ref={ref}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: "transparent" }}
        data-polje={polje}
        className={`${inputClass} ${disabled ? "" : "cursor-pointer"} ${okvir}`}
      />
      <div
        className={`absolute inset-0 flex items-center px-3 text-sm tabular-nums pointer-events-none ${
          value
            ? "text-gray-800 dark:text-[#ede9f6]"
            : "text-gray-400 dark:text-[#6f6890]"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {formatDatumDMY(value) ?? "dd.mm.gggg"}
      </div>
    </div>
  );
}

// Vođenje operatera kroz unos: polje u kojem je fokus određuje "sljedeće"
// polje — prvo nepopunjeno obavezno polje iza njega po redoslijedu — koje
// dobija crveni okvir. Popunjena polja (kad nisu u fokusu) dobijaju okvir u
// boji popunjenosti. Fokus se prati preko data-polje atributa na inputima.
interface PoljeVodjenja {
  id: string;
  popunjeno: boolean;
  obavezno?: boolean; // podrazumijevano true; neobavezna se preskaču
  prikazano?: boolean; // podrazumijevano true; skrivena se preskaču
  popunjenoClass?: string;
}

const SLJEDECE_POLJE_CLASS = "!border-red-500 ring-[3px] ring-red-500";
const POPUNJENO_POLJE_CLASS = "!border-[#785E9E] ring-2 ring-[#785E9E]";

function useVodjenjeUnosa(polja: PoljeVodjenja[]) {
  const [fokus, setFokus] = useState<string | null>(null);
  const idRef = useRef<Set<string>>(new Set());
  idRef.current = new Set(polja.map((p) => p.id));

  useEffect(() => {
    const naFokus = (e: FocusEvent) => {
      const id = (e.target as HTMLElement | null)
        ?.closest?.("[data-polje]")
        ?.getAttribute("data-polje");
      setFokus(id && idRef.current.has(id) ? id : null);
    };
    const naGubitak = (e: FocusEvent) => {
      if (!e.relatedTarget) setFokus(null);
    };
    document.addEventListener("focusin", naFokus);
    document.addEventListener("focusout", naGubitak);
    return () => {
      document.removeEventListener("focusin", naFokus);
      document.removeEventListener("focusout", naGubitak);
    };
  }, []);

  const vidljiva = polja.filter((p) => p.prikazano !== false);
  const i = vidljiva.findIndex((p) => p.id === fokus);
  const sljedece =
    i === -1
      ? null
      : (vidljiva
          .slice(i + 1)
          .find((p) => p.obavezno !== false && !p.popunjeno)?.id ?? null);

  return (id: string) => {
    if (id === sljedece) return SLJEDECE_POLJE_CLASS;
    const p = vidljiva.find((x) => x.id === id);
    if (p?.popunjeno && fokus !== id)
      return p.popunjenoClass ?? POPUNJENO_POLJE_CLASS;
    return "";
  };
}

const Znacka = ({ tekst, boja }: { tekst: string; boja: string }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold text-white"
    style={{ background: boja }}
  >
    {tekst}
  </span>
);

const TH = ({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-1.5 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ backgroundColor: PRIMARY, borderBottom: `2px solid ${ACCENT}` }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) => (
  <td
    className={`px-1.5 py-1.5 text-sm whitespace-nowrap border-b border-gray-200 dark:border-[#453a68] text-gray-700 dark:text-[#c5bfd8] ${right ? "text-right tabular-nums" : ""} ${className}`}
  >
    {children}
  </td>
);

const pdvTroska = (
  t: Pick<VezaniTrosak, "iznos" | "pdv" | "samoPdv" | "pdvIznos">,
) =>
  t.samoPdv
    ? round2(t.pdvIznos ?? 0)
    : t.pdv === "bez"
      ? 0
      : round2(t.iznos * PDV_STOPA);

// Dug prema dobavljaču za stavku ZT: UIO — cijela uplata (PDV); domaći PDV —
// iznos sa PDV-om; ino PDV i bez PDV-a — iznos bez PDV-a.
const dugTroska = (
  t: Pick<VezaniTrosak, "iznos" | "pdv" | "samoPdv" | "pdvIznos">,
) =>
  t.samoPdv
    ? round2(t.pdvIznos ?? 0)
    : round2(t.iznos + (t.pdv === "domaci" ? pdvTroska(t) : 0));

// Vrijednosti za upis u bazu: kod UIO (samo PDV) uplaćeni PDV ide u iznos
// (ukupno_km), a PDV je 0 jer se na PDV ne obračunava PDV.
const iznosZaUpis = (
  t: Pick<VezaniTrosak, "iznos" | "pdv" | "samoPdv" | "pdvIznos">,
) => (t.samoPdv ? round2(t.pdvIznos ?? 0) : t.iznos);

const pdvZaUpis = (
  t: Pick<VezaniTrosak, "iznos" | "pdv" | "samoPdv" | "pdvIznos">,
) => (t.samoPdv ? 0 : pdvTroska(t));

const PDV_TROSKA_NAZIV: Record<PdvTroska, string> = {
  bez: "Bez PDV",
  domaci: "Domaći PDV",
  ino: "INO PDV",
};

const izborDugmeClass = (aktivno: boolean) =>
  `px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
    aktivno
      ? "text-white"
      : "text-gray-600 dark:text-[#c5bfd8] border-gray-200 dark:border-[#3a3158]"
  }`;
const izborDugmeStyle = (aktivno: boolean, boja = PRIMARY) =>
  aktivno ? { background: boja, borderColor: boja } : {};

// Modal za jedan račun vezanih troškova: partner, broj i datum računa se
// biraju jednom, a zatim se dodaje jedna ili više stavki (tip dokumenta,
// vrsta troška, napomena, iznos, PDV).
function VezaniRacunModal({
  partneri,
  vrste,
  pocetni,
  glavniPartnerId,
  zauzetiPartneri,
  onSacuvaj,
  onZatvori,
}: {
  partneri: Partner[];
  vrste: VrstaTroska[];
  pocetni: VezaniRacun | null;
  // Dobavljač glavne kalkulacije — ne smije biti partner vezanog troška.
  glavniPartnerId: number | null;
  // Partneri koji već imaju račun ZT na ovoj kalkulaciji — jedan partner
  // može imati samo jedan račun (jedan red u kalkulacija_gl).
  zauzetiPartneri: number[];
  onSacuvaj: (r: Omit<VezaniRacun, "id">) => void;
  onZatvori: () => void;
}) {
  // Zaglavlje računa
  const [partner, setPartner] = useState<Partner | null>(
    pocetni
      ? (partneri.find((p) => p.partner_id === pocetni.partnerId) ?? null)
      : null,
  );
  const [pretraga, setPretraga] = useState(pocetni?.nazivPartnera ?? "");
  const [lista, setLista] = useState(false);
  const [oznacen, setOznacen] = useState(0);
  const [brojRacuna, setBrojRacuna] = useState(pocetni?.brojRacuna ?? "");
  const [datum, setDatum] = useState(pocetni?.datum ?? "");

  // Stavke računa
  const [stavke, setStavke] = useState<StavkaTroska[]>(pocetni?.stavke ?? []);
  const sljedeciId = useRef(
    Math.max(0, ...(pocetni?.stavke ?? []).map((s) => s.id)) + 1,
  );
  // Stavka koja se mijenja (klik na red); null = nova.
  const [izmjenaId, setIzmjenaId] = useState<number | null>(null);
  const [tipDokumenta, setTipDokumenta] = useState("");
  const [sifraVrste, setSifraVrste] = useState("");
  const [napomena, setNapomena] = useState("");
  const [iznos, setIznos] = useState("");
  const [saPdv, setSaPdv] = useState(false);
  // Kad se PDV obračunava, operater mora izričito izabrati domaći ili ino.
  const [vrstaPdv, setVrstaPdv] = useState<"domaci" | "ino" | null>(null);

  const [greska, setGreska] = useState<string | null>(null);
  const partnerRef = useRef<HTMLInputElement>(null);
  const brojRef = useRef<HTMLInputElement>(null);
  const tipRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setTimeout(
      () => (pocetni ? tipRef.current : partnerRef.current)?.focus(),
      0,
    );
    // samo pri otvaranju
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    // Dobavljač glavne kalkulacije se ne nudi.
    const dozvoljeni = partneri.filter(
      (p) =>
        p.partner_id !== glavniPartnerId &&
        !zauzetiPartneri.includes(p.partner_id),
    );
    const l = q
      ? dozvoljeni.filter(
          (p) =>
            String(p.partner_id) === q ||
            p.naziv?.toLowerCase().includes(q) ||
            (p.jib && p.jib.includes(q)) ||
            (p.pib && p.pib.includes(q)),
        )
      : dozvoljeni;
    return l.slice(0, 60);
  }, [partneri, pretraga, glavniPartnerId, zauzetiPartneri]);

  const ponistiPartnera = () => {
    setPartner(null);
    setPretraga("");
    setTimeout(() => partnerRef.current?.focus(), 0);
  };

  const odaberi = (p: Partner) => {
    if (p.partner_id === glavniPartnerId) {
      setGreska(
        "Partner vezanog troška ne može biti isti kao dobavljač kalkulacije.",
      );
      return;
    }
    if (zauzetiPartneri.includes(p.partner_id)) {
      setGreska(
        "Ovaj partner već ima račun vezanih troškova na kalkulaciji — dodajte stavke na postojeći račun.",
      );
      return;
    }
    setPartner(p);
    setPretraga(p.naziv);
    setLista(false);
    setGreska(null);
    setTimeout(() => brojRef.current?.focus(), 0);
  };

  const iznosBroj = round2(broj(iznos));
  const jeUio = partner?.partner_id === SIFRA_PARTNERA_UIO;
  // Za UIO je uneseni iznos sam PDV, a osnovica 0.
  const osnovicaStavke = jeUio ? 0 : iznosBroj;
  const iznosPdv = jeUio
    ? iznosBroj
    : saPdv
      ? round2(iznosBroj * PDV_STOPA)
      : 0;

  const okvir = useVodjenjeUnosa([
    { id: "m-partner", popunjeno: !!partner },
    { id: "m-broj", popunjeno: !!brojRacuna.trim() },
    { id: "m-datum", popunjeno: !!datum },
    { id: "m-tip", popunjeno: !!tipDokumenta },
    { id: "m-vrsta", popunjeno: !!sifraVrste },
    { id: "m-napomena", popunjeno: !!napomena.trim(), obavezno: false },
    { id: "m-iznos", popunjeno: iznosBroj > 0 },
  ]);

  const ocistiStavku = () => {
    setIzmjenaId(null);
    setTipDokumenta("");
    setSifraVrste("");
    setNapomena("");
    setIznos("");
    setSaPdv(false);
    setVrstaPdv(null);
  };

  const izmijeniStavku = (s: StavkaTroska) => {
    setIzmjenaId(s.id);
    setTipDokumenta(s.tipDokumenta);
    setSifraVrste(String(s.sifraVrste));
    setNapomena(s.napomena);
    setIznos(String(s.samoPdv ? (s.pdvIznos ?? 0) : s.iznos));
    setSaPdv(s.pdv !== "bez");
    setVrstaPdv(s.pdv === "bez" ? null : s.pdv);
    setGreska(null);
    setTimeout(() => tipRef.current?.focus(), 0);
  };

  const dodajStavku = () => {
    const vrsta = vrste.find((v) => String(v.sifra) === sifraVrste);
    if (!tipDokumenta) return setGreska("Izaberite tip dokumenta.");
    // Račun je jedan red u KUF-u (kalkulacija_gl) sa jednim tipom dokumenta.
    if (
      stavke.some((s) => s.id !== izmjenaId && s.tipDokumenta !== tipDokumenta)
    )
      return setGreska(
        "Sve stavke jednog računa moraju imati isti tip dokumenta (račun je jedan red u KUF-u).",
      );
    if (!vrsta) return setGreska("Izaberite vrstu troška.");
    if (!(iznosBroj > 0)) return setGreska("Unesite ukupan iznos stavke.");
    if ((jeUio || saPdv) && !vrstaPdv)
      return setGreska(
        jeUio
          ? "Izaberite da li je PDV domaći ili uvozni."
          : "Izaberite da li je PDV domaći ili INO.",
      );
    const stavka: StavkaTroska = jeUio
      ? {
          id: izmjenaId ?? sljedeciId.current++,
          tipDokumenta,
          sifraVrste: Number(vrsta.sifra),
          nazivVrste: vrsta.naziv_zavisnog_troska,
          napomena: napomena.trim(),
          iznos: 0,
          pdv: vrstaPdv ?? "domaci",
          samoPdv: true,
          pdvIznos: iznosBroj,
        }
      : {
      id: izmjenaId ?? sljedeciId.current++,
      tipDokumenta,
      sifraVrste: Number(vrsta.sifra),
      nazivVrste: vrsta.naziv_zavisnog_troska,
      napomena: napomena.trim(),
          iznos: iznosBroj,
          pdv: saPdv ? (vrstaPdv ?? "bez") : "bez",
        };
    setStavke((prev) =>
      izmjenaId === null
        ? [...prev, stavka]
        : prev.map((s) => (s.id === izmjenaId ? stavka : s)),
    );
    setGreska(null);
    // Zaglavlje računa (partner, broj, datum) ostaje; polja stavke se brišu.
    ocistiStavku();
    setTimeout(() => tipRef.current?.focus(), 0);
  };

  // Stavka koja je započeta, a nije dodata — da se ne izgubi pri čuvanju.
  const zapocetaStavka =
    !!tipDokumenta || !!sifraVrste || !!napomena.trim() || iznosBroj > 0;

  const sacuvaj = () => {
    if (!partner) return setGreska("Izaberite partnera.");
    if (partner.partner_id === glavniPartnerId)
      return setGreska(
        "Partner vezanog troška ne može biti isti kao dobavljač kalkulacije.",
      );
    if (zauzetiPartneri.includes(partner.partner_id))
      return setGreska(
        "Ovaj partner već ima račun vezanih troškova na kalkulaciji — dodajte stavke na postojeći račun.",
      );
    if (!brojRacuna.trim()) return setGreska("Unesite broj računa.");
    if (!datum) return setGreska("Unesite datum računa.");
    if (zapocetaStavka)
      return setGreska(
        "Stavka je započeta, a nije dodata — kliknite „Dodaj stavku” ili je očistite.",
      );
    if (stavke.length === 0)
      return setGreska("Račun mora imati bar jednu stavku.");
    // Stavke unesene za UIO (samo PDV) i za ostale partnere se ne miješaju.
    if (stavke.some((s) => !!s.samoPdv !== jeUio))
      return setGreska(
        jeUio
          ? "Stavke su unesene za drugog partnera — za UIO obrišite ih i unesite ponovo."
          : "Stavke su unesene kao PDV za UIO — obrišite ih ili vratite partnera UIO.",
      );
    onSacuvaj({
      partnerId: partner.partner_id,
      nazivPartnera: partner.naziv,
      brojRacuna: brojRacuna.trim(),
      datum,
      stavke,
    });
  };

  const ukupnoIznos = round2(stavke.reduce((z, s) => z + s.iznos, 0));
  const ukupnoPdv = round2(stavke.reduce((z, s) => z + pdvTroska(s), 0));

  return (
    // Ne zatvara se klikom pored ni Escape-om — da se unesene stavke ne
    // izgube slučajno; samo X ili "Odustani".
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
            {pocetni ? "Izmjena računa vezanih troškova" : "Novi račun vezanih troškova"}
          </h3>
          <button
            type="button"
            onClick={onZatvori}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2d2648]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Zaglavlje računa — bira se jednom */}
        <div className="space-y-3">
          <Field label="Partner">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={partnerRef}
                type="text"
                value={pretraga}
                placeholder="Naziv, šifra, JIB ili PIB partnera..."
                onChange={(e) => {
                  setPretraga(e.target.value);
                  setPartner(null);
                  setLista(true);
                  setOznacen(0);
                }}
                onFocus={() => {
                  if (!partner) setLista(true);
                }}
                onBlur={() => setTimeout(() => setLista(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setLista(true);
                    setOznacen((i) => Math.min(i + 1, filtrirani.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setOznacen((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const p = filtrirani[oznacen];
                    if (p && !partner) odaberi(p);
                  } else if (e.key === "Escape") {
                    setLista(false);
                  }
                }}
                data-polje="m-partner"
                className={`${inputClass} pl-9 pr-9 ${okvir("m-partner")}`}
              />
              {pretraga && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={ponistiPartnera}
                  title="Ukloni izabranog partnera"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}
              {lista && !partner && filtrirani.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                  {filtrirani.map((p, i) => (
                    <button
                      key={p.partner_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        odaberi(p);
                      }}
                      onMouseEnter={() => setOznacen(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === oznacen ? "bg-purple-50 dark:bg-[#2d2648]" : ""
                      } text-gray-700 dark:text-[#c5bfd8]`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {p.partner_id}
                        </span>
                        {p.naziv}
                      </span>
                      <span className="flex-shrink-0 text-xs text-gray-500 dark:text-[#9e96b8]">
                        {[p.grad, p.drzava].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Broj računa">
              <input
                ref={brojRef}
                type="text"
                value={brojRacuna}
                onChange={(e) => setBrojRacuna(e.target.value)}
                data-polje="m-broj"
                className={`${inputClass} ${okvir("m-broj")}`}
              />
            </Field>
            <Field label="Datum računa">
              <DatumPolje
                polje="m-datum"
                okvir={okvir("m-datum")}
                value={datum}
                onChange={setDatum}
              />
            </Field>
          </div>
        </div>

        {/* Unos stavke računa */}
        <div className="rounded-2xl border border-gray-200 dark:border-[#3a3158] p-4 space-y-3">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: PRIMARY }}
          >
            {izmjenaId !== null ? "Izmjena stavke" : "Nova stavka računa"}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tip dokumenta">
              <select
                ref={tipRef}
                value={tipDokumenta}
                onChange={(e) => setTipDokumenta(e.target.value)}
                data-polje="m-tip"
                className={`${inputClass} ${okvir("m-tip")}`}
              >
                <option value="">-- Izaberi tip dokumenta --</option>
                {TIP_DOKUMENTA.map((t) => (
                  <option key={t.sifra} value={t.sifra}>
                    {t.sifra} - {t.naziv}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vrsta troška">
              <select
                value={sifraVrste}
                onChange={(e) => setSifraVrste(e.target.value)}
                data-polje="m-vrsta"
                className={`${inputClass} ${okvir("m-vrsta")}`}
              >
                <option value="">-- Izaberi vrstu troška --</option>
                {vrste.map((v) => (
                  <option key={v.sifra} value={v.sifra}>
                    {v.naziv_zavisnog_troska}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            <Field label="Napomena">
              <input
                type="text"
                value={napomena}
                onChange={(e) => setNapomena(e.target.value)}
                data-polje="m-napomena"
                className={`${inputClass} ${okvir("m-napomena")}`}
              />
            </Field>
            <Field label={jeUio ? "Iznos PDV-a (UIO)" : "Ukupan iznos"}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={iznos}
                onChange={(e) => setIznos(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    dodajStavku();
                  }
                }}
                data-polje="m-iznos"
                className={`${inputClass} ${bezStrelica} ${okvir("m-iznos")}`}
              />
            </Field>
          </div>

          {jeUio ? (
            <div className="space-y-2">
              <div
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ background: PRIMARY }}
              >
                Partner UIO: cijeli uneseni iznos je PDV i ne ulazi u trošak
                proizvoda.
              </div>
              <Field label="Vrsta PDV-a">
                <div className="grid grid-cols-2 gap-2">
                  {(["domaci", "ino"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVrstaPdv(v)}
                      className={izborDugmeClass(vrstaPdv === v)}
                      style={izborDugmeStyle(
                        vrstaPdv === v,
                        v === "ino" ? SIROVINA_BOJA : PRIMARY,
                      )}
                    >
                      {v === "ino" ? "Uvozni PDV" : "Domaći PDV"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="PDV na iznos">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSaPdv(false);
                    setVrstaPdv(null);
                  }}
                  className={izborDugmeClass(!saPdv)}
                  style={izborDugmeStyle(!saPdv, "#6b7280")}
                >
                  Ne obračunava se
                </button>
                <button
                  type="button"
                  onClick={() => setSaPdv(true)}
                  className={izborDugmeClass(saPdv)}
                  style={izborDugmeStyle(saPdv)}
                >
                  Obračunava se
                </button>
              </div>
            </Field>
            {saPdv && (
              <Field label="Vrsta PDV-a">
                <div className="grid grid-cols-2 gap-2">
                  {(["domaci", "ino"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVrstaPdv(v)}
                      className={izborDugmeClass(vrstaPdv === v)}
                      style={izborDugmeStyle(
                        vrstaPdv === v,
                        v === "ino" ? SIROVINA_BOJA : PRIMARY,
                      )}
                    >
                      {PDV_TROSKA_NAZIV[v]}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm tabular-nums text-gray-600 dark:text-[#c5bfd8]">
              Iznos {formatBroj(osnovicaStavke)} · PDV {formatBroj(iznosPdv)} ·{" "}
              <b>Ukupno {formatBroj(round2(osnovicaStavke + iznosPdv))}</b>
            </span>
            <div className="flex gap-2">
              {(izmjenaId !== null || zapocetaStavka) && (
                <button
                  type="button"
                  onClick={ocistiStavku}
                  className="px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8]"
                >
                  Očisti
                </button>
              )}
              <button
                type="button"
                onClick={dodajStavku}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: PRIMARY }}
              >
                <Plus size={15} />
                {izmjenaId !== null ? "Sačuvaj stavku" : "Dodaj stavku"}
              </button>
            </div>
          </div>
        </div>

        {/* Stavke računa */}
        <div className="rounded-2xl border border-gray-100 dark:border-[#2d2648] overflow-hidden">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <TH>Tip</TH>
                <TH>Vrsta troška</TH>
                <TH>Napomena</TH>
                <TH right>Iznos</TH>
                <TH right>PDV</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {stavke.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-5 text-center text-sm text-gray-400 dark:text-[#6f6890]"
                  >
                    Nema stavki — dodajte bar jednu stavku računa.
                  </td>
                </tr>
              )}
              {stavke.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => izmijeniStavku(s)}
                  title="Klik za izmjenu stavke"
                  className={`cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${
                    s.id === izmjenaId ? "bg-purple-50 dark:bg-[#2d2648]" : ""
                  }`}
                >
                  <TD>{s.tipDokumenta}</TD>
                  <TD>{s.nazivVrste}</TD>
                  <TD className="max-w-[180px] truncate">
                    {s.napomena || "—"}
                  </TD>
                  <TD right>{formatBroj(s.iznos)}</TD>
                  <TD right>
                    {formatBroj(pdvTroska(s))}
                    <span className="ml-1 text-[11px] text-gray-500 dark:text-[#9e96b8]">
                      {s.pdv === "bez" ? "" : s.pdv === "ino" ? "INO" : "dom."}
                    </span>
                  </TD>
                  <TD>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStavke((prev) => prev.filter((x) => x.id !== s.id));
                        if (izmjenaId === s.id) ocistiStavku();
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Ukloni stavku"
                    >
                      <Trash2 size={14} />
                    </button>
                  </TD>
                </tr>
              ))}
            </tbody>
            {stavke.length > 0 && (
              <tfoot>
                <tr className="bg-[#f4f1f9] dark:bg-[#1c1828] font-bold text-sm text-gray-800 dark:text-[#ede9f6]">
                  <td colSpan={3} className="px-1.5 py-2 text-right">
                    Ukupno računa:
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">
                    {formatBroj(ukupnoIznos)}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">
                    {formatBroj(ukupnoPdv)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {greska && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <AlertTriangle size={15} className="flex-shrink-0" />
            {greska}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onZatvori}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8]"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={sacuvaj}
            disabled={stavke.length === 0}
            title={
              stavke.length === 0
                ? "Račun mora imati bar jednu stavku"
                : undefined
            }
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: PRIMARY }}
          >
            {pocetni ? "Sačuvaj račun" : "Dodaj račun"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KalkulacijaUnos() {
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [drzave, setDrzave] = useState<Drzava[]>([]);
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);

  // Partner
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerPretraga, setPartnerPretraga] = useState("");
  const [partnerLista, setPartnerLista] = useState(false);
  const [partnerOznacen, setPartnerOznacen] = useState(0);

  // Zaglavlje — podaci sa dobavljačevog dokumenta, upisuje ih operater.
  const [brojKalkulacije, setBrojKalkulacije] = useState("");
  const [datumKalkulacije, setDatumKalkulacije] = useState("");
  const [datumValute, setDatumValute] = useState("");
  // Kad operater ručno upiše valutu, više se ne preračunava iz datuma.
  const [valutaRucno, setValutaRucno] = useState(false);
  const [vrsta, setVrsta] = useState<VrstaKalkulacije>("sirovina");

  // Unos stavke
  const [pretraga, setPretraga] = useState("");
  const [listaOtvorena, setListaOtvorena] = useState(false);
  const [oznacen, setOznacen] = useState(0);
  const [odabrani, setOdabrani] = useState<Artikal | null>(null);
  const [kolicina, setKolicina] = useState("");
  const [cijena, setCijena] = useState("");
  const [rabat, setRabat] = useState("");
  const [akcijskiRabat, setAkcijskiRabat] = useState("");
  const [vpc, setVpc] = useState("");
  // Iznos u EUR prije konverzije (dugme €→KM); null = cijena upisana u KM.
  const [cijenaEur, setCijenaEur] = useState<string | null>(null);
  // Ručna izmjena fakturne cijene — inače se računa iz cijene i rabata.
  const [fakturnaRucno, setFakturnaRucno] = useState(false);
  const [fakturnaUnos, setFakturnaUnos] = useState("");
  const fakturnaRef = useRef<HTMLInputElement>(null);
  const [zadnjaCijena, setZadnjaCijena] = useState<
    | { fakturisana_cijena: number | string; nasa_ulazna_cijena: number | string }
    | "ucitavanje"
    | null
  >(null);
  // Stavka koja se trenutno mijenja (klik na red u tabeli); null = nova.
  const [izmjenaId, setIzmjenaId] = useState<number | null>(null);

  const [stavke, setStavke] = useState<StavkaKalkulacije[]>([]);
  const [zadnjaDodana, setZadnjaDodana] = useState<number | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [zakljucivanje, setZakljucivanje] = useState(false);
  const [pokusanoZakljucenje, setPokusanoZakljucenje] = useState(false);
  // KUF brojevi zadnje upisane kalkulacije — modal (prikazanKuf) odmah nakon
  // upisa, a kratak podsjetnik ostaje ispod dugmadi do sljedećeg upisa.
  const [kufRezultat, setKufRezultat] = useState<{
    sifraKalkulacije: number | null;
    kufGlavna: number | null;
    dobavljac: string;
    brojFakture: string;
    troskovi: {
      naziv: string;
      dobavljac: string;
      brojRacuna: string;
      kuf: number | null;
    }[];
    greska: string | null;
  } | null>(null);
  const [prikazanKuf, setPrikazanKuf] = useState(false);
  // Pitanje za potvrdu — prikazuje se kao modal na sredini ekrana.
  const [potvrda, setPotvrda] = useState<{
    naslov: string;
    poruka: string;
    dugme: string;
    akcija: () => void;
  } | null>(null);

  useEffect(() => {
    if (!potvrda) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPotvrda(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [potvrda]);

  // Vezani troškovi
  const [vrsteTroska, setVrsteTroska] = useState<VrstaTroska[]>([]);
  const [racuni, setRacuni] = useState<VezaniRacun[]>([]);
  // Svaka stavka računa kao zaseban vezani trošak (redoslijed: računi pa
  // njihove stavke) — tako ide u JSON, obračun i KUF brojeve.
  const troskovi: VezaniTrosak[] = racuni.flatMap((r) =>
    r.stavke.map((s) => ({
      id: s.id,
      sifraVrste: s.sifraVrste,
      nazivVrste: s.nazivVrste,
      partnerId: r.partnerId,
      nazivPartnera: r.nazivPartnera,
      tipDokumenta: s.tipDokumenta,
      datum: r.datum,
      brojRacuna: r.brojRacuna,
      napomena: s.napomena,
      iznos: s.iznos,
      pdv: s.pdv,
      samoPdv: s.samoPdv,
      pdvIznos: s.pdvIznos,
    })),
  );
  // Modal za račun: "novi", postojeći račun (izmjena) ili zatvoren (null).
  const [trosakModal, setTrosakModal] = useState<VezaniRacun | "novi" | null>(
    null,
  );

  const sljedeciId = useRef(1);
  const partnerRef = useRef<HTMLInputElement>(null);
  const brojRef = useRef<HTMLInputElement>(null);
  const pretragaRef = useRef<HTMLInputElement>(null);
  const kolicinaRef = useRef<HTMLInputElement>(null);
  const cijenaRef = useRef<HTMLInputElement>(null);
  const rabatRef = useRef<HTMLInputElement>(null);
  const akcijskiRef = useRef<HTMLInputElement>(null);
  const vpcRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dohvati = async <T,>(putanja: string, poruka: string) => {
      const res = await fetch(`${API_URL}${putanja}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(poruka);
      const json = await res.json();
      return (json.data ?? []) as T[];
    };
    Promise.all([
      dohvati<Partner>(
        "/api/partneri/lista-sve",
        "Greška pri učitavanju partnera",
      ),
      dohvati<Drzava>("/api/partneri/drzave", "Greška pri učitavanju država"),
      dohvati<Artikal>(
        "/api/artikli/pregled-sve",
        "Greška pri učitavanju artikala",
      ),
    ])
      .then(([p, d, a]) => {
        setPartneri(p.filter((x) => Number(x.aktivan ?? 1) === 1));
        setDrzave(d);
        setArtikli(a);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setUcitavanje(false));
    // Odvojeno od ostalog — greška ovdje ne smije blokirati unos kalkulacije.
    dohvati<VrstaTroska>(
      "/api/kalkulacije/zavisni-troskovi/vrste",
      "Greška pri učitavanju vrsta vezanog troška",
    )
      .then(setVrsteTroska)
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      );
  }, []);

  // Partnerova država stiže kao slobodan tekst — prevodi se u šifru preko
  // liste država (isti princip kao u racuniZiralni). Partner bez upisane ili
  // prepoznate države tretira se kao domaći.
  const jeIno = useMemo(() => {
    if (!partner?.drzava) return false;
    const d = drzave.find((x) => x.naziv_drzave === partner.drzava);
    return !!d && Number(d.sifra_drzave) !== SIFRA_DRZAVE_BIH;
  }, [partner, drzave]);
  const uSistemuPdv = Number(partner?.pdv_obveznik ?? 0) === 1;
  // Ulazni PDV se obračunava samo za domaćeg dobavljača koji je u sistemu PDV.
  const obracunPdv = !!partner && !jeIno && uSistemuPdv;

  const partneriFiltrirani = useMemo(() => {
    const q = partnerPretraga.trim().toLowerCase();
    const lista = q
      ? partneri.filter(
          (p) =>
            String(p.partner_id) === q ||
            p.naziv?.toLowerCase().includes(q) ||
            (p.jib && p.jib.includes(q)) ||
            (p.pib && p.pib.includes(q)),
        )
      : partneri;
    return lista.slice(0, 60);
  }, [partneri, partnerPretraga]);

  const artikliVrste = useMemo(
    () => artikli.filter((a) => jeSirovina(a) === (vrsta === "sirovina")),
    [artikli, vrsta],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    const lista = q
      ? artikliVrste.filter(
          (a) =>
            String(a.sifra_proizvoda) === q ||
            a.naziv_proizvoda?.toLowerCase().includes(q) ||
            (a.barkod && String(a.barkod) === q),
        )
      : artikliVrste;
    return lista.slice(0, 60);
  }, [artikliVrste, pretraga]);

  // VPC robe operater smije mijenjati samo kad artikla nema na stanju; dok
  // ima robe, ostaje VPC iz šifarnika (erp.artikli_pregled_sve).
  const vpcZakljucana = vrsta === "roba" && !!odabrani && imaStanje(odabrani);

  // Ista boja kao izabrano dugme Sirovina/Roba u "Podacima o kalkulaciji".
  const bojaVrste = vrsta === "sirovina" ? SIROVINA_BOJA : PRIMARY;

  // Redoslijed unosa za vođenje (crveni okvir = sljedeće polje). Na obojenoj
  // kartici "Nova stavka" ljubičasti okvir se ne bi vidio, pa je tamo zelen.
  const popunjenoStavka = "!border-[#8FC74A] ring-[3px] ring-[#8FC74A]";
  const okvir = useVodjenjeUnosa([
    { id: "partner", popunjeno: !!partner },
    { id: "broj", popunjeno: !!brojKalkulacije.trim() },
    { id: "datumKal", popunjeno: !!datumKalkulacije },
    { id: "datumVal", popunjeno: !!datumValute },
    {
      id: "artikal",
      popunjeno: !!odabrani,
      popunjenoClass: popunjenoStavka,
    },
    {
      id: "kolicina",
      popunjeno: broj(kolicina) > 0,
      prikazano: !!odabrani,
      popunjenoClass: popunjenoStavka,
    },
    {
      id: "cijena",
      popunjeno: broj(cijena) > 0,
      prikazano: !!odabrani,
      popunjenoClass: popunjenoStavka,
    },
    {
      id: "rabat",
      popunjeno: rabat !== "",
      obavezno: false,
      prikazano: !!odabrani,
      popunjenoClass: popunjenoStavka,
    },
    {
      id: "akcijski",
      popunjeno: akcijskiRabat !== "",
      obavezno: false,
      prikazano: !!odabrani,
      popunjenoClass: popunjenoStavka,
    },
    {
      id: "vpc",
      popunjeno: vpcZakljucana || broj(vpc) > 0,
      prikazano: !!odabrani && vrsta === "roba",
      popunjenoClass: popunjenoStavka,
    },
  ]);

  const fakturnaIzracunata = fakturnaCijena(
    broj(cijena),
    broj(rabat),
    broj(akcijskiRabat),
  );
  const fakturna = fakturnaRucno
    ? round5(broj(fakturnaUnos))
    : fakturnaIzracunata;
  const vrijednostStavke = round2(broj(kolicina) * fakturna);

  const odaberiPartnera = (p: Partner) => {
    setPartner(p);
    setPartnerPretraga(p.naziv);
    setPartnerLista(false);
    setGreska(null);
    setUspjeh(null);
    if (!valutaRucno && datumKalkulacije)
      setDatumValute(
        dodajDane(datumKalkulacije, Number(p.valuta_placanja) || 0),
      );
    setTimeout(() => brojRef.current?.focus(), 0);
  };

  // Sve što je uneseno vezano je za izabranog partnera — promjena ili
  // brisanje partnera briše cijeli unos, uz potvrdu ako ima šta da se izgubi.
  const imaUnesenihPodataka =
    !!brojKalkulacije.trim() ||
    !!datumKalkulacije ||
    !!datumValute ||
    racuni.length > 0 ||
    stavke.length > 0 ||
    !!odabrani;

  const promijeniPartnera = (nastavak: () => void) => {
    const izvrsi = () => {
      ponistiSve();
      nastavak();
      setTimeout(() => partnerRef.current?.focus(), 0);
    };
    if (!partner) return nastavak();
    if (!imaUnesenihPodataka) return izvrsi();
    setPotvrda({
      naslov: "Promjena partnera",
      poruka:
        "Promjenom ili brisanjem partnera biće obrisani svi uneseni podaci: podaci o kalkulaciji, vezani troškovi i stavke. Nastaviti?",
      dugme: "Obriši i promijeni",
      akcija: izvrsi,
    });
  };

  const ponistiPartnera = () => promijeniPartnera(() => {});

  const promjenaDatuma = (val: string) => {
    setDatumKalkulacije(val);
    if (!valutaRucno && val)
      setDatumValute(dodajDane(val, Number(partner?.valuta_placanja) || 0));
  };

  // Zadnja cijena izabranog proizvoda (erp.kalkulacija_zadnja_cijena_proizvoda)
  // — učitava se pri svakom izboru artikla; null = nikad nije kalkulisan.
  const sifraOdabranog = odabrani ? Number(odabrani.sifra_proizvoda) : null;
  useEffect(() => {
    if (sifraOdabranog === null) {
      setZadnjaCijena(null);
      return;
    }
    let ponisteno = false;
    setZadnjaCijena("ucitavanje");
    fetch(`${API_URL}/api/kalkulacije/zadnja-cijena/${sifraOdabranog}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ponisteno) setZadnjaCijena(json?.data ?? null);
      })
      .catch(() => {
        if (!ponisteno) setZadnjaCijena(null);
      });
    return () => {
      ponisteno = true;
    };
  }, [sifraOdabranog]);

  const ponistiOdabir = (fokusNaPretragu = true) => {
    setOdabrani(null);
    setPretraga("");
    setKolicina("");
    setCijena("");
    setCijenaEur(null);
    setRabat("");
    setAkcijskiRabat("");
    setVpc("");
    setFakturnaRucno(false);
    setFakturnaUnos("");
    setIzmjenaId(null);
    if (fokusNaPretragu) setTimeout(() => pretragaRef.current?.focus(), 0);
  };

  const odaberiArtikal = (a: Artikal) => {
    // Isti artikal ne smije biti dva puta na kalkulaciji — umjesto nove
    // stavke otvara se postojeća za izmjenu.
    const postojeca = stavke.find(
      (s) => s.sifra_proizvoda === Number(a.sifra_proizvoda),
    );
    if (postojeca) {
      izmijeniStavku(postojeca);
      setGreska(
        "Ovaj artikal je već unesen — otvorena je postojeća stavka za izmjenu.",
      );
      return;
    }
    setOdabrani(a);
    setPretraga(`${a.sifra_proizvoda} – ${a.naziv_proizvoda}`);
    setListaOtvorena(false);
    setIzmjenaId(null);
    setKolicina("");
    setCijena("");
    setCijenaEur(null);
    setRabat("");
    setAkcijskiRabat("");
    setVpc(vrsta === "roba" && broj(a.vpc) > 0 ? broj(a.vpc).toFixed(2) : "");
    setFakturnaRucno(false);
    setFakturnaUnos("");
    setGreska(null);
    setUspjeh(null);
    setTimeout(() => kolicinaRef.current?.focus(), 0);
  };

  const izmijeniStavku = (s: StavkaKalkulacije) => {
    const a = artikli.find(
      (x) => Number(x.sifra_proizvoda) === s.sifra_proizvoda,
    );
    if (!a) return;
    setOdabrani(a);
    setPretraga(`${a.sifra_proizvoda} – ${a.naziv_proizvoda}`);
    setListaOtvorena(false);
    setIzmjenaId(s.id);
    setKolicina(String(s.kolicina));
    setCijena(String(s.cijena));
    setCijenaEur(null);
    setRabat(s.rabat ? String(s.rabat) : "");
    setAkcijskiRabat(s.akcijskiRabat ? String(s.akcijskiRabat) : "");
    setVpc(
      vrsta !== "roba"
        ? ""
        : imaStanje(a)
          ? broj(a.vpc).toFixed(2)
          : s.vpc.toFixed(2),
    );
    setFakturnaRucno(s.fakturnaRucno);
    setFakturnaUnos(s.fakturnaRucno ? String(s.fakturnaCijena) : "");
    setGreska(null);
    setUspjeh(null);
    setTimeout(() => kolicinaRef.current?.select(), 0);
  };

  const dodajStavku = () => {
    if (!odabrani) return;
    const kol = round3(broj(kolicina));
    const cij = round5(broj(cijena));
    const rab = round2(broj(rabat));
    const akc = round2(broj(akcijskiRabat));
    // Roba sa stanjem zadržava VPC iz šifarnika — operater je ne mijenja.
    const vp = round2(broj(vpcZakljucana ? odabrani.vpc : vpc));
    if (vpcZakljucana && !(vp > 0)) {
      setGreska(
        "Artikal ima stanje na zalihi, a VPC u šifarniku je 0 — VPC se ne može mijenjati dok ima robe. Ispravite artikal.",
      );
      return;
    }
    if (
      stavke.some(
        (s) =>
          s.sifra_proizvoda === Number(odabrani.sifra_proizvoda) &&
          s.id !== izmjenaId,
      )
    ) {
      setGreska("Ovaj artikal je već unesen na kalkulaciju.");
      return;
    }
    if (!(kol > 0)) {
      setGreska("Unesite količinu.");
      kolicinaRef.current?.focus();
      return;
    }
    if (!(cij > 0)) {
      setGreska("Unesite cijenu.");
      cijenaRef.current?.focus();
      return;
    }
    if (rab < 0 || rab > 100 || akc < 0 || akc > 100) {
      setGreska("Rabat i akcijski rabat moraju biti između 0 i 100 %.");
      return;
    }
    if (vrsta === "roba" && !(vp > 0)) {
      setGreska("Za robu je obavezan unos VPC.");
      vpcRef.current?.focus();
      return;
    }
    if (fakturnaRucno && !(fakturna > 0)) {
      setGreska("Unesite fakturnu cijenu.");
      fakturnaRef.current?.focus();
      return;
    }
    // Fakturna cijena ne smije biti veća od cijene — rabat ne može biti
    // negativan.
    if (fakturnaRucno && fakturna > cij) {
      setGreska(
        `Fakturna cijena (${formatBroj(fakturna, 5)}) ne može biti veća od cijene (${formatBroj(cij, 5)}) — rabat ne može biti manji od 0.`,
      );
      fakturnaRef.current?.focus();
      return;
    }

    const stavka: StavkaKalkulacije = {
      id: izmjenaId ?? sljedeciId.current++,
      sifra_proizvoda: Number(odabrani.sifra_proizvoda),
      naziv_proizvoda: odabrani.naziv_proizvoda,
      jm: odabrani.jm,
      kolicina: kol,
      cijena: cij,
      rabat: rab,
      akcijskiRabat: akc,
      fakturnaCijena: fakturnaRucno ? fakturna : fakturnaCijena(cij, rab, akc),
      fakturnaRucno,
      vpc: vrsta === "roba" ? vp : 0,
    };
    setStavke((prev) =>
      izmjenaId === null
        ? [...prev, stavka]
        : prev.map((s) => (s.id === izmjenaId ? stavka : s)),
    );
    setZadnjaDodana(stavka.id);
    setGreska(null);
    setUspjeh(null);
    ponistiOdabir();
  };

  const ukloniStavku = (id: number) => {
    setStavke((prev) => prev.filter((s) => s.id !== id));
    if (izmjenaId === id) ponistiOdabir(false);
  };

  const promjenaVrste = (nova: VrstaKalkulacije) => {
    if (nova === vrsta) return;
    const primijeni = () => {
      setVrsta(nova);
      setStavke([]);
      ponistiOdabir(false);
    };
    if (stavke.length === 0) return primijeni();
    setPotvrda({
      naslov: "Promjena vrste kalkulacije",
      poruka: "Promjena vrste kalkulacije briše sve unesene stavke. Nastaviti?",
      dugme: "Promijeni vrstu",
      akcija: primijeni,
    });
  };

  const vrijednost = (s: StavkaKalkulacije) =>
    round2(s.kolicina * s.fakturnaCijena);

  const ukupnoBruto = round2(
    stavke.reduce((z, s) => z + s.kolicina * s.cijena, 0),
  );
  const ukupnoOsnovica = round2(stavke.reduce((z, s) => z + vrijednost(s), 0));
  // Rabat ne može biti negativan — razlika od zaokruživanja (npr. -0,01) se
  // ne prikazuje niti šalje kao minus.
  const ukupnoRabat = Math.max(0, round2(ukupnoBruto - ukupnoOsnovica));
  const ukupnoPdv = obracunPdv ? round2(ukupnoOsnovica * PDV_STOPA) : 0;
  const ukupnoVp = round2(stavke.reduce((z, s) => z + s.kolicina * s.vpc, 0));

  const sacuvajTrosak = (r: Omit<VezaniRacun, "id">) => {
    // Stavke dobijaju id-eve jedinstvene na nivou cijele kalkulacije.
    const sRacun = (id: number): VezaniRacun => ({
      ...r,
      id,
      stavke: r.stavke.map((s) => ({ ...s, id: sljedeciId.current++ })),
    });
    setRacuni((prev) =>
      trosakModal && trosakModal !== "novi"
        ? prev.map((x) => (x.id === trosakModal.id ? sRacun(x.id) : x))
        : [...prev, sRacun(sljedeciId.current++)],
    );
    setTrosakModal(null);
  };

  const ukupnoTroskovi = round2(troskovi.reduce((z, t) => z + t.iznos, 0));
  const ukupnoPdvTroskova = round2(
    troskovi.reduce((z, t) => z + pdvTroska(t), 0),
  );

  // Naša ulazna cijena = fakturna cijena + udio vezanih troškova (bez PDV).
  // Troškovi se raspoređuju srazmjerno količini: svaka jedinica (svih
  // stavki zajedno) nosi isti iznos ZT. Bez troškova = fakturna cijena.
  // Računa se uvijek iz trenutnih stavki i troškova, pa redoslijed unosa nije
  // bitan.
  const ukupnaKolicina = stavke.reduce((z, s) => z + s.kolicina, 0);
  const ztPoJedinici =
    ukupnaKolicina > 0 ? ukupnoTroskovi / ukupnaKolicina : 0;
  const nasaUlaznaCijena = (s: StavkaKalkulacije) =>
    round5(s.fakturnaCijena + ztPoJedinici);
  const ukupnoNabavno = round2(ukupnoOsnovica + ukupnoTroskovi);

  // Nakon pokušaja zaključenja, grupa (kartica) kojoj nešto nedostaje dobija
  // crveni okvir. Računa se uživo, pa okvir nestaje čim se podatak unese.
  const nedostajePartner = pokusanoZakljucenje && !partner;
  const nedostajeZaglavlje =
    pokusanoZakljucenje &&
    (!brojKalkulacije.trim() ||
      !datumKalkulacije ||
      !datumValute ||
      datumValute < datumKalkulacije);
  const nedostajuStavke = pokusanoZakljucenje && stavke.length === 0;

  const ponistiSve = () => {
    setPokusanoZakljucenje(false);
    setRacuni([]);
    setPartner(null);
    setPartnerPretraga("");
    setBrojKalkulacije("");
    setDatumKalkulacije("");
    setDatumValute("");
    setValutaRucno(false);
    setStavke([]);
    setGreska(null);
    ponistiOdabir(false);
  };

  // Podaci koji idu u proceduru za zaključenje. Nazivi polja prate
  // erp.kalkulacija_gl_pregled / kalkulacija_po_pregled i privremeni su dok se
  // procedura ne definiše.
  const pripremiPodatke = () => ({
    sifra_dobavljaca: partner!.partner_id,
    broj_racuna: brojKalkulacije.trim(),
    datum_kalkulacije: datumKalkulacije,
    valuta: datumValute,
    // kalkulacija_gl.kalkulacija_robe: 0 zavisni trošak, 1 sirovina, 2 roba.
    kalkulacija_robe: vrsta === "roba" ? 2 : 1,
    ino_dobavljac: jeIno ? 1 : 0,
    u_sistemu_pdv: uSistemuPdv ? 1 : 0,
    ukupno_km: ukupnoOsnovica,
    // Iznos koji se duguje dobavljaču: domaći u sistemu PDV — sa PDV-om;
    // ino ili van sistema PDV — bez PDV-a (ukupnoPdv je tada 0).
    duzi_se_za_iznos: round2(ukupnoOsnovica + ukupnoPdv),
    ukupno_rab: ukupnoRabat,
    ukupno_pdv: ukupnoPdv,
    vp_vrednost: ukupnoVp,
    stavke: stavke.map((s) => ({
      sifra_proizvoda: s.sifra_proizvoda,
      kolicina: s.kolicina,
      cijena: s.cijena,
      rabat: s.rabat,
      akcijski_rabat: s.akcijskiRabat,
      fakturisana_cijena: s.fakturnaCijena,
      nasa_ulazna_cijena: nasaUlaznaCijena(s),
      vpc: s.vpc,
    })),
    // Jedan račun ZT (jedan partner) = jedan red u kalkulacija_gl
    // (vrsta_kalkulacije 'ZT'); njegove stavke idu u zavisan_trosak.
    zavisni_troskovi: racuni.map((r) => ({
      kalkulacija_robe: 0,
      sifra_dobavljaca: r.partnerId,
      broj_racuna: r.brojRacuna,
      datum: r.datum,
      // Sve stavke računa imaju isti tip (provjerava se u modalu).
      tip_dokumenta_el_kuf: r.stavke[0]?.tipDokumenta ?? "01",
      // UIO (samo PDV): uplaćeni PDV se upisuje kao iznos (ukupno_km), a
      // ukupno_pdv je 0 — na PDV se ne obračunava PDV.
      ukupno_km: round2(r.stavke.reduce((z, s) => z + iznosZaUpis(s), 0)),
      ukupno_pdv: round2(r.stavke.reduce((z, s) => z + pdvZaUpis(s), 0)),
      duzi_se_za_iznos: round2(
        r.stavke.reduce((z, s) => z + dugTroska(s), 0),
      ),
      stavke: r.stavke.map((s) => ({
        sifra_vrste_troska: s.sifraVrste,
        naziv_troska: s.nazivVrste,
        napomena: s.napomena,
        iznos: iznosZaUpis(s),
        obracun_pdv: s.pdv === "bez" ? 0 : 1,
        ino_pdv: s.pdv === "ino" ? 1 : 0,
        iznos_pdv: pdvZaUpis(s),
        // 1 = UIO: iznos je uplaćeni PDV, iznos_pdv je 0.
        samo_pdv: s.samoPdv ? 1 : 0,
        duzi_se_za_iznos: dugTroska(s),
      })),
    })),
  });

  const zakljuci = () => {
    if (zakljucivanje) return;
    setUspjeh(null);
    setPokusanoZakljucenje(true);
    if (!partner) return setGreska("Izaberite partnera.");
    if (!brojKalkulacije.trim()) return setGreska("Unesite broj fakture.");
    if (!datumKalkulacije) return setGreska("Unesite datum fakture.");
    if (!datumValute) return setGreska("Unesite datum valute plaćanja.");
    if (datumValute < datumKalkulacije)
      return setGreska("Datum valute ne može biti prije datuma fakture.");
    if (stavke.length === 0) return setGreska("Kalkulacija nema stavki.");
    setPotvrda({
      naslov: "Zaključenje kalkulacije",
      poruka: `Zaključiti kalkulaciju po fakturi br. ${brojKalkulacije.trim()} (${stavke.length} stavki)?`,
      dugme: "Zaključi",
      akcija: () => void izvrsiZakljucenje(),
    });
  };

  const izvrsiZakljucenje = async () => {
    setZakljucivanje(true);
    setGreska(null);
    // Za log greške: šta je poslato i šta je server vratio.
    let podaci: ReturnType<typeof pripremiPodatke> | null = null;
    let httpStatus: number | null = null;
    let odgovorServera: unknown = null;
    try {
      podaci = pripremiPodatke();
      // JSON se preuzima prije upisa, pa je dostupan i kad upis ne uspije.
      if (PREUZMI_JSON_PRI_ZAKLJUCENJU) {
        preuzmiJson(
          podaci,
          `kalkulacija_${brojKalkulacije.trim().replace(/[^\w-]+/g, "_")}_${datumKalkulacije}.json`,
        );
      }

      const res = await fetch(`${API_URL}/api/kalkulacije/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Tekst JSON-a ide nepromijenjen do procedure (decimale 52.00).
        body: JSON.stringify({ podaci_json: uJsonSaDecimalama(podaci) }),
      });
      httpStatus = res.status;
      const json = await res.json().catch(() => null);
      odgovorServera = json;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Greška pri upisu kalkulacije");
      }

      const sifra = json.data?.sifra_kalkulacije;

      // KUF broj: procedura vraća broj nakon upisa, tj. broj zadnjeg upisanog
      // reda. Redoslijed upisa je glavna kalkulacija, pa ZT redom kako su
      // uneseni — zato se broji unazad: zadnji ZT = vraćeni broj, ZT prije
      // njega = broj - 1, ..., glavna = broj - (broj troškova).
      const kufZadnji = Number(json.data?.kuf_broj);
      const kufOk = Number.isFinite(kufZadnji) && kufZadnji > 0;
      const kufGlavna = kufOk ? kufZadnji - racuni.length : null;
      setKufRezultat({
        sifraKalkulacije: sifra ?? null,
        kufGlavna,
        dobavljac: partner?.naziv ?? "",
        brojFakture: brojKalkulacije.trim(),
        troskovi: racuni.map((r, i) => ({
          naziv: r.stavke.map((s) => s.nazivVrste).join(", "),
          dobavljac: r.nazivPartnera,
          brojRacuna: r.brojRacuna,
          kuf: kufOk ? kufZadnji - (racuni.length - 1 - i) : null,
        })),
        greska: json.data?.kuf_greska ?? null,
      });
      setPrikazanKuf(true);

      // Unos se prazni i ekran je spreman za novu kalkulaciju.
      ponistiSve();
      setUspjeh(
        `Kalkulacija${sifra ? ` br. ${sifra}` : ""} je upisana u bazu.${
          PREUZMI_JSON_PRI_ZAKLJUCENJU ? " JSON je preuzet." : ""
        }`,
      );
      // Stanje artikala se promijenilo — osvježi listu (stanje, VPC).
      fetch(`${API_URL}/api/artikli/pregled-sve`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.data && setArtikli(j.data))
        .catch(() => {});
    } catch (err) {
      const poruka = err instanceof Error ? err.message : "Nepoznata greška";
      // Log greške se preuzima na računar: greška, odgovor servera i svi
      // podaci koji su se upisivali — za analizu i ponovni unos.
      const sada = new Date();
      const vrijeme = `${sada.getFullYear()}-${p2(sada.getMonth() + 1)}-${p2(sada.getDate())}_${p2(sada.getHours())}-${p2(sada.getMinutes())}-${p2(sada.getSeconds())}`;
      try {
        preuzmiJson(
          {
            log: "Greška pri upisu kalkulacije",
            vrijeme: sada.toLocaleString("bs-BA"),
            greska: poruka,
            // null = server nije ni odgovorio (mreža / server ugašen)
            http_status: httpStatus,
            odgovor_servera: odgovorServera,
            dobavljac: partner
              ? { sifra: partner.partner_id, naziv: partner.naziv }
              : null,
            broj_fakture: brojKalkulacije.trim(),
            podaci_za_upis: podaci,
          },
          `kalkulacija_GRESKA_${brojKalkulacije.trim().replace(/[^\w-]+/g, "_") || "bez_broja"}_${vrijeme}.json`,
        );
      } catch {
        // log je pomoćni — ne smije sakriti stvarnu grešku
      }
      // Unos ostaje na ekranu da se može ispraviti i ponovo poslati.
      setGreska(
        `Kalkulacija NIJE upisana: ${poruka} — log greške je preuzet na računar.`,
      );
    } finally {
      setZakljucivanje(false);
    }
  };

  // Enter prebacuje na sljedeće polje; na zadnjem dodaje stavku.
  const naEnter =
    (sljedece?: React.RefObject<HTMLInputElement>) =>
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (sljedece?.current) sljedece.current.select();
      else dodajStavku();
    };

  return (
    <div className="space-y-4">
      {potvrda && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50"
          onMouseDown={() => setPotvrda(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-2xl p-6 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                <AlertTriangle size={20} style={{ color: PRIMARY }} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                {potvrda.naslov}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
              {potvrda.poruka}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPotvrda(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8]"
              >
                Odustani
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const { akcija } = potvrda;
                  setPotvrda(null);
                  akcija();
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: PRIMARY }}
              >
                {potvrda.dugme}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KUF broj nakon upisa — uočljivo, operater ga upisuje na fakturu */}
      {prikazanKuf && kufRezultat && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-2xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-semibold">
              <CheckCircle2 size={20} />
              Kalkulacija
              {kufRezultat.sifraKalkulacije
                ? ` br. ${kufRezultat.sifraKalkulacije}`
                : ""}{" "}
              je upisana
            </div>

            {kufRezultat.kufGlavna !== null ? (
              <>
                <div className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                  Upišite na fakturu{" "}
                  <b>{kufRezultat.brojFakture}</b> dobavljača{" "}
                  <b>{kufRezultat.dobavljac}</b>:
                </div>
                <div
                  className="rounded-2xl py-4 text-white"
                  style={{ background: PRIMARY }}
                >
                  <div className="text-xs font-bold uppercase tracking-widest opacity-80">
                    KUF broj
                  </div>
                  <div className="text-6xl font-extrabold tabular-nums">
                    {kufRezultat.kufGlavna}
                  </div>
                </div>

                {kufRezultat.troskovi.length > 0 && (
                  <div className="text-left space-y-1.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#9e96b8]">
                      Vezani troškovi
                    </div>
                    {kufRezultat.troskovi.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[#f4f1f9] dark:bg-[#1c1828]"
                      >
                        {/* Fokus na nazivu partnera, ispod broj fakture */}
                        <div className="min-w-0">
                          <div className="text-lg font-bold leading-tight truncate text-gray-800 dark:text-[#ede9f6]">
                            {t.dobavljac}
                          </div>
                          <div className="text-sm truncate text-gray-500 dark:text-[#9e96b8]">
                            Faktura br. {t.brojRacuna}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs font-bold uppercase text-gray-500 dark:text-[#9e96b8]">
                            KUF
                          </div>
                          <div
                            className="text-4xl font-extrabold tabular-nums leading-none"
                            style={{ color: PRIMARY }}
                          >
                            {t.kuf}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-left bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                <AlertTriangle size={15} className="flex-shrink-0" />
                KUF broj nije određen
                {kufRezultat.greska ? `: ${kufRezultat.greska}` : ""}.
                Kalkulacija je ipak upisana.
              </div>
            )}

            <button
              type="button"
              autoFocus
              onClick={() => {
                setPrikazanKuf(false);
                setTimeout(() => partnerRef.current?.focus(), 0);
              }}
              className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: ACCENT }}
            >
              Upisao sam — nastavi
            </button>
          </div>
        </div>
      )}

      {trosakModal && (
        <VezaniRacunModal
          partneri={partneri}
          vrste={vrsteTroska}
          pocetni={trosakModal === "novi" ? null : trosakModal}
          glavniPartnerId={partner?.partner_id ?? null}
          zauzetiPartneri={racuni
            .filter(
              (r) => trosakModal === "novi" || r.id !== trosakModal?.id,
            )
            .map((r) => r.partnerId)}
          onSacuvaj={sacuvajTrosak}
          onZatvori={() => setTrosakModal(null)}
        />
      )}

      {/* Red 1: partner | podaci o kalkulaciji | vezani troškovi (iste visine)
          Red 2: nova stavka ispod partnera | unesene stavke ispod podataka */}
      <div className="grid grid-cols-1 xl:grid-cols-[500px_minmax(0,1fr)_minmax(0,1fr)] gap-4">
          {/* Partner */}
          <div
            className={`${karticaClass} ${nedostajePartner ? nedostajeClass : ""}`}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Partner (dobavljač)
            </span>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={partnerRef}
                type="text"
                value={partnerPretraga}
                placeholder={
                  ucitavanje
                    ? "Učitavanje partnera..."
                    : "Naziv, šifra, JIB ili PIB partnera..."
                }
                disabled={ucitavanje}
                onChange={(e) => {
                  const v = e.target.value;
                  promijeniPartnera(() => {
                    setPartnerPretraga(v);
                    setPartner(null);
                    setPartnerLista(true);
                    setPartnerOznacen(0);
                  });
                }}
                onFocus={() => {
                  if (!partner) setPartnerLista(true);
                }}
                onBlur={() => setTimeout(() => setPartnerLista(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPartnerLista(true);
                    setPartnerOznacen((i) =>
                      Math.min(i + 1, partneriFiltrirani.length - 1),
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPartnerOznacen((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const p = partneriFiltrirani[partnerOznacen];
                    if (p && !partner) odaberiPartnera(p);
                  } else if (e.key === "Escape") {
                    setPartnerLista(false);
                  }
                }}
                data-polje="partner"
                className={`${inputClass} pl-9 pr-9 ${okvir("partner")}`}
              />
              {partnerPretraga && (
                <button
                  type="button"
                  onClick={ponistiPartnera}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}

              {partnerLista && !partner && partneriFiltrirani.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                  {partneriFiltrirani.map((p, i) => (
                    <button
                      key={p.partner_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        odaberiPartnera(p);
                      }}
                      onMouseEnter={() => setPartnerOznacen(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === partnerOznacen
                          ? "bg-purple-50 dark:bg-[#2d2648]"
                          : ""
                      } text-gray-700 dark:text-[#c5bfd8]`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {p.partner_id}
                        </span>
                        {p.naziv}
                      </span>
                      <span className="flex-shrink-0 text-xs text-gray-500 dark:text-[#9e96b8]">
                        {[p.grad, p.drzava].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {partner && (
              <div className="rounded-xl px-3 py-2.5 bg-[#f4f1f9] dark:bg-[#1c1828] space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Znacka
                    tekst={jeIno ? "INO partner" : "Domaći partner"}
                    boja={jeIno ? SIROVINA_BOJA : PRIMARY}
                  />
                  <Znacka
                    tekst={uSistemuPdv ? "U sistemu PDV" : "Nije u sistemu PDV"}
                    boja={uSistemuPdv ? ACCENT : "#6b7280"}
                  />
                </div>
                <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">
                  {[partner.adresa, partner.grad, partner.drzava]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm tabular-nums text-gray-700 dark:text-[#c5bfd8]">
                  <span className="text-gray-500 dark:text-[#9e96b8]">JIB:</span>
                  <span className="font-semibold">{partner.jib || "—"}</span>
                  <span className="text-gray-500 dark:text-[#9e96b8]">PIB:</span>
                  <span className="font-semibold">{partner.pib || "—"}</span>
                  <span className="text-gray-500 dark:text-[#9e96b8]">
                    Valuta:
                  </span>
                  <span className="font-semibold">
                    {Number(partner.valuta_placanja) > 0
                      ? `${partner.valuta_placanja} dana`
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Zaglavlje kalkulacije */}
          <div
            className={`${karticaClass} ${nedostajeZaglavlje ? nedostajeClass : ""}`}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Podaci o kalkulaciji
            </span>
            {!partner && (
              <p className="text-xs text-gray-500 dark:text-[#9e96b8]">
                Prvo izaberite partnera.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Broj fakture" className="sm:col-span-2">
                <input
                  ref={brojRef}
                  type="text"
                  value={brojKalkulacije}
                  disabled={!partner}
                  onChange={(e) => setBrojKalkulacije(e.target.value)}
                  data-polje="broj"
                  className={`${inputClass} ${okvir("broj")}`}
                />
              </Field>
              <Field label="Datum fakture">
                <DatumPolje polje="datumKal" okvir={okvir("datumKal")}
                  value={datumKalkulacije}
                  disabled={!partner}
                  onChange={promjenaDatuma}
                />
              </Field>
              <Field label="Datum valute">
                <DatumPolje polje="datumVal" okvir={okvir("datumVal")}
                  value={datumValute}
                  disabled={!partner}
                  onChange={(v) => {
                    setDatumValute(v);
                    setValutaRucno(!!v);
                  }}
                />
              </Field>
            </div>

            <Field label="Vrsta kalkulacije">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { kod: "sirovina", naziv: "Sirovina", boja: SIROVINA_BOJA },
                    { kod: "roba", naziv: "Roba", boja: PRIMARY },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.kod}
                    type="button"
                    disabled={!partner}
                    onClick={() => promjenaVrste(v.kod)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
                      vrsta === v.kod
                        ? "text-white"
                        : "text-gray-600 dark:text-[#c5bfd8] border-gray-200 dark:border-[#3a3158]"
                    }`}
                    style={
                      vrsta === v.kod
                        ? { background: v.boja, borderColor: v.boja }
                        : {}
                    }
                  >
                    {v.naziv}
                  </button>
                ))}
              </div>
            </Field>
          </div>


          {/* Vezani troškovi */}
          <div className={karticaClass}>
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: PRIMARY }}
              >
                Vezani troškovi
              </span>
              <button
                type="button"
                disabled={!partner}
                onClick={() => setTrosakModal("novi")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: PRIMARY }}
              >
                <Plus size={13} />
                Dodaj račun
              </button>
            </div>

            {racuni.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-[#9e96b8]">
                Nema vezanih troškova (prevoz, carinjenje, takse...).
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {racuni.map((r) => {
                    const iznosR = round2(
                      r.stavke.reduce((z, s) => z + s.iznos, 0),
                    );
                    const pdvR = round2(
                      r.stavke.reduce((z, s) => z + pdvTroska(s), 0),
                    );
                    return (
                      <div
                        key={r.id}
                        onClick={() => setTrosakModal(r)}
                        title="Klik za izmjenu računa"
                        className="rounded-xl px-3 py-2 cursor-pointer bg-[#f4f1f9] dark:bg-[#1c1828] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                      >
                        {/* Zaglavlje računa */}
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate text-gray-800 dark:text-[#ede9f6]">
                              {r.nazivPartnera}
                            </div>
                            <div className="text-xs truncate text-gray-500 dark:text-[#9e96b8]">
                              rn. {r.brojRacuna} · {formatDatumDMY(r.datum)} ·{" "}
                              {r.stavke.length}{" "}
                              {r.stavke.length === 1 ? "stavka" : "stavke"}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm font-bold tabular-nums text-gray-800 dark:text-[#ede9f6]">
                            <span className="mr-1.5 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                              Ukupno
                            </span>
                            {formatBroj(iznosR)}
                            <span className="ml-3 mr-1.5 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                              PDV
                            </span>
                            {formatBroj(pdvR)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRacuni((prev) =>
                                prev.filter((x) => x.id !== r.id),
                              );
                            }}
                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Ukloni račun"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {/* Stavke računa */}
                        <div className="mt-1.5 pl-3 border-l-2 border-gray-200 dark:border-[#3a3158] space-y-0.5">
                          {r.stavke.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-[#c5bfd8]"
                            >
                              <span className="truncate">
                                <span className="font-mono text-gray-400 mr-1.5">
                                  {s.tipDokumenta}
                                </span>
                                {s.nazivVrste}
                                {s.napomena && (
                                  <span className="text-gray-400">
                                    {" "}
                                    — {s.napomena}
                                  </span>
                                )}
                              </span>
                              <span className="flex-shrink-0 tabular-nums">
                                {formatBroj(s.iznos)}
                                <span
                                  className="ml-2 font-semibold"
                                  style={{
                                    color:
                                      s.pdv === "bez"
                                        ? "#9ca3af"
                                        : s.pdv === "ino"
                                          ? SIROVINA_BOJA
                                          : PRIMARY,
                                  }}
                                >
                                  {s.pdv === "bez"
                                    ? PDV_TROSKA_NAZIV.bez
                                    : `${PDV_TROSKA_NAZIV[s.pdv]} ${formatBroj(pdvTroska(s))}`}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-4 text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  <span>Ukupno troškovi</span>
                  <span className="tabular-nums">
                    {formatBroj(ukupnoTroskovi)}
                    {ukupnoPdvTroskova > 0 && (
                      <span className="ml-1 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                        + PDV {formatBroj(ukupnoPdvTroskova)}
                      </span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
        {/* Nova stavka — iste širine kao partner */}
        <div className="space-y-4 self-start">
          {/* Stavka — pozadina u boji izabrane vrste (dugme Sirovina/Roba) */}
          <div
            className="rounded-2xl shadow-sm p-5 space-y-3 [&_label]:!text-white [&_p]:!text-white"
            style={{ background: bojaVrste }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {izmjenaId !== null ? "Izmjena stavke" : "Nova stavka"} —{" "}
              {vrsta === "sirovina" ? "sirovina" : "roba"}
            </span>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={pretragaRef}
                type="text"
                value={pretraga}
                placeholder={
                  ucitavanje
                    ? "Učitavanje artikala..."
                    : `Šifra, naziv ili barkod ${vrsta === "sirovina" ? "sirovine" : "robe"}...`
                }
                disabled={ucitavanje || !partner}
                onChange={(e) => {
                  setPretraga(e.target.value);
                  setOdabrani(null);
                  setIzmjenaId(null);
                  setListaOtvorena(true);
                  setOznacen(0);
                }}
                onFocus={() => {
                  if (!odabrani) setListaOtvorena(true);
                }}
                onBlur={() => setTimeout(() => setListaOtvorena(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setListaOtvorena(true);
                    setOznacen((i) => Math.min(i + 1, filtrirani.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setOznacen((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const a = filtrirani[oznacen];
                    if (a && !odabrani) odaberiArtikal(a);
                  } else if (e.key === "Escape") {
                    setListaOtvorena(false);
                  }
                }}
                data-polje="artikal"
                className={`${inputClass} pl-9 pr-9 ${okvir("artikal")}`}
              />
              {pretraga && (
                <button
                  type="button"
                  onClick={() => ponistiOdabir()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}

              {listaOtvorena && !odabrani && filtrirani.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                  {filtrirani.map((a, i) => (
                    <button
                      key={String(a.sifra_proizvoda)}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        odaberiArtikal(a);
                      }}
                      onMouseEnter={() => setOznacen(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === oznacen ? "bg-purple-50 dark:bg-[#2d2648]" : ""
                      } text-gray-700 dark:text-[#c5bfd8]`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {String(a.sifra_proizvoda)}
                        </span>
                        {a.naziv_proizvoda}
                        {stavke.some(
                          (s) =>
                            s.sifra_proizvoda === Number(a.sifra_proizvoda),
                        ) && (
                          <span
                            className="ml-2 text-xs font-semibold"
                            style={{ color: ACCENT }}
                          >
                            (već unesen)
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0 text-xs tabular-nums text-gray-500 dark:text-[#9e96b8]">
                        ({a.jm}){" "}
                        <b
                          className={
                            imaStanje(a)
                              ? "text-gray-700 dark:text-[#ede9f6]"
                              : "text-gray-400 dark:text-[#6f6890]"
                          }
                        >
                          {formatBroj(broj(a.kolicina_proizvoda), 3)}
                        </b>
                        {vrsta === "roba" &&
                          ` · VPC ${formatBroj(broj(a.vpc))}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {odabrani && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Količina (${odabrani.jm ?? ""})`}>
                    <input
                      ref={kolicinaRef}
                      type="number"
                      step="any"
                      min="0"
                      value={kolicina}
                      onChange={(e) => setKolicina(e.target.value)}
                      onKeyDown={naEnter(cijenaRef)}
                      data-polje="kolicina"
                      className={`${inputClass} ${bezStrelica} ${okvir("kolicina")}`}
                    />
                  </Field>
                  <Field
                    label={
                      cijenaEur !== null
                        ? `Cijena (${formatBroj(broj(cijenaEur), 4)} € × ${KURS_EUR})`
                        : "Cijena"
                    }
                  >
                    <div className="flex gap-1.5">
                      <input
                        ref={cijenaRef}
                        type="number"
                        step="any"
                        min="0"
                        value={cijena}
                        onChange={(e) => {
                          setCijena(e.target.value);
                          setCijenaEur(null);
                        }}
                        onKeyDown={naEnter(rabatRef)}
                        data-polje="cijena"
                        className={`${inputClass} ${bezStrelica} ${okvir("cijena")}`}
                      />
                      {/* Brza konverzija: upisana cijena je u EUR → KM.
                          Drugi klik vraća iznos u EUR. */}
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={cijenaEur === null && !(broj(cijena) > 0)}
                        onClick={() => {
                          if (cijenaEur !== null) {
                            setCijena(cijenaEur);
                            setCijenaEur(null);
                          } else {
                            setCijenaEur(cijena);
                            setCijena(String(round5(broj(cijena) * KURS_EUR)));
                          }
                          setTimeout(() => cijenaRef.current?.focus(), 0);
                        }}
                        title={
                          cijenaEur !== null
                            ? "Vrati cijenu u EUR"
                            : `Preračunaj upisanu cijenu iz EUR u KM (kurs ${KURS_EUR})`
                        }
                        className={`flex-shrink-0 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap border-2 border-white disabled:opacity-40 ${
                          cijenaEur !== null ? "bg-white" : "text-white"
                        }`}
                        style={cijenaEur !== null ? { color: bojaVrste } : {}}
                      >
                        {cijenaEur !== null ? "↺ €" : "€→KM"}
                      </button>
                    </div>
                  </Field>
                  {/* Rabat i akcijski rabat dijele jednu kolonu */}
                  <div className="grid grid-cols-2 gap-2">
                  <Field label="Rabat %">
                    <input
                      ref={rabatRef}
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={rabat}
                      onChange={(e) => setRabat(e.target.value)}
                      onKeyDown={naEnter(akcijskiRef)}
                      data-polje="rabat"
                      className={`${inputClass} ${bezStrelica} ${okvir("rabat")}`}
                    />
                  </Field>
                  <Field label="Akc. rabat %">
                    <input
                      ref={akcijskiRef}
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={akcijskiRabat}
                      onChange={(e) => setAkcijskiRabat(e.target.value)}
                      onKeyDown={naEnter(
                        vrsta === "roba" && !vpcZakljucana ? vpcRef : undefined,
                      )}
                      data-polje="akcijski"
                      className={`${inputClass} ${bezStrelica} ${okvir("akcijski")}`}
                    />
                  </Field>
                  </div>

                  {/* Informativno, samo za čitanje */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nabavna cijena">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formatBroj(broj(odabrani.nabavna_cijena), 5)}
                        className={samoCitanjeClass}
                      />
                    </Field>
                    <Field label="Zadnje fakturisano">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={
                          zadnjaCijena === "ucitavanje"
                            ? "..."
                            : zadnjaCijena
                              ? formatBroj(
                                  broj(zadnjaCijena.fakturisana_cijena),
                                  3,
                                )
                              : "—"
                        }
                        title={
                          zadnjaCijena && zadnjaCijena !== "ucitavanje"
                            ? `Fakturna cijena sa zadnje kalkulacije · naša ulazna cijena ${formatBroj(broj(zadnjaCijena.nasa_ulazna_cijena), 3)}`
                            : "Proizvod još nije ulazio kroz kalkulaciju"
                        }
                        className={samoCitanjeClass}
                      />
                    </Field>
                  </div>
                  {vrsta === "roba" && (
                    <Field
                      label={
                        vpcZakljucana
                          ? `VPC — zaključana (na stanju ${formatBroj(broj(odabrani.kolicina_proizvoda), 3)} ${odabrani.jm ?? ""})`
                          : "VPC"
                      }
                      className="col-span-2"
                    >
                      <input
                        ref={vpcRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={vpc}
                        readOnly={vpcZakljucana}
                        tabIndex={vpcZakljucana ? -1 : undefined}
                        title={
                          vpcZakljucana
                            ? "VPC se može mijenjati samo kad artikla nema na stanju"
                            : undefined
                        }
                        onChange={(e) => setVpc(e.target.value)}
                        onKeyDown={naEnter()}
                        data-polje="vpc"
                        className={vpcZakljucana ? samoCitanjeClass : `${inputClass} ${okvir("vpc")}`}
                      />
                    </Field>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Fakturna cijena — računa se, a po potrebi se mijenja ručno */}
                  <div className="rounded-xl px-3 py-2 bg-[#f4f1f9] dark:bg-[#1c1828]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-[#9e96b8]">
                        Fakturna cijena
                        {fakturnaRucno && (
                          <span className="ml-1 font-semibold text-red-500">
                            (ručno)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          if (fakturnaRucno) {
                            setFakturnaRucno(false);
                            setFakturnaUnos("");
                          } else {
                            setFakturnaRucno(true);
                            setFakturnaUnos(
                              fakturnaIzracunata > 0
                                ? String(fakturnaIzracunata)
                                : "",
                            );
                            setTimeout(() => fakturnaRef.current?.select(), 0);
                          }
                        }}
                        className="text-xs font-semibold underline"
                        style={{ color: PRIMARY }}
                        title={
                          fakturnaRucno
                            ? "Vrati automatski obračun iz cijene i rabata"
                            : "Ručno upiši fakturnu cijenu"
                        }
                      >
                        {fakturnaRucno ? "Automatski" : "Izmijeni"}
                      </button>
                    </div>
                    {fakturnaRucno ? (
                      <input
                        ref={fakturnaRef}
                        type="number"
                        step="any"
                        min="0"
                        value={fakturnaUnos}
                        onChange={(e) => setFakturnaUnos(e.target.value)}
                        onKeyDown={naEnter()}
                        className="w-full mt-0.5 px-2 py-1 text-base font-bold tabular-nums rounded-lg border-2 border-red-400 bg-white dark:bg-[#261f38] text-gray-800 dark:text-[#ede9f6] focus:outline-none"
                      />
                    ) : (
                      <div className="text-base font-bold tabular-nums text-gray-800 dark:text-[#ede9f6]">
                        {formatBroj(fakturna, 5)}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl px-3 py-2 bg-[#f4f1f9] dark:bg-[#1c1828]">
                    <div className="text-xs text-gray-500 dark:text-[#9e96b8]">
                      Vrijednost
                    </div>
                    <div className="text-base font-bold tabular-nums text-gray-800 dark:text-[#ede9f6]">
                      {formatBroj(vrijednostStavke)}
                    </div>
                  </div>
                </div>

                {vrsta === "roba" &&
                  broj(vpc) > 0 &&
                  fakturna > 0 &&
                  broj(vpc) < fakturna && (
                    <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                      <AlertTriangle size={12} />
                      VPC je ispod fakturne cijene.
                    </p>
                  )}

                {/* Info kad operater sam upisuje VPC manju od nabavne cijene
                    artikla (nabavna_cijena iz šifarnika) — samo upozorenje. */}
                {vrsta === "roba" &&
                  !vpcZakljucana &&
                  broj(vpc) > 0 &&
                  broj(odabrani.nabavna_cijena) > 0 &&
                  broj(vpc) < broj(odabrani.nabavna_cijena) && (
                    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white/90 text-red-600">
                      <AlertTriangle size={13} className="flex-shrink-0" />
                      VPC ({formatBroj(broj(vpc))}) je manja od nabavne cijene (
                      {formatBroj(broj(odabrani.nabavna_cijena), 5)}).
                    </div>
                  )}

                <button
                  type="button"
                  onClick={dodajStavku}
                  className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-gray-50"
                  style={{ color: bojaVrste }}
                >
                  <Plus size={15} />
                  {izmjenaId !== null ? "Sačuvaj izmjenu" : "Dodaj stavku"}
                </button>
              </>
            )}
          </div>

          {greska && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <AlertTriangle size={15} className="flex-shrink-0" />
              {greska}
            </div>
          )}
          {uspjeh && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              {uspjeh}
            </div>
          )}
        </div>

        {/* Unesene stavke */}
        <div className="xl:col-span-2 min-w-0 space-y-4 self-start">
          <div
            className={`bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden ${nedostajuStavke ? nedostajeClass : ""}`}
          >
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead>
                  <tr>
                    <TH>#</TH>
                    <TH>Šifra</TH>
                    <TH>Naziv</TH>
                    <TH right>Količina</TH>
                    <TH right>Cijena</TH>
                    <TH right>Rabat %</TH>
                    <TH right>Akc. rabat %</TH>
                    <TH right>Fakturna cijena</TH>
                    <TH right>Vrijednost</TH>
                    <TH right>Naša ulazna</TH>
                    {vrsta === "roba" && <TH right>VPC</TH>}
                    <TH />
                  </tr>
                </thead>
                <tbody>
                  {stavke.length === 0 && (
                    <tr>
                      <td
                        colSpan={vrsta === "roba" ? 12 : 11}
                        className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[#6f6890]"
                      >
                        Nema stavki — izaberite partnera, pa artikal i unesite
                        količinu i cijenu.
                      </td>
                    </tr>
                  )}
                  {stavke.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => izmijeniStavku(s)}
                      className={`cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${
                        s.id === izmjenaId
                          ? "bg-purple-50 dark:bg-[#2d2648]"
                          : s.id === zadnjaDodana
                            ? "bg-green-50 dark:bg-green-900/20"
                            : ""
                      }`}
                      title="Klik za izmjenu stavke"
                    >
                      <TD>{i + 1}</TD>
                      <TD className="font-mono text-xs">{s.sifra_proizvoda}</TD>
                      <TD>{s.naziv_proizvoda}</TD>
                      <TD right>
                        {formatBroj(s.kolicina, 3)} {s.jm}
                      </TD>
                      <TD right>{formatBroj(s.cijena, 5)}</TD>
                      <TD right>{formatBroj(s.rabat)}</TD>
                      <TD right>{formatBroj(s.akcijskiRabat)}</TD>
                      <TD
                        right
                        className={s.fakturnaRucno ? "!text-red-500 font-semibold" : ""}
                      >
                        <span
                          title={
                            s.fakturnaRucno
                              ? "Fakturna cijena upisana ručno"
                              : undefined
                          }
                        >
                          {formatBroj(s.fakturnaCijena, 5)}
                          {s.fakturnaRucno && " R"}
                        </span>
                      </TD>
                      <TD right className="font-bold">
                        {formatBroj(vrijednost(s))}
                      </TD>
                      <TD
                        right
                        className={ztPoJedinici > 0 ? "font-semibold" : ""}
                      >
                        {formatBroj(nasaUlaznaCijena(s), 5)}
                      </TD>
                      {vrsta === "roba" && <TD right>{formatBroj(s.vpc)}</TD>}
                      <TD>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            ukloniStavku(s.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Ukloni stavku"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rekapitulacija i dugmad — centrirano, dugmad ispod */}
          <div className="flex flex-col items-center gap-3">
          {stavke.length > 0 && (
              <div className="w-full sm:w-96 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-1.5 text-sm text-gray-700 dark:text-[#c5bfd8]">
                {[
                  { label: "Vrijednost bez rabata", iznos: ukupnoBruto },
                  { label: "Rabat", iznos: ukupnoRabat },
                  { label: "Fakturna vrijednost", iznos: ukupnoOsnovica },
                  {
                    label: obracunPdv
                      ? `PDV ${PDV_STOPA * 100} %`
                      : jeIno
                        ? "PDV (ino partner)"
                        : "PDV (nije u sistemu PDV)",
                    iznos: ukupnoPdv,
                  },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between gap-4">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{formatBroj(r.iznos)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4 pt-1.5 border-t border-gray-200 dark:border-[#453a68] text-base font-bold text-gray-800 dark:text-[#ede9f6]">
                  <span>Ukupno</span>
                  <span className="tabular-nums">
                    {formatBroj(round2(ukupnoOsnovica + ukupnoPdv))}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-gray-200 dark:border-[#453a68] space-y-1.5">
                  <div className="flex justify-between gap-4">
                    <span>Vezani troškovi (bez PDV)</span>
                    <span className="tabular-nums">
                      {formatBroj(ukupnoTroskovi)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 font-bold text-gray-800 dark:text-[#ede9f6]">
                    <span>Nabavna vrijednost (sa ZT)</span>
                    <span className="tabular-nums">
                      {formatBroj(ukupnoNabavno)}
                    </span>
                  </div>
                  {ztPoJedinici > 0 && (
                    <div className="flex justify-between gap-4 text-xs text-gray-500 dark:text-[#9e96b8]">
                      <span>ZT po jedinici količine</span>
                      <span className="tabular-nums">
                        {formatBroj(ztPoJedinici, 4)}
                      </span>
                    </div>
                  )}
                  {vrsta === "roba" && (
                    <div className="flex justify-between gap-4 text-xs text-gray-500 dark:text-[#9e96b8]">
                      <span>VP vrijednost</span>
                      <span className="tabular-nums">
                        {formatBroj(ukupnoVp)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
          )}

          <div className="w-full sm:w-96 flex gap-3">
            <button
              type="button"
              onClick={() =>
                setPotvrda({
                  naslov: "Poništavanje unosa",
                  poruka: "Poništiti cijeli unos kalkulacije?",
                  dugme: "Poništi unos",
                  akcija: ponistiSve,
                })
              }
              disabled={(!partner && stavke.length === 0) || zakljucivanje}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] disabled:opacity-40"
            >
              Poništi
            </button>
            <button
              type="button"
              onClick={zakljuci}
              disabled={stavke.length === 0 || zakljucivanje}
              className="flex-[2] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {zakljucivanje ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCheck size={15} />
              )}
              Zaključi kalkulaciju
            </button>
          </div>

          {/* Diskretan podsjetnik na KUF broj zadnje upisane kalkulacije */}
          {kufRezultat && (
            <button
              type="button"
              onClick={() => setPrikazanKuf(true)}
              title="Prikaži KUF brojeve zadnje kalkulacije"
              className="text-xs text-gray-500 dark:text-[#9e96b8] hover:underline"
            >
              Zadnja kalkulacija
              {kufRezultat.sifraKalkulacije
                ? ` br. ${kufRezultat.sifraKalkulacije}`
                : ""}{" "}
              · KUF{" "}
              <b style={{ color: PRIMARY }}>
                {kufRezultat.kufGlavna ?? "?"}
              </b>
              {kufRezultat.troskovi.length > 0 &&
                ` (+${kufRezultat.troskovi.length} ZT)`}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
