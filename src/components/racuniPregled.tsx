import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Printer,
  Receipt,
  Search,
  XCircle,
} from "lucide-react";
import { usePrint } from "../context/PrintContext";
import { RacunA5 } from "../print/templates/RacunA5";
import {
  izdajFiskalniRacun,
  izdvojiFiskalnePodatke,
  proveriFiskalizacijuPoRequestId,
  ESIR_OZNAKA_SA_PDV,
  ESIR_SLIP_PRESET_58MM,
  type EsirInvoiceRequest,
  type EsirStavka,
  type EsirPlacanje,
} from "./fiskalniRacuni";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.sp_racuni_gl_pregled / erp.sp_racuni_po_pregled — kolone nisu
// unaprijed poznate na frontendu, pa se tabela gradi dinamički iz ključeva reda.
type RacunRed = Record<string, unknown>;

// Isti izvor/oblik kao "Podgrupa računa" u racuniGotovinski.tsx (GET /api/racuni/podgrupe).
interface RacunPodgrupa {
  sifra_podgrupe: number;
  opis_podgrupe: string;
  obracunava_se_pdv: number;
}

// Normalizacija naziva kolone za poređenje — mala slova, bez donjih crta/razmaka —
// jer tačan zapis (velika/mala slova, "_" ili razmak) iz procedure nije unaprijed poznat.
const normalizujKljuc = (k: string) => k.toLowerCase().replace(/[_\s]/g, "");

// ============================================================================
// PODEŠAVANJA KOLONA — SVE ručne izmjene izgleda tabele rade se OVDJE, na jednom
// mjestu. Ključ = naziv kolone kako dolazi iz procedure (velika/mala slova i "_"
// vs razmak nisu bitni — poredi se normalizovano preko normalizujKljuc).
// Dvije procedure (pregled liste i pregled stavki) imaju RAZLIČITE kolone, pa
// svaka ima svoju mapu ispod — nema preklapanja/konflikta između njih.
//
//   naziv    — tekst u zaglavlju kolone (ako se izostavi, izvodi se automatski
//              iz ključa, npr. "datum_racuna" -> "Datum Racuna")
//   sakrij   — true = kolona se nikad ne prikazuje
//   naKraju  — true = kolona ide na sam kraj tabele (poslije svega, uključujući
//              kolone sa pozicijom); redoslijed među njima prati redoslijed
//              kojim su ovdje upisane
//   pozicija — broj mjesta s lijeva (1 = prva kolona, 2 = druga...). Kolone bez
//              pozicije popunjavaju preostala mjesta prirodnim redoslijedom.
//
// Da dodaš novo pravilo: dodaj novi red. Da nešto vratiš u prikaz: obriši
// "sakrij: true" ili cijeli red.
// ============================================================================
interface PodesavanjeKolone {
  naziv?: string;
  sakrij?: boolean;
  naKraju?: boolean;
  pozicija?: number;
}

// --- erp.sp_racuni_gl_pregled — glavna lista računa ---
// Pozicija prati tačan redoslijed kolona iz procedure. Partner polja
// (sifra/naziv/adresa_partnera, naziv_grada) se ipak spajaju u "Partner" ćeliju
// drugdje u kodu (vidi PARTNER_POLJA) pa se, uprkos "sakrij: false", ne
// prikazuju kao zasebne kolone — ta pozicija ostaje prazno mjesto.
const PODESAVANJA_PREGLED: Record<string, PodesavanjeKolone> = {
  sifra_tabele: { naziv: "Sifra Tabele", sakrij: true, pozicija: 1 },
  sifra_radnika: { naziv: "Sifra Radnika", sakrij: true, pozicija: 2 },
  naziv_radnika: { naziv: "Naziv Radnika", sakrij: true, pozicija: 3 },
  broj_racuna: { naziv: "Broj Racuna", sakrij: true, pozicija: 4 },
  vrsta_racuna: { naziv: "Vrsta Racuna", sakrij: true, pozicija: 5 },
  // Sirovi kod (1/2) — i dalje se koristi za boju trake sa lijeve strane reda
  // (vidi BOJA_PO_VRSTI_RACUNA), bez obzira što je sada i vidljiv kao kolona.
  vrsta_racuna_novi: { naziv: "Vrsta Racuna Novi", sakrij: true, pozicija: 6 },
  vrsta_racuna_pod: { naziv: "Vrsta Racuna Pod", sakrij: true, pozicija: 7 },
  // Stvarni "broj računa" za prikaz (formatirana oznaka, npr. MP-10-1234/26).
  vrsta_racuna_novo: { naziv: "Broj računa", sakrij: false, pozicija: 8 },
  sifra_knjizenja: { naziv: "Sifra Knjizenja", sakrij: true, pozicija: 9 },
  racun_roba: { naziv: "Racun Roba", sakrij: true, pozicija: 10 },
  sifra_terena: { naziv: "Sifra Terena", sakrij: true, pozicija: 11 },
  datum_racuna: { naziv: "Datum Racuna", sakrij: false, pozicija: 12 },
  valuta: { naziv: "Valuta", sakrij: true, pozicija: 13 },
  vreme: { naziv: "Vreme", sakrij: true, pozicija: 14 },
  datum_isporuke: { naziv: "Datum Isporuke", sakrij: true, pozicija: 15 },
  // Partner polja — spojena u "Partner" ćeliju na početku (vidi PARTNER_POLJA).
  sifra_partnera: { naziv: "Sifra Partnera", sakrij: false, pozicija: 16 },
  naziv_partnera: { naziv: "Naziv Partnera", sakrij: false, pozicija: 17 },
  adresa_partnera: { naziv: "Adresa Partnera", sakrij: false, pozicija: 18 },
  naziv_grada: { naziv: "Naziv Grada", sakrij: false, pozicija: 19 },
  entitet: { naziv: "Entitet", sakrij: true, pozicija: 20 },
  ptt: { naziv: "Ptt", sakrij: true, pozicija: 21 },
  jib: { naziv: "Jib", sakrij: true, pozicija: 22 },
  pib: { naziv: "Pib", sakrij: true, pozicija: 23 },
  // Namjerno prije "Broj računa" (pozicija 8).
  napomena: { naziv: "Napomena", sakrij: false, pozicija: 1 },
  // Spojeno sa "datum_vreme_fiskalnog" u jednu ćeliju (vidi PAROVI_CELIJA
  // i NASLOVI_U_DVA_REDA) — naziv ovdje se ne koristi (zaglavlje je ručno).
  br_fiskalnog: { naziv: "Br Fiskalnog", sakrij: false, pozicija: 25 },

  vrednost: { naziv: "Vrednost", sakrij: false, pozicija: 27 },
  vp1: { naziv: "VP", sakrij: false, pozicija: 29 },
  rab1: { naziv: "RAB", sakrij: false, pozicija: 28 },
  vp2: { naziv: "VP", sakrij: false, pozicija: 31 },
  rab2: { naziv: "RAB", sakrij: false, pozicija: 30 },
  rab3: { naziv: "RAB", sakrij: false, pozicija: 32 },
  osnova_za_obracun_pdv: {
    naziv: "OSNOVA",
    sakrij: false,
    pozicija: 33,
  },
  pdv: { naziv: "PDV", sakrij: false, pozicija: 34 },
  ukupno: { naziv: "UKUPNO", sakrij: false, pozicija: 36 },
  rabat_km: { naziv: "RABAT KM", sakrij: false, pozicija: 35 },
  slovima: { naziv: "SLOVIMA", sakrij: true, pozicija: 37 },
  // Nije duplikat "vreme" polja — različita uloga (fiskalni datum/vrijeme).
  // Spojeno u ćeliju "br_fiskalnog" (pozicija/sakrij ovdje se ne koriste).
  datum_vreme_fiskalnog: {
    naziv: "Datum Fiskalnog",
    sakrij: false,
    pozicija: 26,
  },
  storniran_racun: { naziv: "Storniran Racun", sakrij: true, pozicija: 38 },
  // Ne prikazuje se kao zasebna kolona — spojeno sa "Štampa" kolonom na kraju
  // tabele (ikonica kvačice ispod ikonice štampača kad je racun_placen === "DA").
  racun_placen: { naziv: "Plaćeno", sakrij: true },
};

// --- erp.sp_racuni_po_pregled — stavke (proizvodi) jednog računa ---
// Redoslijed pozicija prati tačan redoslijed kolona iz procedure.
const PODESAVANJA_STAVKE: Record<string, PodesavanjeKolone> = {
  sifra_tabele: { naziv: "Sifra Tabele", sakrij: true, pozicija: 1 },
  sifra_proizvoda: { naziv: "Šifra", sakrij: false, pozicija: 2 },
  naziv_proizvoda: { naziv: "Naziv artikla", sakrij: false, pozicija: 3 },
  jm: { naziv: "JM", sakrij: false, pozicija: 4 },
  kolicina: { naziv: "Količina", sakrij: false, pozicija: 5 },
  nabavna_cijena: { naziv: "Nabavna Cijena", sakrij: true, pozicija: 6 },
  vpc_bez_rabata: { naziv: "VPC", sakrij: false, pozicija: 7 },
  vpc_vrednost_bez_rabata: {
    naziv: "VP Vrednost",
    sakrij: true,
    pozicija: 8,
  },

  vpc: { naziv: "VPC", sakrij: true, pozicija: 9 },
  vpc_vrednost: { naziv: "VP", sakrij: true, pozicija: 10 },
  rabat_proc: { naziv: "Rabat Proc", sakrij: true, pozicija: 12 },
  cijena_sa_rab: { naziv: "CIJENA", sakrij: false, pozicija: 12 },
  prodajna_cijena: { naziv: "MPC", sakrij: false, pozicija: 13 },
  nabavna_vrednost: { naziv: "Nabavna Vrednost", sakrij: true, pozicija: 15 },

  prodajna_vrednost: {
    naziv: "UKUPNO",
    sakrij: false,
    pozicija: 14,
  },
  rabat_km: { naziv: "RABAT", sakrij: false, pozicija: 11 },
  ruc: { naziv: "Ruc", sakrij: true, pozicija: 17 },
  fiskalni_racun: { naziv: "Fiskalni Racun", sakrij: true, pozicija: 18 },
  sifra_grupe: { naziv: "Sifra Grupe", sakrij: true, pozicija: 19 },
  naziv_grupe: { naziv: "Naziv Grupe", sakrij: true, pozicija: 20 },
  vrsta: { naziv: "Vrsta", sakrij: true, pozicija: 21 },
  stornirano: { naziv: "Stornirano", sakrij: true, pozicija: 22 },
  procenat: { naziv: "Procenat", sakrij: true, pozicija: 23 },

  vpc_rabat_1: { naziv: "Vpc Rabat 1", sakrij: true, pozicija: 24 },
  vp_1: { naziv: "Vp 1", sakrij: true, pozicija: 25 },
  rabat_proc_2: { naziv: "Rabat Proc 2", sakrij: true, pozicija: 26 },
  rabat_km_2: { naziv: "Rabat Km 2", sakrij: true, pozicija: 27 },
  vpc_sa_rab_2: { naziv: "Vpc Sa Rab 2", sakrij: true, pozicija: 28 },
  vp_2: { naziv: "Vp 2", sakrij: true, pozicija: 29 },
  rab_proc_3: { naziv: "Rab Proc 3", sakrij: true, pozicija: 30 },
  rabat_km_3: { naziv: "Rabat Km 3", sakrij: true, pozicija: 31 },
  barkod: { naziv: "Barkod", sakrij: true, pozicija: 32 },
  nabavna_cijena_proizvoda: {
    naziv: "Nabavna Cijena Proizvoda",
    sakrij: true,
    pozicija: 33,
  },
  nabavna_vrednost_proizvoda: {
    naziv: "Nabavna Vrednost Proizvoda",
    sakrij: true,
    pozicija: 34,
  },
  ruc_2: { naziv: "Ruc 2", sakrij: true, pozicija: 35 },
  pdv_po_artiklu: { naziv: "Pdv Po Artiklu", sakrij: true, pozicija: 36 },
  nabavna_vrednost_za_ruc: {
    naziv: "Nabavna Vrednost Za Ruc",
    sakrij: true,
    pozicija: 37,
  },
};

const nadjiPodesavanje = (
  podesavanja: Record<string, PodesavanjeKolone>,
  kljuc: string,
): PodesavanjeKolone => {
  const pravi = Object.keys(podesavanja).find(
    (k) => normalizujKljuc(k) === normalizujKljuc(kljuc),
  );
  return pravi ? podesavanja[pravi] : {};
};

// Poredaj vidljive kolone: prvo one sa eksplicitnom pozicijom (na tačno to
// mjesto s lijeva), preostala mjesta popune kolone bez pozicije prirodnim
// redoslijedom, a kolone označene sa naKraju idu na sam kraj.
const poredajKolone = (
  vidljive: string[],
  podesavanja: Record<string, PodesavanjeKolone>,
): string[] => {
  const get = (k: string) => nadjiPodesavanje(podesavanja, k);
  const naKraju = vidljive.filter((k) => get(k).naKraju);
  const ostatak = vidljive.filter((k) => !get(k).naKraju);
  const sPozicijom = ostatak.filter((k) => get(k).pozicija !== undefined);
  const bezPozicije = ostatak.filter((k) => get(k).pozicija === undefined);

  if (sPozicijom.length === 0) return [...ostatak, ...naKraju];

  const duzina = Math.max(
    sPozicijom.length + bezPozicije.length,
    ...sPozicijom.map((k) => get(k).pozicija ?? 0),
  );
  const rezultat: (string | null)[] = new Array(duzina).fill(null);
  sPozicijom.forEach((k) => {
    const idx = (get(k).pozicija ?? 1) - 1;
    if (idx >= 0 && idx < rezultat.length && rezultat[idx] === null)
      rezultat[idx] = k;
  });
  let oi = 0;
  for (let i = 0; i < rezultat.length && oi < bezPozicije.length; i++) {
    if (rezultat[i] === null) rezultat[i] = bezPozicije[oi++];
  }
  while (oi < bezPozicije.length) rezultat.push(bezPozicije[oi++]);

  return [...rezultat.filter((k): k is string => k !== null), ...naKraju];
};

// --- Polja koja se spajaju u posebne, ručno iscrtane ćelije (ne prolaze kroz
// generički prikaz kolona) — mijenjaj ako se struktura podataka promijeni. ---

const KLJUC_SIFRE = ["sifra_tabele", "sifraTabele"];
// Ova polja se ne prikazuju kao zasebne kolone — spajaju se u jednu "Partner" ćeliju na početku.
const PARTNER_POLJA = [
  "naziv_partnera",
  "sifra_partnera",
  "adresa_partnera",
  "naziv_grada",
];
// Parovi kolona spojeni u jednu ćeliju (gornji_ključ -> donji_ključ). Donji
// ključ se izbacuje iz generičkog prikaza kolona (prikazan je samo unutar
// ćelije gornjeg ključa). Zaglavlje (dva reda) se izvodi iz "naziv" polja OBA
// ključa u PODESAVANJA_PREGLED — nema posebne liste naslova za održavanje,
// promijeni "naziv" gore ili dolje ključa i zaglavlje se samo ažurira.
const PAROVI_CELIJA: Record<string, string> = {
  vrsta_racuna_novo: "datum_racuna",
  br_fiskalnog: "datum_vreme_fiskalnog",
  vp1: "rab2",
  vp2: "rab3",
  vrednost: "rab1",
  osnova_za_obracun_pdv: "pdv",
};
// Kolone kod kojih je razmak prema susjednoj koloni sveden na 5px (5+5=10px
// ukupno), da bi niz Broj računa..Osnova za PDV bio vizuelno zbijen.
const TIJESAN_RAZMAK_LIJEVO = new Set([
  "br_fiskalnog",
  "vrednost",
  "vp1",
  "vp2",
  "osnova_za_obracun_pdv",
]);
const TIJESAN_RAZMAK_DESNO = new Set([
  "vrsta_racuna_novo",
  "br_fiskalnog",
  "vrednost",
  "vp1",
  "vp2",
]);
// Stavke tabela: numeričke kolone od "Količina" do "MPV" — sveden razmak
// (uže od podrazumijevanog px-3) i poravnate desno, da "Naziv artikla" dobije
// više prostora a ovaj blok djeluje zbijeno, gurnut uz desnu ivicu tabele.
const STAVKE_ZBIJENE_KOLONE = new Set([
  "kolicina",
  "vpc_bez_rabata",
  "vpc_vrednost_bez_rabata",
  "vpc",
  "vpc_vrednost",
  "rabat_km",
  "cijena_sa_rab",
  "prodajna_cijena",
  "prodajna_vrednost",
]);
// Kolone ograničene na širinu od 6 karaktera (Šifra, JM) — kratke vrijednosti,
// nema potrebe da zauzimaju više prostora.
const STAVKE_USKE_KOLONE = new Set(["sifra_proizvoda", "jm"]);
// Fiksna širina (u broju karaktera) za pojedine kolone stavki — dodaje se kao
// max-width preko style-a, bez obzira na to koju className/padding kolona ima.
const STAVKE_SIRINA_KARAKTERA: Record<string, number> = {
  sifra_proizvoda: 6,
  jm: 6,
  kolicina: 20,
  vpc_bez_rabata: 12,
  rabat_km: 12,
  cijena_sa_rab: 12,
  prodajna_cijena: 12,
  prodajna_vrednost: 20,
};
// MPC (prodajna_cijena) i UKUPNO (prodajna_vrednost) — razmak između njih
// dodatno smanjen (3px) da djeluju primaknuto jedno drugom.
const stavkeRazmak = (k: string) => {
  if (k === "prodajna_cijena") return "pl-1.5 pr-[3px]";
  if (k === "prodajna_vrednost") return "pl-[3px] pr-1.5";
  return "px-1.5";
};
// vrsta_racuna_novi se koristi da vizuelno razdvoji račune po vrsti (1 = MP, 2 = VP).
const BOJA_PO_VRSTI_RACUNA: Record<string, string> = {
  "1": PRIMARY,
  "2": ACCENT,
};
const bojaVrsteRacuna = (v: unknown) =>
  BOJA_PO_VRSTI_RACUNA[String(v)] ?? "#9ca3af";
// Storniran račun ima prioritet nad bojom po vrsti_racuna_novi — cijeli red se
// oboji ovom bojom bez obzira na MP/VP.
const BOJA_STORNIRANO = "#ef4444";
const jeStorniranRacun = (v: unknown) => Number(v) === 1;

const nadjiSifruTabele = (red: RacunRed): string | number | null => {
  for (const kljuc of KLJUC_SIFRE) {
    if (red[kljuc] !== undefined && red[kljuc] !== null)
      return red[kljuc] as string | number;
  }
  return null;
};

const lijepNazivKolone = (
  podesavanja: Record<string, PodesavanjeKolone>,
  kljuc: string,
) =>
  nadjiPodesavanje(podesavanja, kljuc).naziv ??
  kljuc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const izgledaKaoBroj = (v: unknown) =>
  typeof v === "number" ||
  (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));

const formatDatumDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// dd.MM.yyyy HH:mm:ss u jednom redu.
const formatDatumVrijemeDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Kolone koje uvijek prikazuju 2 decimale, bez obzira na to da li vrijednost
// stiže kao broj ili string (npr. kad SQL agregacija vrati čist JS broj).
const KOLONE_UVIJEK_DECIMALNE = ["ukupno"];

const formatirajVrijednost = (v: unknown, kljuc?: string): string => {
  if (kljuc === "datum_racuna") return formatDatumDMY(v);
  if (kljuc === "datum_vreme_fiskalnog") return formatDatumVrijemeDMY(v);
  if (v === null || v === undefined || v === "") return "–";
  if (izgledaKaoBroj(v)) {
    const n = Number(v);
    // DECIMAL kolone dolaze iz baze kao string sa tačkom (npr. "150.00") čak i
    // kad je vrijednost cio broj — zadrži 2 decimale u tom slučaju. INT kolone
    // dolaze kao broj (bez tačke u zapisu) i ostaju prikazane bez decimala.
    const jeDecimalno =
      (typeof v === "string" && v.includes(".")) ||
      (kljuc !== undefined && KOLONE_UVIJEK_DECIMALNE.includes(kljuc));
    return Number.isInteger(n) && !jeDecimalno ? String(n) : n.toFixed(2);
  }
  return String(v);
};

function GenericnaTabela({
  redovi,
  podesavanja,
  onKlik,
  prosireniKljuc,
  prosireniSadrzaj,
  varijanta = "racuni",
  onStampaj,
  onDesniKlikFiskalni,
}: {
  redovi: RacunRed[];
  podesavanja: Record<string, PodesavanjeKolone>;
  onKlik?: (red: RacunRed) => void;
  // Šifra tabele reda čije su stavke trenutno prikazane ispod njega (accordion).
  prosireniKljuc?: string | number | null;
  // Sadržaj ubačen u dodatni red ispod prosirenog reda (tabela stavki / spinner).
  prosireniSadrzaj?: ReactNode;
  // "stavke" dobija vizuelno drugačiju (zelenkastu) paletu da se jasno razlikuje
  // od glavne tabele računa kad je prikazana ugniježđeno ispod izabranog reda.
  varijanta?: "racuni" | "stavke";
  // Klik na ikonicu štampača u koloni "Štampa" (samo glavna tabela računa).
  onStampaj?: (red: RacunRed) => void;
  // Desni klik na ćeliju "Br. fiskalnog" — otvara kontekst meni za fiskalizaciju.
  onDesniKlikFiskalni?: (red: RacunRed, e: React.MouseEvent) => void;
}) {
  const jeStavke = varijanta === "stavke";
  const imaPartnera =
    redovi.length > 0 && PARTNER_POLJA.some((k) => k in redovi[0]);

  const kolone = useMemo(() => {
    if (redovi.length === 0) return [];
    const donjiKljuceviParova =
      Object.values(PAROVI_CELIJA).map(normalizujKljuc);
    const vidljive = Object.keys(redovi[0]).filter((k) => {
      if (nadjiPodesavanje(podesavanja, k).sakrij) return false;
      if (PARTNER_POLJA.includes(k)) return false;
      if (donjiKljuceviParova.includes(normalizujKljuc(k))) return false;
      return true;
    });
    return poredajKolone(vidljive, podesavanja);
  }, [redovi, podesavanja]);

  if (redovi.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400 dark:text-[#5f5878]">
        <Receipt size={24} className="text-gray-300 dark:text-[#3a3158]" />
        <span className="text-sm">Nema podataka za prikaz</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr
            className={`sticky top-0 z-10 ${
              jeStavke
                ? "bg-[#e9f5da] dark:bg-[#1b2712] text-[#4d7a1f] dark:text-[#a3d474]"
                : "bg-[#785E9E] dark:bg-[#5b4a7d] text-white dark:text-[#f0ecfa]"
            }`}
          >
            {imaPartnera && (
              <th
                className={`text-left pl-3 pr-[5px] py-2 font-bold whitespace-nowrap border-b ${
                  jeStavke
                    ? "border-[#8FC74A]/40 dark:border-[#8FC74A]/30"
                    : "border-[#634c86] dark:border-[#4a3c69]"
                }`}
                style={
                  !jeStavke ? { borderLeft: "4px solid #8FC74A" } : undefined
                }
              >
                Partner
              </th>
            )}
            {kolone.map((k, idx) => {
              const donjiKljuc = PAROVI_CELIJA[k];
              const jePrvaCelija = !imaPartnera && idx === 0;
              const jeZbijena = jeStavke && STAVKE_ZBIJENE_KOLONE.has(k);
              const jeUska = jeStavke && STAVKE_USKE_KOLONE.has(k);
              return (
                <th
                  key={k}
                  className={`py-2 font-bold whitespace-nowrap border-b ${
                    jeUska
                      ? "text-left px-1.5"
                      : jeZbijena
                        ? `text-right ${stavkeRazmak(k)}`
                        : "text-left px-3"
                  } ${
                    jeStavke
                      ? "border-[#8FC74A]/40 dark:border-[#8FC74A]/30"
                      : "border-[#634c86] dark:border-[#4a3c69]"
                  }`}
                  style={{
                    ...(!jeStavke && jePrvaCelija
                      ? { borderLeft: "4px solid #8FC74A" }
                      : undefined),
                    ...(jeStavke && k === "naziv_proizvoda"
                      ? { minWidth: "260px" }
                      : undefined),
                    ...(jeStavke && STAVKE_SIRINA_KARAKTERA[k]
                      ? {
                          width: `${STAVKE_SIRINA_KARAKTERA[k]}ch`,
                          maxWidth: `${STAVKE_SIRINA_KARAKTERA[k]}ch`,
                        }
                      : undefined),
                  }}
                >
                  {donjiKljuc ? (
                    <>
                      <div>{lijepNazivKolone(podesavanja, k)}</div>
                      <div>{lijepNazivKolone(podesavanja, donjiKljuc)}</div>
                    </>
                  ) : (
                    lijepNazivKolone(podesavanja, k)
                  )}
                </th>
              );
            })}
            {!jeStavke && (
              <th className="px-3 py-2 border-b border-[#634c86] dark:border-[#4a3c69]" />
            )}
          </tr>
        </thead>
        <tbody>
          {redovi.map((red, i) => {
            const storniran = jeStorniranRacun(red.storniran_racun);
            const boja = jeStavke
              ? ACCENT
              : storniran
                ? BOJA_STORNIRANO
                : bojaVrsteRacuna(red.vrsta_racuna_novi);
            const sifraTabele = nadjiSifruTabele(red);
            const sifraProizvoda = red.sifra_proizvoda;
            const brojRacuna = red.broj_racuna;
            const keyBase =
              sifraTabele ?? sifraProizvoda ?? brojRacuna ?? "red";
            const jeProsiren =
              sifraTabele !== null &&
              prosireniKljuc !== undefined &&
              prosireniKljuc !== null &&
              String(sifraTabele) === String(prosireniKljuc);
            // Crveni obrub oko cijelog "para" (header red + red sa stavkama ispod
            // njega) — vrh i lijeva/desna ivica idu na header ćelije, dno na
            // ćeliju reda sa stavkama (vidi ispod, poslije kolone.map).
            const prvaKolona = imaPartnera ? null : (kolone[0] ?? null);
            const zadnjaKolona = kolone[kolone.length - 1] ?? null;
            const obrubCelije = (
              k: string,
            ): React.CSSProperties | undefined => {
              if (!jeProsiren) return undefined;
              const stil: React.CSSProperties = {
                borderTop: "2px solid #ef4444",
              };
              if (k === prvaKolona) stil.borderLeft = "2px solid #ef4444";
              // Kad postoji dodatna "Štampa" kolona (samo glavna tabela), ona
              // nosi desnu ivicu umjesto zadnje podatkovne kolone.
              if (k === zadnjaKolona && jeStavke)
                stil.borderRight = "2px solid #ef4444";
              return stil;
            };
            const obrubStampe: React.CSSProperties | undefined = jeProsiren
              ? {
                  borderTop: "2px solid #ef4444",
                  borderRight: "2px solid #ef4444",
                }
              : undefined;
            return (
              <Fragment key={`${String(keyBase)}-${i}`}>
                <tr
                  onClick={() => onKlik?.(red)}
                  style={{
                    borderLeft: `4px solid ${jeProsiren ? PRIMARY : boja}`,
                  }}
                  className={`border-b ${
                    jeProsiren
                      ? "border-[#785E9E]/30 dark:border-[#785E9E]/40 bg-[#785E9E]/15 dark:bg-[#785E9E]/25 shadow-[inset_0_0_0_1px_rgba(120,94,158,0.35)]"
                      : jeStavke
                        ? `border-[#8FC74A]/25 dark:border-[#8FC74A]/20 ${
                            i % 2 === 0
                              ? "bg-white dark:bg-[#161c10]"
                              : "bg-[#f4faec] dark:bg-[#1b2712]"
                          }`
                        : `border-gray-100 dark:border-[#2a2340] ${
                            storniran
                              ? "bg-red-50/70 dark:bg-red-950/20"
                              : i % 2 === 0
                                ? "bg-white dark:bg-[#1a1528]"
                                : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                          }`
                  } ${onKlik ? "cursor-pointer hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]" : ""}`}
                >
                  {imaPartnera && (
                    <td
                      className="pl-3 pr-[5px] py-1.5 whitespace-nowrap"
                      style={
                        jeProsiren
                          ? {
                              borderTop: "2px solid #ef4444",
                              borderLeft: "2px solid #ef4444",
                            }
                          : undefined
                      }
                    >
                      <div className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {formatirajVrijednost(red.naziv_partnera)}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        Šifra: {formatirajVrijednost(red.sifra_partnera)} ·{" "}
                        {formatirajVrijednost(red.adresa_partnera)} ·{" "}
                        {formatirajVrijednost(red.naziv_grada)}
                      </div>
                    </td>
                  )}
                  {kolone.map((k) => {
                    const donjiKljuc = PAROVI_CELIJA[k];
                    if (donjiKljuc) {
                      const padding = `${TIJESAN_RAZMAK_LIJEVO.has(k) ? "pl-[5px]" : "pl-3"} ${
                        TIJESAN_RAZMAK_DESNO.has(k) ? "pr-[5px]" : "pr-3"
                      }`;
                      const jeRabatDonji =
                        normalizujKljuc(donjiKljuc).startsWith("rab");
                      if (k === "br_fiskalnog") {
                        const imaFiskalni =
                          red.br_fiskalnog !== null &&
                          red.br_fiskalnog !== undefined &&
                          String(red.br_fiskalnog).trim() !== "";
                        return (
                          <td
                            key={k}
                            className={`${padding} py-1.5 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8] ${onDesniKlikFiskalni ? "cursor-context-menu" : ""}`}
                            style={obrubCelije(k)}
                            onContextMenu={(e) => {
                              if (!onDesniKlikFiskalni) return;
                              e.preventDefault();
                              e.stopPropagation();
                              onDesniKlikFiskalni(red, e);
                            }}
                          >
                            {imaFiskalni ? (
                              <>
                                <div
                                  className="flex items-center gap-1 font-semibold"
                                  style={{ color: PRIMARY }}
                                >
                                  <CheckCircle2
                                    size={12}
                                    className="flex-shrink-0 text-emerald-500"
                                  />
                                  {formatirajVrijednost(red[k], k)}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                                  {formatirajVrijednost(
                                    red[donjiKljuc],
                                    donjiKljuc,
                                  )}
                                </div>
                              </>
                            ) : (
                              <div
                                className="flex items-center justify-center"
                                title="Nema fiskalnog broja"
                              >
                                <AlertTriangle
                                  size={18}
                                  className="text-amber-500"
                                />
                              </div>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={k}
                          className={`${padding} py-1.5 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8]`}
                          style={obrubCelije(k)}
                        >
                          <div
                            className="font-semibold"
                            style={{ color: PRIMARY }}
                          >
                            {formatirajVrijednost(red[k], k)}
                          </div>
                          <div
                            className={`text-[10px] ${jeRabatDonji ? "font-semibold" : "text-gray-400 dark:text-[#5f5878]"}`}
                            style={jeRabatDonji ? { color: ACCENT } : undefined}
                          >
                            {formatirajVrijednost(red[donjiKljuc], donjiKljuc)}
                          </div>
                        </td>
                      );
                    }
                    if (k === "napomena") {
                      return (
                        <td
                          key={k}
                          className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8]"
                          style={obrubCelije(k)}
                        >
                          {formatirajVrijednost(red[k], k)}
                        </td>
                      );
                    }
                    const jeZbijena = jeStavke && STAVKE_ZBIJENE_KOLONE.has(k);
                    const jeUska = jeStavke && STAVKE_USKE_KOLONE.has(k);
                    return (
                      <td
                        key={k}
                        className={`py-1.5 whitespace-nowrap ${
                          jeUska
                            ? "px-1.5"
                            : jeZbijena
                              ? `text-right ${stavkeRazmak(k)}`
                              : "px-3"
                        } ${
                          k === "vrsta_racuna_novi"
                            ? "font-bold"
                            : k === "ukupno"
                              ? "font-bold text-sm"
                              : k === "rabat_km"
                                ? "font-semibold"
                                : "text-gray-700 dark:text-[#c5bfd8]"
                        }`}
                        style={{
                          ...(k === "vrsta_racuna_novi" || k === "ukupno"
                            ? { color: boja }
                            : k === "rabat_km"
                              ? { color: ACCENT }
                              : undefined),
                          ...(jeStavke && k === "naziv_proizvoda"
                            ? { minWidth: "260px" }
                            : undefined),
                          ...(jeStavke && STAVKE_SIRINA_KARAKTERA[k]
                            ? {
                                width: `${STAVKE_SIRINA_KARAKTERA[k]}ch`,
                                maxWidth: `${STAVKE_SIRINA_KARAKTERA[k]}ch`,
                              }
                            : undefined),
                          ...obrubCelije(k),
                        }}
                      >
                        {formatirajVrijednost(red[k], k)}
                      </td>
                    );
                  })}
                  {!jeStavke && (
                    <td className="px-3 py-1.5 text-center" style={obrubStampe}>
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStampaj?.(red);
                          }}
                          className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          <Printer
                            size={14}
                            className="text-gray-400 dark:text-[#7d7498]"
                          />
                        </button>
                        {String(red.racun_placen ?? "")
                          .trim()
                          .toUpperCase() === "DA" && (
                          <CheckCircle2
                            size={13}
                            className="text-emerald-500"
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {jeProsiren && (
                  <tr className="border-b border-gray-100 dark:border-[#2a2340]">
                    <td
                      colSpan={
                        kolone.length +
                        (imaPartnera ? 1 : 0) +
                        (jeStavke ? 0 : 1)
                      }
                      className="p-0 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                      style={{
                        borderLeft: "2px solid #ef4444",
                        borderRight: "2px solid #ef4444",
                        borderBottom: "2px solid #ef4444",
                      }}
                    >
                      {prosireniSadrzaj}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RacuniPregled() {
  const { openPrint } = usePrint();
  const [racuni, setRacuni] = useState<RacunRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");

  // Kontekst meni na desni klik iznad ćelije "Br. fiskalnog".
  const [kontekstMeniFiskalni, setKontekstMeniFiskalni] = useState<{
    x: number;
    y: number;
    red: RacunRed;
  } | null>(null);
  const [fiskalizacijaUToku, setFiskalizacijaUToku] = useState(false);
  // Zamjena za window.alert/confirm — modal na sredini ekrana. Ako je
  // "onPotvrdi" postavljen, prikazuju se dugmad Da/Ne (potvrda); inače samo "U redu".
  const [fiskalnaPoruka, setFiskalnaPoruka] = useState<{
    naslov: string;
    poruka: string;
    tip: "info" | "greska" | "uspjeh" | "pitanje";
    onPotvrdi?: () => void;
  } | null>(null);

  // Šifra tabele reda čije su stavke trenutno prikazane ispod njega (accordion).
  const [prosirenaSifra, setProsirenaSifra] = useState<string | number | null>(
    null,
  );
  const [stavke, setStavke] = useState<RacunRed[]>([]);
  const [loadingStavke, setLoadingStavke] = useState(false);

  const [podgrupe, setPodgrupe] = useState<RacunPodgrupa[]>([]);
  const [loadingPodgrupe, setLoadingPodgrupe] = useState(true);
  const [odabranaPodgrupa, setOdabranaPodgrupa] = useState<number | null>(null);

  const [odabranoPlaceno, setOdabranoPlaceno] = useState<"" | "DA" | "NE">("");
  const [odabranoStornirano, setOdabranoStornirano] = useState<
    "" | "DA" | "NE"
  >("");

  useEffect(() => {
    const fetchPodgrupe = async () => {
      try {
        const res = await fetch(`${API_URL}/api/racuni/podgrupe`, {
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          setPodgrupe(d.data ?? []);
        }
      } finally {
        setLoadingPodgrupe(false);
      }
    };
    void fetchPodgrupe();
  }, []);

  useEffect(() => {
    const fetchRacune = async () => {
      try {
        const res = await fetch(`${API_URL}/api/pregledi/racuna`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setGreska(
            json.error || json.message || "Greška pri učitavanju računa",
          );
          return;
        }
        setRacuni(json.data ?? []);
      } catch {
        setGreska("Greška pri učitavanju računa");
      } finally {
        setLoading(false);
      }
    };
    void fetchRacune();
  }, []);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    return racuni.filter((red) => {
      const odgovaraPretrazi =
        !q ||
        Object.values(red).some(
          (v) =>
            v !== null &&
            v !== undefined &&
            String(v).toLowerCase().includes(q),
        );
      const odgovaraPodgrupi =
        odabranaPodgrupa === null ||
        Number(red.vrsta_racuna_pod) === odabranaPodgrupa;
      const placeno =
        String(red.racun_placen ?? "")
          .trim()
          .toUpperCase() === "DA";
      const odgovaraPlaceno =
        odabranoPlaceno === "" || (odabranoPlaceno === "DA") === placeno;
      const stornirano = jeStorniranRacun(red.storniran_racun);
      const odgovaraStornirano =
        odabranoStornirano === "" ||
        (odabranoStornirano === "DA") === stornirano;
      return (
        odgovaraPretrazi &&
        odgovaraPodgrupi &&
        odgovaraPlaceno &&
        odgovaraStornirano
      );
    });
  }, [racuni, pretraga, odabranaPodgrupa, odabranoPlaceno, odabranoStornirano]);

  const handleKlikRacun = async (red: RacunRed) => {
    const sifraTabele = nadjiSifruTabele(red);
    if (sifraTabele === null) return;
    // Klik na već prošireni red ga zatvara (accordion ponašanje).
    if (String(sifraTabele) === String(prosirenaSifra)) {
      setProsirenaSifra(null);
      setStavke([]);
      return;
    }
    setProsirenaSifra(sifraTabele);
    setLoadingStavke(true);
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${sifraTabele}`,
        {
          credentials: "include",
        },
      );
      const json = await res.json();
      setStavke(res.ok && json.success ? (json.data ?? []) : []);
    } catch {
      setStavke([]);
    } finally {
      setLoadingStavke(false);
    }
  };

  // Štampa A5 računa (zaglavlje + stavke) preko print servisa — vidi PrintModal/PrintContext.
  // A5 template trenutno pokriva samo vrsta_racuna_novi 1 (MP) i 3 — za ostale
  // vrste (npr. 2 = VP) samo obavijesti korisnika, dok se ne doda odgovarajući template.
  const handleStampaj = async (red: RacunRed) => {
    const vrsta = Number(red.vrsta_racuna_novi);
    if (vrsta !== 1 && vrsta !== 3) {
      alert("Štampa A5 trenutno nije dostupna za ovu vrstu računa.");
      return;
    }
    const sifraTabele = nadjiSifruTabele(red);
    if (sifraTabele === null) return;
    let stavkeZaStampu: RacunRed[] = [];
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${sifraTabele}`,
        { credentials: "include" },
      );
      const json = await res.json();
      stavkeZaStampu = res.ok && json.success ? (json.data ?? []) : [];
    } catch {
      alert("Greška pri učitavanju stavki za štampu.");
      return;
    }

    const brojRacuna = String(red.vrsta_racuna_novo ?? "-");
    openPrint({
      title: `Račun ${brojRacuna}`,
      component: (
        <RacunA5
          racun={{
            broj_racuna: brojRacuna,
            datum_racuna: String(red.datum_racuna ?? ""),
            naziv_partnera: String(red.naziv_partnera ?? "-"),
            sifra_partnera: (red.sifra_partnera as string | number) ?? "-",
            adresa_partnera: (red.adresa_partnera as string | null) ?? null,
            naziv_grada: (red.naziv_grada as string | null) ?? null,
            napomena: (red.napomena as string | null) ?? null,
            osnova_za_obracun_pdv:
              (red.osnova_za_obracun_pdv as number | string | null) ?? null,
            pdv: (red.pdv as number | string | null) ?? null,
            ukupno: (red.ukupno as number | string) ?? 0,
            rabat_km: (red.rabat_km as number | string | null) ?? null,
            slovima: (red.slovima as string | null) ?? null,
            br_fiskalnog: (red.br_fiskalnog as string | number | null) ?? null,
            sifra_tabele: sifraTabele,
          }}
          stavke={stavkeZaStampu.map((s) => ({
            sifra_proizvoda: (s.sifra_proizvoda as string | number) ?? "",
            naziv_proizvoda: String(s.naziv_proizvoda ?? ""),
            jm: String(s.jm ?? ""),
            kolicina: (s.kolicina as number | string) ?? 0,
            prodajna_cijena:
              (s.prodajna_cijena as number | string) ??
              (s.cijena_sa_rab as number | string) ??
              0,
            prodajna_vrednost: (s.prodajna_vrednost as number | string) ?? 0,
          }))}
        />
      ),
    });
  };

  const handleDesniKlikFiskalni = (red: RacunRed, e: React.MouseEvent) => {
    setKontekstMeniFiskalni({ x: e.clientX, y: e.clientY, red });
  };

  // Upisuje br_fiskalnog/datum_vreme_fiskalnog i za red u trenutnoj listi (bez
  // ponovnog učitavanja cijelog pregleda) i u bazu preko postojeće procedure.
  const azurirajFiskalneUBaziIListi = async (
    sifraTabele: string | number,
    brFiskalnog: string,
    datumVremeFiskalnog: string,
  ) => {
    const res = await fetch(`${API_URL}/api/racuni/azuriraj-fiskalne-podatke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sifra_tabele: sifraTabele,
        br_fiskalnog: brFiskalnog,
        datum_vreme_fiskalnog: datumVremeFiskalnog,
      }),
    });
    if (!res.ok) {
      const g = await res.json().catch(() => null);
      throw new Error(g?.error || "Greška pri upisu fiskalnih podataka.");
    }
    setRacuni((prev) =>
      prev.map((r) =>
        String(nadjiSifruTabele(r)) === String(sifraTabele)
          ? { ...r, br_fiskalnog: brFiskalnog, datum_vreme_fiskalnog: datumVremeFiskalnog }
          : r,
      ),
    );
  };

  // GTIN mora imati 8–14 znakova — ako artikal nema barkod, šifra proizvoda se
  // dopunjava nulama slijeva do 13 cifara (isto kao u gotovinskom unosu).
  const gtinZaStavkuPregled = (s: RacunRed): string => {
    const barkod = String(s.barkod ?? "").trim();
    if (barkod) return barkod;
    const cifre = String(s.sifra_proizvoda ?? "").replace(/\D/g, "");
    return cifre.padStart(13, "0").slice(-13);
  };

  // Ponovo šalje NOVI zahtjev za fiskalizaciju ka ESIR-u za istorijski račun
  // (kad provjera po RequestId-u nije našla postojeću fiskalizaciju) — podaci
  // se povlače iz reda pregleda + stavki (isti izvor kao za A5 štampu).
  const kreirajNovuFiskalizaciju = async (
    red: RacunRed,
    sifraTabele: string | number,
  ) => {
    const resStavke = await fetch(
      `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${sifraTabele}`,
      { credentials: "include" },
    );
    const jsonStavke = await resStavke.json();
    const stavke: RacunRed[] =
      resStavke.ok && jsonStavke.success ? (jsonStavke.data ?? []) : [];
    if (stavke.length === 0) {
      setFiskalnaPoruka({
        naslov: "Nema stavki",
        poruka: "Nema stavki za ovaj račun — ne mogu kreirati ESIR zahtjev.",
        tip: "greska",
      });
      return;
    }

    const items: EsirStavka[] = stavke.map((s) => ({
      name: String(s.naziv_proizvoda ?? ""),
      gtin: gtinZaStavkuPregled(s),
      labels: [ESIR_OZNAKA_SA_PDV],
      totalAmount: Number(s.prodajna_vrednost) || 0,
      unitPrice: Number(s.prodajna_cijena) || 0,
      quantity: Number(s.kolicina) || 0,
      discount: 0,
      discountAmount: 0,
    }));
    const payment: EsirPlacanje[] = [
      { amount: Number(red.ukupno) || 0, paymentType: "Cash" },
    ];
    const jeRazniKupac = Number(red.sifra_partnera) === 300;
    const invoiceRequest: EsirInvoiceRequest = {
      invoiceType: "Training",
      transactionType: "Sale",
      referentDocumentNumber: null,
      referentDocumentDT: null,
      buyerId: jeRazniKupac
        ? "300"
        : red.jib
          ? String(red.jib)
          : undefined,
      buyerCostCenterId: String(red.naziv_partnera ?? "").slice(0, 50),
      payment,
      items,
      cashier: String(red.naziv_radnika ?? "").toUpperCase(),
    };

    setFiskalizacijaUToku(true);
    try {
      const esirRezultat = await izdajFiskalniRacun(
        "gotovinski",
        invoiceRequest,
        {
          print: true,
          renderReceiptImage: true,
          receiptLayout: "Slip",
          receiptImageFormat: "Png",
          ...ESIR_SLIP_PRESET_58MM,
        },
        String(sifraTabele),
      );
      const { brFiskalnog, datumVremeFiskalnog } = izdvojiFiskalnePodatke(
        esirRezultat.invoiceResponse,
      );
      await azurirajFiskalneUBaziIListi(
        sifraTabele,
        brFiskalnog,
        datumVremeFiskalnog,
      );
      setFiskalnaPoruka({
        naslov: "Fiskalizacija uspješna",
        poruka: `Broj fiskalnog računa: ${brFiskalnog}${
          esirRezultat.upozorenje
            ? `\n\nUpozorenje uređaja: ${esirRezultat.upozorenje}`
            : ""
        }`,
        tip: "uspjeh",
      });
    } catch (err) {
      setFiskalnaPoruka({
        naslov: "Fiskalizacija nije uspjela",
        poruka: err instanceof Error ? err.message : String(err),
        tip: "greska",
      });
    } finally {
      setFiskalizacijaUToku(false);
    }
  };

  // Desni klik na red BEZ br_fiskalnog — provjeri kod ESIR-a (preko RequestId =
  // sifra_tabele) da li je fiskalizacija ipak izvršena (npr. mreža je pukla
  // poslije uspješne fiskalizacije, pa upis u bazu nije prošao). Ako jeste,
  // ponudi upis; ako nije, ponudi kreiranje novog zahtjeva.
  const handleProveriFiskalizaciju = async (red: RacunRed) => {
    const sifraTabele = nadjiSifruTabele(red);
    if (sifraTabele === null) return;
    setFiskalizacijaUToku(true);
    try {
      const pronadjeno = await proveriFiskalizacijuPoRequestId(
        "gotovinski",
        String(sifraTabele),
      );
      setFiskalizacijaUToku(false);

      if (pronadjeno) {
        setFiskalnaPoruka({
          naslov: "Fiskalizacija pronađena",
          poruka:
            `Fiskalizacija JE pronađena na ESIR uređaju za ovaj račun:\n\n` +
            `Broj: ${pronadjeno.invoiceNumber}\nDatum: ${pronadjeno.sdcDateTime}\n\n` +
            `Upisati ove podatke u bazu za ovaj račun?`,
          tip: "pitanje",
          onPotvrdi: async () => {
            setFiskalizacijaUToku(true);
            try {
              await azurirajFiskalneUBaziIListi(
                sifraTabele,
                pronadjeno.invoiceNumber,
                pronadjeno.sdcDateTime,
              );
              setFiskalnaPoruka({
                naslov: "Ažurirano",
                poruka: "Fiskalni podaci su ažurirani.",
                tip: "uspjeh",
              });
            } catch (err) {
              setFiskalnaPoruka({
                naslov: "Greška",
                poruka: err instanceof Error ? err.message : String(err),
                tip: "greska",
              });
            } finally {
              setFiskalizacijaUToku(false);
            }
          },
        });
      } else {
        setFiskalnaPoruka({
          naslov: "Fiskalizacija nije pronađena",
          poruka:
            "Fiskalizacija NIJE pronađena na ESIR uređaju za ovaj račun " +
            "(nikad nije poslata ili nije uspjela).\n\n" +
            "Poslati NOVI zahtjev za fiskalizaciju sada?",
          tip: "pitanje",
          onPotvrdi: () => {
            void kreirajNovuFiskalizaciju(red, sifraTabele);
          },
        });
      }
    } catch (err) {
      setFiskalizacijaUToku(false);
      setFiskalnaPoruka({
        naslov: "Greška",
        poruka: `Greška pri provjeri fiskalizacije: ${
          err instanceof Error ? err.message : String(err)
        }`,
        tip: "greska",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Receipt size={20} style={{ color: PRIMARY }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Pregled računa
          </h2>
          {!loading && !greska && (
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Ukupno: {filtrirani.length} / {racuni.length}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraži račune..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
          <select
            value={odabranaPodgrupa ?? ""}
            onChange={(e) =>
              setOdabranaPodgrupa(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            disabled={loadingPodgrupe}
            className={`ml-auto px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-800 dark:text-[#ede9f6] ${
              odabranaPodgrupa !== null
                ? "border-[#785E9E] bg-[#ede8f5] dark:bg-[#312a50] dark:border-[#785E9E]"
                : "border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d]"
            }`}
          >
            <option value="">
              {loadingPodgrupe ? "Učitavanje..." : "Sve podgrupe"}
            </option>
            {podgrupe.map((p) => (
              <option key={p.sifra_podgrupe} value={p.sifra_podgrupe}>
                {p.opis_podgrupe} ({p.sifra_podgrupe})
              </option>
            ))}
          </select>
          <select
            value={odabranoPlaceno}
            onChange={(e) =>
              setOdabranoPlaceno(e.target.value as "" | "DA" | "NE")
            }
            className={`px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-800 dark:text-[#ede9f6] ${
              odabranoPlaceno !== ""
                ? "border-[#785E9E] bg-[#ede8f5] dark:bg-[#312a50] dark:border-[#785E9E]"
                : "border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d]"
            }`}
          >
            <option value="">Plaćeno: svi</option>
            <option value="DA">Plaćeno: Da</option>
            <option value="NE">Plaćeno: Ne</option>
          </select>
          <select
            value={odabranoStornirano}
            onChange={(e) =>
              setOdabranoStornirano(e.target.value as "" | "DA" | "NE")
            }
            className={`px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-800 dark:text-[#ede9f6] ${
              odabranoStornirano !== ""
                ? "border-[#785E9E] bg-[#ede8f5] dark:bg-[#312a50] dark:border-[#785E9E]"
                : "border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d]"
            }`}
          >
            <option value="">Storniran: svi</option>
            <option value="DA">Storniran: Da</option>
            <option value="NE">Storniran: Ne</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading ? (
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
        ) : greska ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          </div>
        ) : (
          <GenericnaTabela
            redovi={filtrirani}
            podesavanja={PODESAVANJA_PREGLED}
            onKlik={handleKlikRacun}
            onStampaj={handleStampaj}
            onDesniKlikFiskalni={handleDesniKlikFiskalni}
            prosireniKljuc={prosirenaSifra}
            prosireniSadrzaj={
              loadingStavke ? (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Učitavanje...</span>
                </div>
              ) : (
                <div className="max-h-[45vh] overflow-auto border-t-2 border-[#8FC74A]">
                  <GenericnaTabela
                    redovi={stavke}
                    podesavanja={PODESAVANJA_STAVKE}
                    varijanta="stavke"
                  />
                </div>
              )
            }
          />
        )}
      </div>

      {kontekstMeniFiskalni &&
        (() => {
          const red = kontekstMeniFiskalni.red;
          const imaFiskalni =
            red.br_fiskalnog !== null &&
            red.br_fiskalnog !== undefined &&
            String(red.br_fiskalnog).trim() !== "";
          return (
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setKontekstMeniFiskalni(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setKontekstMeniFiskalni(null);
                }}
              />
              <div
                className="fixed z-[9999] bg-white dark:bg-[#261f38] rounded-xl shadow-2xl border border-gray-100 dark:border-[#2d2648] py-1 min-w-[240px]"
                style={{
                  top: kontekstMeniFiskalni.y,
                  left: kontekstMeniFiskalni.x,
                }}
              >
                {imaFiskalni ? (
                  <button
                    onClick={() => {
                      setKontekstMeniFiskalni(null);
                      setFiskalnaPoruka({
                        naslov: "Uskoro",
                        poruka: "Ponovno slanje na ESIR – funkcionalnost dolazi uskoro.",
                        tip: "info",
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                  >
                    <Printer size={13} />
                    Ponovo pošalji na ESIR
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setKontekstMeniFiskalni(null);
                      void handleProveriFiskalizaciju(red);
                    }}
                    disabled={fiskalizacijaUToku}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
                  >
                    <XCircle size={13} />
                    Provjeri / kreiraj fiskalizaciju
                  </button>
                )}
              </div>
            </>
          );
        })()}

      {fiskalnaPoruka && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !fiskalnaPoruka.onPotvrdi) {
              setFiskalnaPoruka(null);
            }
          }}
        >
          <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[420px] max-w-[92vw] overflow-hidden">
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{
                background:
                  fiskalnaPoruka.tip === "greska"
                    ? "#ef4444"
                    : fiskalnaPoruka.tip === "uspjeh"
                      ? ACCENT
                      : PRIMARY,
              }}
            >
              {fiskalnaPoruka.tip === "greska" ? (
                <XCircle size={18} className="text-white flex-shrink-0" />
              ) : fiskalnaPoruka.tip === "uspjeh" ? (
                <CheckCircle2 size={18} className="text-white flex-shrink-0" />
              ) : null}
              <div className="font-bold text-white text-base">
                {fiskalnaPoruka.naslov}
              </div>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-[#c5bfd8] whitespace-pre-line">
              {fiskalnaPoruka.poruka}
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              {fiskalnaPoruka.onPotvrdi ? (
                <>
                  <button
                    onClick={() => setFiskalnaPoruka(null)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-[#7d7498] border border-gray-200 dark:border-[#3a3158] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                  >
                    Ne
                  </button>
                  <button
                    onClick={() => {
                      const onPotvrdi = fiskalnaPoruka.onPotvrdi;
                      setFiskalnaPoruka(null);
                      onPotvrdi?.();
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: PRIMARY }}
                  >
                    Da
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setFiskalnaPoruka(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: PRIMARY }}
                >
                  U redu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
