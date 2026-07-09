import ReactDOM from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Receipt, Search, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.sp_racuni_gl_pregled / erp.sp_racuni_po_pregled — kolone nisu
// unaprijed poznate na frontendu, pa se tabela gradi dinamički iz ključeva reda.
type RacunRed = Record<string, unknown>;

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

  vrednost: { naziv: "Vrednost", sakrij: false, pozicija: 31 },
  vp1: { naziv: "Vp1", sakrij: false, pozicija: 27 },
  rab1: { naziv: "Rab1", sakrij: false, pozicija: 28 },
  vp2: { naziv: "Vp2", sakrij: false, pozicija: 29 },
  rab2: { naziv: "Rab2", sakrij: false, pozicija: 30 },
  rab3: { naziv: "Rab3", sakrij: false, pozicija: 32 },
  osnova_za_obracun_pdv: {
    naziv: "Osnova za PDV",
    sakrij: false,
    pozicija: 33,
  },
  pdv: { naziv: "Pdv", sakrij: false, pozicija: 34 },
  ukupno: { naziv: "Ukupno", sakrij: false, pozicija: 36 },
  rabat_km: { naziv: "Rabat Km", sakrij: false, pozicija: 35 },
  slovima: { naziv: "Slovima", sakrij: true, pozicija: 37 },
  // Nije duplikat "vreme" polja — različita uloga (fiskalni datum/vrijeme).
  // Spojeno u ćeliju "br_fiskalnog" (pozicija/sakrij ovdje se ne koriste).
  datum_vreme_fiskalnog: {
    naziv: "Datum Fiskalnog",
    sakrij: false,
    pozicija: 26,
  },
  storniran_racun: { naziv: "Storniran Racun", sakrij: true, pozicija: 38 },
  // Prikazuje se kao ikonica (kvačica) na kraju tabele kad je racun_placen === "DA".
  racun_placen: { naziv: "Plaćeno", sakrij: false, naKraju: true },
};

// --- erp.sp_racuni_po_pregled — stavke (proizvodi) jednog računa ---
// Redoslijed pozicija prati tačan redoslijed kolona iz procedure.
const PODESAVANJA_STAVKE: Record<string, PodesavanjeKolone> = {
  sifra_tabele: { naziv: "Sifra Tabele", sakrij: false, pozicija: 1 },
  sifra_proizvoda: { naziv: "Sifra Proizvoda", sakrij: false, pozicija: 2 },
  naziv_proizvoda: { naziv: "Naziv Proizvoda", sakrij: false, pozicija: 3 },
  jm: { naziv: "Jm", sakrij: false, pozicija: 4 },
  kolicina: { naziv: "Kolicina", sakrij: false, pozicija: 5 },
  nabavna_cijena: { naziv: "Nabavna Cijena", sakrij: false, pozicija: 6 },
  vpc: { naziv: "Vpc", sakrij: false, pozicija: 7 },
  rabat_proc: { naziv: "Rabat Proc", sakrij: false, pozicija: 8 },
  cijena_sa_rab: { naziv: "Cijena Sa Rab", sakrij: false, pozicija: 9 },
  prodajna_cijena: { naziv: "Prodajna Cijena", sakrij: false, pozicija: 10 },
  nabavna_vrednost: { naziv: "Nabavna Vrednost", sakrij: false, pozicija: 11 },
  vpc_vrednost: { naziv: "Vpc Vrednost", sakrij: false, pozicija: 12 },
  rabat_km: { naziv: "Rabat Km", sakrij: false, pozicija: 13 },
  prodajna_vrednost: {
    naziv: "Prodajna Vrednost",
    sakrij: false,
    pozicija: 14,
  },
  ruc: { naziv: "Ruc", sakrij: false, pozicija: 15 },
  fiskalni_racun: { naziv: "Fiskalni Racun", sakrij: false, pozicija: 16 },
  sifra_grupe: { naziv: "Sifra Grupe", sakrij: false, pozicija: 17 },
  naziv_grupe: { naziv: "Naziv Grupe", sakrij: false, pozicija: 18 },
  vrsta: { naziv: "Vrsta", sakrij: false, pozicija: 19 },
  stornirano: { naziv: "Stornirano", sakrij: false, pozicija: 20 },
  procenat: { naziv: "Procenat", sakrij: false, pozicija: 21 },
  vpc_bez_rabata: { naziv: "Vpc Bez Rabata", sakrij: false, pozicija: 22 },
  vpc_vrednost_bez_rabata: {
    naziv: "Vpc Vrednost Bez Rabata",
    sakrij: false,
    pozicija: 23,
  },
  vpc_rabat_1: { naziv: "Vpc Rabat 1", sakrij: false, pozicija: 24 },
  vp_1: { naziv: "Vp 1", sakrij: false, pozicija: 25 },
  rabat_proc_2: { naziv: "Rabat Proc 2", sakrij: false, pozicija: 26 },
  rabat_km_2: { naziv: "Rabat Km 2", sakrij: false, pozicija: 27 },
  vpc_sa_rab_2: { naziv: "Vpc Sa Rab 2", sakrij: false, pozicija: 28 },
  vp_2: { naziv: "Vp 2", sakrij: false, pozicija: 29 },
  rab_proc_3: { naziv: "Rab Proc 3", sakrij: false, pozicija: 30 },
  rabat_km_3: { naziv: "Rabat Km 3", sakrij: false, pozicija: 31 },
  barkod: { naziv: "Barkod", sakrij: false, pozicija: 32 },
  nabavna_cijena_proizvoda: {
    naziv: "Nabavna Cijena Proizvoda",
    sakrij: false,
    pozicija: 33,
  },
  nabavna_vrednost_proizvoda: {
    naziv: "Nabavna Vrednost Proizvoda",
    sakrij: false,
    pozicija: 34,
  },
  ruc_2: { naziv: "Ruc 2", sakrij: false, pozicija: 35 },
  pdv_po_artiklu: { naziv: "Pdv Po Artiklu", sakrij: false, pozicija: 36 },
  nabavna_vrednost_za_ruc: {
    naziv: "Nabavna Vrednost Za Ruc",
    sakrij: false,
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
// ćelije gornjeg ključa). Dodaj novi par ovdje + naslov u NASLOVI_U_DVA_REDA.
const PAROVI_CELIJA: Record<string, string> = {
  vrsta_racuna_novo: "datum_racuna",
  br_fiskalnog: "datum_vreme_fiskalnog",
  vp1: "rab1",
  vp2: "rab2",
  vrednost: "rab3",
  osnova_za_obracun_pdv: "pdv",
};
// Zaglavlja spojenih ćelija — prikazuju se u dva reda umjesto jednog naziva.
const NASLOVI_U_DVA_REDA: Record<string, [string, string]> = {
  vrsta_racuna_novo: ["Broj računa", "Datum računa"],
  br_fiskalnog: ["Br. fiskalnog", "Datum fiskalnog"],
  vp1: ["Vp1", "Rab1"],
  vp2: ["Vp2", "Rab2"],
  vrednost: ["Vrednost", "Rab3"],
  osnova_za_obracun_pdv: ["Osnova za PDV", "PDV"],
};
// vrsta_racuna_novi se koristi da vizuelno razdvoji račune po vrsti (1 = MP, 2 = VP).
const BOJA_PO_VRSTI_RACUNA: Record<string, string> = {
  "1": PRIMARY,
  "2": ACCENT,
};
const bojaVrsteRacuna = (v: unknown) =>
  BOJA_PO_VRSTI_RACUNA[String(v)] ?? "#9ca3af";

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

const formatirajVrijednost = (v: unknown, kljuc?: string): string => {
  if (kljuc === "datum_racuna") return formatDatumDMY(v);
  if (kljuc === "datum_vreme_fiskalnog") return formatDatumVrijemeDMY(v);
  if (v === null || v === undefined || v === "") return "–";
  if (izgledaKaoBroj(v)) {
    const n = Number(v);
    // DECIMAL kolone dolaze iz baze kao string sa tačkom (npr. "150.00") čak i
    // kad je vrijednost cio broj — zadrži 2 decimale u tom slučaju. INT kolone
    // dolaze kao broj (bez tačke u zapisu) i ostaju prikazane bez decimala.
    const jeDecimalno = typeof v === "string" && v.includes(".");
    return Number.isInteger(n) && !jeDecimalno ? String(n) : n.toFixed(2);
  }
  return String(v);
};

function GenericnaTabela({
  redovi,
  podesavanja,
  onKlik,
}: {
  redovi: RacunRed[];
  podesavanja: Record<string, PodesavanjeKolone>;
  onKlik?: (red: RacunRed) => void;
}) {
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
          <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
            {imaPartnera && (
              <th className="text-left pl-3 pr-[5px] py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] whitespace-nowrap">
                Partner
              </th>
            )}
            {kolone.map((k) => {
              const dvaReda = NASLOVI_U_DVA_REDA[k];
              return (
                <th
                  key={k}
                  className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] whitespace-nowrap"
                >
                  {dvaReda ? (
                    <>
                      <div>{dvaReda[0]}</div>
                      <div>{dvaReda[1]}</div>
                    </>
                  ) : (
                    lijepNazivKolone(podesavanja, k)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {redovi.map((red, i) => {
            const boja = bojaVrsteRacuna(red.vrsta_racuna_novi);
            return (
              <tr
                key={nadjiSifruTabele(red) ?? i}
                onClick={() => onKlik?.(red)}
                style={{ borderLeft: `3px solid ${boja}` }}
                className={`border-b border-gray-100 dark:border-[#2a2340] ${
                  i % 2 === 0
                    ? "bg-white dark:bg-[#1a1528]"
                    : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                } ${onKlik ? "cursor-pointer hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]" : ""}`}
              >
                {imaPartnera && (
                  <td className="pl-3 pr-[5px] py-1.5 whitespace-nowrap">
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
                  if (k === "racun_placen") {
                    const placen = String(red[k] ?? "").trim().toUpperCase() === "DA";
                    return (
                      <td key={k} className="px-3 py-1.5 text-center">
                        {placen && (
                          <CheckCircle2
                            size={15}
                            className="inline-block text-emerald-500"
                          />
                        )}
                      </td>
                    );
                  }
                  const donjiKljuc = PAROVI_CELIJA[k];
                  if (donjiKljuc) {
                    return (
                      <td
                        key={k}
                        className="px-3 py-1.5 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8]"
                      >
                        <div
                          className="font-semibold"
                          style={{ color: PRIMARY }}
                        >
                          {formatirajVrijednost(red[k], k)}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                          {formatirajVrijednost(red[donjiKljuc], donjiKljuc)}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={k}
                      className={`px-3 py-1.5 whitespace-nowrap ${
                        k === "vrsta_racuna_novi"
                          ? "font-bold"
                          : "text-gray-700 dark:text-[#c5bfd8]"
                      }`}
                      style={
                        k === "vrsta_racuna_novi" ? { color: boja } : undefined
                      }
                    >
                      {formatirajVrijednost(red[k], k)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RacuniPregled() {
  const [racuni, setRacuni] = useState<RacunRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");

  const [odabraniRacun, setOdabraniRacun] = useState<RacunRed | null>(null);
  const [stavke, setStavke] = useState<RacunRed[]>([]);
  const [loadingStavke, setLoadingStavke] = useState(false);

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
    if (!q) return racuni;
    return racuni.filter((red) =>
      Object.values(red).some(
        (v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q),
      ),
    );
  }, [racuni, pretraga]);

  const handleKlikRacun = async (red: RacunRed) => {
    const sifraTabele = nadjiSifruTabele(red);
    if (sifraTabele === null) return;
    setOdabraniRacun(red);
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
        <div className="relative max-w-xs">
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
          />
        )}
      </div>

      {odabraniRacun &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOdabraniRacun(null);
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[900px] max-w-[95vw] max-h-[80vh] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <Receipt size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Stavke računa
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Šifra tabele: {nadjiSifruTabele(odabraniRacun)}
                  </div>
                </div>
                <button
                  onClick={() => setOdabraniRacun(null)}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {loadingStavke ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Učitavanje...</span>
                  </div>
                ) : (
                  <GenericnaTabela
                    redovi={stavke}
                    podesavanja={PODESAVANJA_STAVKE}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
