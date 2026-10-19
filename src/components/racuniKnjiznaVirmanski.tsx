import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Package,
  Search,
  X,
} from "lucide-react";
import {
  ESIR_SLIP_PRESET_58MM,
  izdajFiskalniRacun,
  izdvojiFiskalnePodatke,
  jeEsirZakljucanZbogPina,
  jePotrebanPin,
  preuzmiStatusEsira,
  proveriFiskalizacijuPoRequestId,
  type EsirInvoiceRequest,
  type EsirInvoiceResponse,
} from "./fiskalniRacuni";
import {
  preuzmiOriginalniFiskalniRacun,
  pripremiRefundZahtjev,
} from "./fiskalniStorno";
import { getCurrentUser } from "../utils/auth";
import { usePrint } from "../context/PrintContext";
import { RacunA4, type RacunA4Stavka } from "../print/templates/RacunA4";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const DANGER = "#ef4444";
// Raspored je isti kao u racuniKnjiznaGotovinski.tsx (storno MP), ali je
// pregled namjerno u drugoj boji da operater odmah vidi da je na storno VP.
const VP_BOJA = "#0f766e";

// Storno je uvijek za cijeli žiralni (VP) račun — isti tok kao
// racuniKnjiznaGotovinski.tsx: erp.racuni_unos_storno (POST /api/racuni/storno)
// u jednoj transakciji upisuje KO VP (2 -> 4) sa količinom * -1, vraća robu na
// lager i postavlja storniran_racun=1 na originalu. Zatim ESIR refundacija na
// uređaju "ziralni" (sadržaj originala preuzet sa ESIR-a — vidi
// fiskalniStorno.ts) i upis fiskalnog broja na storno red.
const VRSTA_RACUNA_NOVI_VP = 2;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDatumIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatDatumDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}.`;
};
const formatDatumVrijemeDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${formatDatumDMY(v)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const imaVrijednost = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";
// Fallback na "stornirano" isto kao u racuniPregled.tsx (procedura zna
// vratiti kolonu i pod tim imenom).
const jeStorniran = (r: { storniran_racun?: unknown; stornirano?: unknown }) =>
  Number(r.storniran_racun ?? r.stornirano) === 1;

// Red vraćen sa erp.sp_racuni_gl_pregled (GET /api/pregledi/racuna) — isti
// izvor kao racuniPregled.tsx i racuniKnjiznaGotovinski.tsx.
interface RacunPregledRed {
  sifra_tabele: number;
  broj_racuna: number | string;
  vrsta_racuna_novi: number | string;
  vrsta_racuna_novo?: string;
  vrsta_racuna_pod: number | string;
  datum_racuna: string;
  datum_isporuke?: string;
  valuta?: string;
  sifra_partnera: number | string;
  naziv_partnera: string;
  br_fiskalnog?: string | number | null;
  datum_vreme_fiskalnog?: string | null;
  ukupno: number | string;
  storniran_racun?: number | string | null;
  [key: string]: unknown;
}

// Red sa erp.sp_racuni_po_pregled (GET /api/racuni/pregled-stavke) za STORNO
// zapis — samo polja potrebna za A4 štampu.
type StavkaStorna = Record<string, unknown>;

// Stavka originala čiji kataloški VPC na računu (vpc_bez_rabata) nije isti kao
// trenutni VPC artikla (erp.artikli_pregled_sve) — storno vraća robu na lager
// po količini, pa se ta razlika finansijski ne poravnava sama.
interface VpcRazlika {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  // vrsta_proizvoda iz erp.artikli_pregled_sve: 1 proizvodi, 2 roba — jedna
  // nivelacija je ili roba ili proizvodi (vidi NivelacijaUnos.tsx).
  vrsta_proizvoda: number;
  kolicina: number;
  vpcRacun: number;
  vpcTrenutna: number;
  razlika: number;
}

interface TrenutniArtikal {
  vpc: number;
  vrsta: number;
}

const p2 = pad2;
const datumZaBazu = (d: Date) =>
  `${formatDatumIso(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

export function KnjiznaVirmanski() {
  const [racuni, setRacuni] = useState<RacunPregledRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [ucitavaStarije, setUcitavaStarije] = useState(false);
  const [greskaStarije, setGreskaStarije] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [odabraniRacun, setOdabraniRacun] = useState<RacunPregledRed | null>(
    null,
  );
  const [storniranjeLoading, setStorniranjeLoading] = useState(false);
  const [storniranjeGreska, setStorniranjeGreska] = useState<string | null>(
    null,
  );
  const [storniranjeUspjeh, setStorniranjeUspjeh] = useState<string | null>(
    null,
  );
  const [storniranjeUpozorenje, setStorniranjeUpozorenje] = useState<
    string | null
  >(null);
  const [storniranjeKorak, setStorniranjeKorak] = useState<string | null>(null);
  // Storno je upisan u bazu, ali ESIR refundacija (ili upis fiskalnog broja)
  // nije završena — čuva se zahtjev da se može ponoviti sa ISTIM RequestId-em.
  const [esirNedovrsen, setEsirNedovrsen] = useState<{
    sifraStorna: number | string;
    brojStorna: number | string | null;
    zahtjev: EsirInvoiceRequest;
    original: RacunPregledRed;
  } | null>(null);
  const { openPrint } = usePrint();

  // Provjera VPC original vs. trenutni — samo informativno, ne blokira storno.
  const [vpcProvjera, setVpcProvjera] = useState<{
    loading: boolean;
    greska: string | null;
    razlike: VpcRazlika[];
  } | null>(null);
  // Token da odgovor za ranije otvoren račun ne prepiše provjeru novog.
  const vpcProvjeraTokenRef = useRef(0);
  // Poluautomatska nivelacija razlike VPC (erp.artikli_nivelacija_unos preko
  // POST /api/nivelacije/unos) — radi se SAMO ako operater označi opciju, i to
  // tek nakon što je storno upisan u bazu.
  const [nivelacijaZeljena, setNivelacijaZeljena] = useState(false);
  const [nivelacijaStatus, setNivelacijaStatus] = useState<{
    loading: boolean;
    uspjeh: string | null;
    greska: string | null;
  } | null>(null);
  // Već sačuvane grupe (1 roba / 0 proizvodi) sa brojem nivelacije — kod
  // ponovnog pokušaja se preskaču da se ista razlika ne niveliše dvaput.
  const nivelacijaUradjenoRef = useRef<Map<0 | 1, string>>(new Map());

  // Trenutni VPC i vrsta po šifri artikla — uvijek svježe sa servera (provjera
  // pri otvaranju modala i ponovo neposredno prije nivelacije).
  const ucitajTrenutneArtikle = async () => {
    const res = await fetch(`${API_URL}/api/artikli/pregled-sve`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    const mapa = new Map<string, TrenutniArtikal>();
    for (const a of (json.data ?? []) as Record<string, unknown>[]) {
      mapa.set(String(a.sifra_proizvoda).trim(), {
        vpc: Number(a.vpc) || 0,
        vrsta: Number(a.vrsta_proizvoda) || 0,
      });
    }
    return mapa;
  };

  const provjeriVpc = async (r: RacunPregledRed) => {
    const token = ++vpcProvjeraTokenRef.current;
    setVpcProvjera({ loading: true, greska: null, razlike: [] });
    try {
      const [resStavke, trenutne] = await Promise.all([
        fetch(
          `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${r.sifra_tabele}`,
          { credentials: "include" },
        ),
        ucitajTrenutneArtikle(),
      ]);
      const jsonStavke = await resStavke.json();
      if (!resStavke.ok || !jsonStavke.success) {
        throw new Error(jsonStavke.error || `HTTP ${resStavke.status}`);
      }
      // Ista šifra može biti više puta na računu — sabira se po šifri + VPC.
      const poKljucu = new Map<string, VpcRazlika>();
      for (const s of (jsonStavke.data ?? []) as StavkaStorna[]) {
        const sifra = String(s.sifra_proizvoda).trim();
        const trenutni = trenutne.get(sifra);
        if (!trenutni) continue;
        const vpcRacun = Number(s.vpc_bez_rabata) || 0;
        if (Math.abs(trenutni.vpc - vpcRacun) < 0.005) continue;
        const kolicina = Math.abs(Number(s.kolicina) || 0);
        const kljuc = `${sifra}|${vpcRacun}`;
        const postojeca = poKljucu.get(kljuc);
        const ukupnaKolicina = (postojeca?.kolicina ?? 0) + kolicina;
        poKljucu.set(kljuc, {
          sifra_proizvoda: sifra,
          naziv_proizvoda: String(s.naziv_proizvoda ?? ""),
          vrsta_proizvoda: trenutni.vrsta,
          kolicina: ukupnaKolicina,
          vpcRacun,
          vpcTrenutna: trenutni.vpc,
          razlika: round2(ukupnaKolicina * (trenutni.vpc - vpcRacun)),
        });
      }
      const razlike = [...poKljucu.values()];
      if (token === vpcProvjeraTokenRef.current) {
        setVpcProvjera({ loading: false, greska: null, razlike });
      }
    } catch (error) {
      if (token === vpcProvjeraTokenRef.current) {
        setVpcProvjera({
          loading: false,
          greska: error instanceof Error ? error.message : String(error),
          razlike: [],
        });
      }
    }
  };

  // Nivelacija razlike: za vraćenu količinu cijena_stara = VPC na računu,
  // cijena_nova = trenutna VPC. Procedura postavlja vpc = cijena_nova, a to je
  // već trenutna VPC — cijena artikla se ne mijenja, samo se knjiži razlika u
  // vrijednosti zaliha. Roba i proizvodi idu u odvojene nivelacije
  // (nivelacija_robe 1/0); sirovine se ne nivelišu. Prije slanja se trenutna
  // VPC čita ponovo — ako se u međuvremenu promijenila, ništa se ne šalje (inače
  // bi procedura vratila VPC na staru vrijednost iz modala).
  const uradiNivelaciju = async (razlike: VpcRazlika[]) => {
    setNivelacijaStatus({ loading: true, uspjeh: null, greska: null });
    try {
      const svjeze = await ucitajTrenutneArtikle();
      const promijenjene = razlike.filter(
        (d) =>
          Math.abs((svjeze.get(d.sifra_proizvoda)?.vpc ?? NaN) - d.vpcTrenutna) >=
            0.005 || !svjeze.has(d.sifra_proizvoda),
      );
      if (promijenjene.length > 0) {
        throw new Error(
          `VPC se u međuvremenu promijenila za: ${promijenjene
            .map((d) => d.naziv_proizvoda)
            .join(", ")} — nivelaciju uradite ručno.`,
        );
      }

      const grupe: { nivelacijaRobe: 0 | 1; stavke: VpcRazlika[] }[] = [
        { nivelacijaRobe: 1, stavke: razlike.filter((d) => d.vrsta_proizvoda === 2) },
        { nivelacijaRobe: 0, stavke: razlike.filter((d) => d.vrsta_proizvoda === 1) },
      ];
      const preskocene = razlike.filter(
        (d) => d.vrsta_proizvoda !== 1 && d.vrsta_proizvoda !== 2,
      );

      const uradjeno = nivelacijaUradjenoRef.current;
      const sifre = () => [...uradjeno.values()];
      for (const g of grupe) {
        if (g.stavke.length === 0 || uradjeno.has(g.nivelacijaRobe)) continue;
        const res = await fetch(`${API_URL}/api/nivelacije/unos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            datum_nivelacije: datumZaBazu(new Date()),
            nivelacija_robe: g.nivelacijaRobe,
            sifra_knjizenja: 0,
            stavke: g.stavke.map((d) => ({
              sifra_proizvoda: Number(d.sifra_proizvoda),
              kolicina_proizvoda: d.kolicina,
              cijena_stara: d.vpcRacun,
              cijena_nova: d.vpcTrenutna,
            })),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(
            `${uradjeno.size > 0 ? `Nivelacija br. ${sifre().join(", ")} je sačuvana, ali ` : ""}nivelacija ${
              g.nivelacijaRobe ? "robe" : "proizvoda"
            } nije uspjela: ${json?.error || `HTTP ${res.status}`}`,
          );
        }
        uradjeno.set(g.nivelacijaRobe, String(json.data?.sifra_nivelacije ?? "?"));
      }

      setNivelacijaStatus({
        loading: false,
        uspjeh: `Nivelacija razlike VPC je sačuvana${
          uradjeno.size > 0 ? ` (br. ${sifre().join(", ")})` : ""
        }.${
          preskocene.length > 0
            ? ` Preskočeno (nije roba ni proizvod): ${preskocene
                .map((d) => d.naziv_proizvoda)
                .join(", ")}.`
            : ""
        }`,
        greska: null,
      });
    } catch (error) {
      setNivelacijaStatus({
        loading: false,
        uspjeh: null,
        greska: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Pregled za štampu storna na istom A4 šablonu kao žiralni unos i
  // racuniPregled.tsx (handleStampaj, VP grana) — stavke se čitaju iz baze za
  // STORNO zapis (negativne količine), partner sa originala, a PFR broj/datum/QR
  // iz ESIR odgovora refundacije (bez njih ako refundacija još nije prošla).
  const otvoriStampuStorna = async (
    original: RacunPregledRed,
    sifraStorna: number | string,
    brojStorna: number | string | null,
    invoiceResponse: EsirInvoiceResponse | null,
  ) => {
    let stavke: StavkaStorna[] = [];
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${sifraStorna}`,
        { credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      stavke = json.data ?? [];
    } catch (error) {
      setStorniranjeUpozorenje(
        `Storno je sačuvan, ali stavke za štampu nisu učitane: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    // Ista kaskada kao racuniPregled.tsx (izracunajStavku). Storno procedura
    // upisuje rabat_proc NEGATIVNO, pa se procenti uzimaju po apsolutnoj
    // vrijednosti; pdv prati predznak ukupnog iznosa stavke.
    const broj = (s: StavkaStorna, k: string) => Number(s[k] ?? 0) || 0;
    const stavkeMapirane: RacunA4Stavka[] = stavke.map((s) => {
      const ukupno = broj(s, "prodajna_vrednost");
      const pdvAbs = Math.abs(broj(s, "pdv_po_artiklu"));
      const pdv = ukupno < 0 ? -pdvAbs : pdvAbs;
      const vpcKatalog = broj(s, "vpc_bez_rabata");
      const rab1 = Math.abs(broj(s, "rabat_proc"));
      const rab2 = Math.abs(broj(s, "rabat_proc_2"));
      const rab3 = Math.abs(broj(s, "rab_proc_3"));
      const vpc1 = round2(vpcKatalog * (1 - rab1 / 100));
      const vpc2 = round2(vpc1 * (1 - rab2 / 100));
      const vpc3 = round2(vpc2 * (1 - rab3 / 100));
      return {
        sifra_proizvoda: (s.sifra_proizvoda as string | number) ?? "",
        naziv_proizvoda: String(s.naziv_proizvoda ?? ""),
        jm: String(s.jm ?? ""),
        kolicina: (s.kolicina as number | string) ?? 0,
        vpc: vpcKatalog,
        vpc1,
        rab1,
        vpc2,
        rab2,
        vpc3,
        rab3,
        osnova: vpc3,
        vrednost: round2(ukupno - pdv),
        pdv,
        ukupno,
      };
    });

    const sada = new Date();
    const datum = formatDatumIso(sada);
    const brojRacunaZaStampu = `STORNO-${original.vrsta_racuna_pod ?? 0}-${
      brojStorna ?? "-"
    } / ${String(sada.getFullYear()).slice(-2)}`;
    openPrint({
      title: `Račun ${brojRacunaZaStampu}`,
      format: "A4",
      component: (
        <RacunA4
          racun={{
            broj_racuna: brojRacunaZaStampu,
            datum_izdavanja: datum,
            datum_isporuke: String(original.datum_isporuke ?? datum),
            valuta: String(original.valuta ?? datum),
            sifra_tabele: sifraStorna,
            naziv_partnera: original.naziv_partnera,
            adresa_partnera: (original.adresa_partnera as string | null) ?? null,
            naziv_grada: (original.naziv_grada as string | null) ?? null,
            jib: (original.jib as string | null) ?? null,
            pib: (original.pib as string | null) ?? null,
            poslovna_jedinica: null,
            slovima: null,
            // Isti tekst koji upisuje erp.racuni_unos_storno u napomenu.
            napomena: `STORNO racuna br. ${original.broj_racuna} (sifra_tabele ${original.sifra_tabele})`,
            br_fiskalnog: invoiceResponse?.invoiceNumber ?? null,
            datum_vreme_fiskalnog: invoiceResponse?.sdcDateTime ?? null,
            verifikacioni_qr: invoiceResponse?.verificationQRCode ?? null,
          }}
          stavke={stavkeMapirane}
        />
      ),
    });
  };

  const resetujStanjeStorna = () => {
    setStorniranjeGreska(null);
    setStorniranjeUspjeh(null);
    setStorniranjeUpozorenje(null);
    setStorniranjeKorak(null);
    setEsirNedovrsen(null);
  };

  const otvoriModal = (r: RacunPregledRed) => {
    if (jeStorniran(r)) return;
    setOdabraniRacun(r);
    resetujStanjeStorna();
    setNivelacijaZeljena(false);
    setNivelacijaStatus(null);
    nivelacijaUradjenoRef.current = new Map();
    void provjeriVpc(r);
  };

  const zatvoriModal = () => {
    if (storniranjeLoading) return;
    setOdabraniRacun(null);
    resetujStanjeStorna();
    if (nivelacijaStatus?.loading) return;
    vpcProvjeraTokenRef.current++;
    setVpcProvjera(null);
    setNivelacijaZeljena(false);
    setNivelacijaStatus(null);
  };

  // ESIR refundacija + upis br_fiskalnog/datum_vreme_fiskalnog na STORNO red.
  // RequestId = sifra_tabele storna, pa je ponovni pokušaj idempotentan; kod
  // ponavljanja se prvo provjerava da li je ESIR refundaciju već izvršio.
  const fiskalizujIUpisi = async (
    sifraStorna: number | string,
    zahtjev: EsirInvoiceRequest,
    provjeriPrvo: boolean,
  ) => {
    const requestId = String(sifraStorna);
    let invoiceResponse: EsirInvoiceResponse | null = null;
    let upozorenje: string | null = null;

    if (provjeriPrvo) {
      setStorniranjeKorak("Provjera da li je refundacija već izvršena...");
      invoiceResponse = await proveriFiskalizacijuPoRequestId(
        "ziralni",
        requestId,
      ).catch(() => null);
    }

    if (!invoiceResponse) {
      setStorniranjeKorak("Slanje refundacije na ESIR...");
      const rezultat = await izdajFiskalniRacun(
        "ziralni",
        zahtjev,
        {
          print: true,
          renderReceiptImage: true,
          receiptLayout: "Slip",
          receiptImageFormat: "Png",
          ...ESIR_SLIP_PRESET_58MM,
        },
        requestId,
      );
      invoiceResponse = rezultat.invoiceResponse;
      upozorenje = rezultat.upozorenje;
    }

    const { brFiskalnog, datumVremeFiskalnog } =
      izdvojiFiskalnePodatke(invoiceResponse);

    setStorniranjeKorak("Upis fiskalnog broja storna u bazu...");
    const res = await fetch(`${API_URL}/api/racuni/azuriraj-fiskalne-podatke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sifra_tabele: sifraStorna,
        br_fiskalnog: brFiskalnog,
        datum_vreme_fiskalnog: datumVremeFiskalnog,
      }),
    });
    if (!res.ok) {
      const g = await res.json().catch(() => null);
      throw new Error(
        `ESIR refundacija je izvršena (fiskalni broj ${brFiskalnog}), ali upis u bazu nije uspio: ${
          g?.error || `HTTP ${res.status}`
        }`,
      );
    }
    return { brFiskalnog, upozorenje, invoiceResponse };
  };

  const handlePotvrdiStorno = async () => {
    if (!odabraniRacun || storniranjeLoading) return;
    const sifraOriginala = odabraniRacun.sifra_tabele;
    const brFiskalnogOriginala = String(odabraniRacun.br_fiskalnog ?? "").trim();
    setStorniranjeLoading(true);
    resetujStanjeStorna();

    // Faza 1 — sve provjere PRIJE upisa u bazu: ako ESIR nije spreman ili
    // original nije na uređaju, ništa se ne upisuje.
    let zahtjev: EsirInvoiceRequest;
    try {
      if (!brFiskalnogOriginala) {
        throw new Error(
          "Račun nema broj fiskalnog računa — ESIR refundacija nije moguća.",
        );
      }
      if (jeEsirZakljucanZbogPina("ziralni")) {
        throw new Error(
          "ESIR žiralni je zaključan zbog neuspjelih pokušaja PIN-a — unesite PIN ručno pa pokušajte ponovo.",
        );
      }
      setStorniranjeKorak("Provjera ESIR uređaja...");
      const status = await preuzmiStatusEsira("ziralni");
      if (jePotrebanPin(status)) {
        throw new Error(
          "ESIR žiralni traži PIN — unesite PIN (ekran Žiralni račun) pa pokušajte ponovo.",
        );
      }
      setStorniranjeKorak("Preuzimanje originalnog fiskalnog računa...");
      const original = await preuzmiOriginalniFiskalniRacun(
        "ziralni",
        brFiskalnogOriginala,
      );
      zahtjev = pripremiRefundZahtjev(
        original,
        (getCurrentUser()?.username ?? "").toUpperCase(),
      );
    } catch (error) {
      setStorniranjeGreska(
        `Storno nije urađen (ništa nije upisano): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
      return;
    }

    // Faza 2 — upis storna u bazu (erp.racuni_unos_storno).
    let sifraStorna: number | string;
    let brojStorna: number | string | null;
    try {
      setStorniranjeKorak("Upis storna u bazu...");
      const res = await fetch(`${API_URL}/api/racuni/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sifra_tabele: sifraOriginala }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || `Greška pri storniranju računa (HTTP ${res.status})`,
        );
      }
      if (!imaVrijednost(json.sifra_tabele)) {
        throw new Error("Procedura storna nije vratila šifru tabele storna.");
      }
      sifraStorna = json.sifra_tabele;
      brojStorna = imaVrijednost(json.broj_racuna) ? json.broj_racuna : null;
      // Procedura je već postavila storniran_racun=1 na originalu — lokalno
      // isto, da red odmah bude zaključan u listi.
      setRacuni((prev) =>
        prev.map((r) =>
          r.sifra_tabele === sifraOriginala ? { ...r, storniran_racun: 1 } : r,
        ),
      );
    } catch (error) {
      setStorniranjeGreska(
        error instanceof Error ? error.message : "Greška pri storniranju računa.",
      );
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
      return;
    }

    // Faza 2b — nivelacija razlike VPC, samo ako je operater to označio.
    // Storno je već u bazi, pa neuspjeh nivelacije ne prekida ESIR refundaciju;
    // u modalu ostaje dugme za ponovni pokušaj.
    if (nivelacijaZeljena && vpcProvjera && vpcProvjera.razlike.length > 0) {
      setStorniranjeKorak("Nivelacija razlike VPC...");
      await uradiNivelaciju(vpcProvjera.razlike);
    }

    // Faza 3 — ESIR refundacija + upis fiskalnog broja na storno. A4 se
    // otvara u svakom slučaju (storno je u bazi), sa QR/PFR podacima ako je
    // refundacija prošla.
    const original = odabraniRacun;
    try {
      const { brFiskalnog, upozorenje, invoiceResponse } = await fiskalizujIUpisi(
        sifraStorna,
        zahtjev,
        false,
      );
      void otvoriStampuStorna(original, sifraStorna, brojStorna, invoiceResponse);
      setStorniranjeUspjeh(
        `Račun je storniran${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""} i refundacija je fiskalizovana (fiskalni broj ${brFiskalnog}).`,
      );
      if (upozorenje) {
        setStorniranjeUpozorenje(
          `Refundacija je fiskalizovana, ali uređaj javlja: ${upozorenje}`,
        );
      }
    } catch (error) {
      setEsirNedovrsen({ sifraStorna, brojStorna, zahtjev, original });
      void otvoriStampuStorna(original, sifraStorna, brojStorna, null);
      setStorniranjeGreska(
        `Storno je upisan u bazu${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""}, ali ESIR refundacija nije završena: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
    }
  };

  const handlePonoviEsir = async () => {
    if (!esirNedovrsen || storniranjeLoading) return;
    const { sifraStorna, brojStorna, zahtjev, original } = esirNedovrsen;
    setStorniranjeLoading(true);
    setStorniranjeGreska(null);
    setStorniranjeUpozorenje(null);
    try {
      const { brFiskalnog, upozorenje, invoiceResponse } = await fiskalizujIUpisi(
        sifraStorna,
        zahtjev,
        true,
      );
      setEsirNedovrsen(null);
      void otvoriStampuStorna(original, sifraStorna, brojStorna, invoiceResponse);
      setStorniranjeUspjeh(
        `Račun je storniran${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""} i refundacija je fiskalizovana (fiskalni broj ${brFiskalnog}).`,
      );
      if (upozorenje) {
        setStorniranjeUpozorenje(
          `Refundacija je fiskalizovana, ali uređaj javlja: ${upozorenje}`,
        );
      }
    } catch (error) {
      setStorniranjeGreska(
        `ESIR refundacija i dalje nije završena: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
    }
  };

  // GET /api/pregledi/racuna (sp_racuni_gl_pregled) vraća samo zadnjih 200
  // računa SVIH vrsta — zato isto dvofazno učitavanje kao racuniPregled.tsx i
  // racuniKnjiznaGotovinski.tsx: stats -> granica = max_sifra - 200 ->
  // "glavna" (najnoviji, odmah prikazani) pa "pozadina" (svi stariji, dopisuju
  // se kad stignu). U state ulaze samo VP računi.
  const samoVp = (redovi: RacunPregledRed[]) =>
    redovi.filter((r) => Number(r.vrsta_racuna_novi) === VRSTA_RACUNA_NOVI_VP);

  const ucitajRacune = async () => {
    setLoading(true);
    setGreska(null);
    setGreskaStarije(null);
    try {
      const statsRes = await fetch(`${API_URL}/api/pregledi/racuna/stats`, {
        credentials: "include",
      });
      const statsJson = await statsRes.json();
      if (!statsRes.ok || !statsJson.success) {
        setGreska(
          statsJson.error || statsJson.message || "Greška pri učitavanju računa",
        );
        setLoading(false);
        return;
      }
      const granica = (Number(statsJson.data?.max_sifra) || 0) - 200;

      const glavnaRes = await fetch(
        `${API_URL}/api/pregledi/racuna/glavna?granica=${granica}`,
        { credentials: "include" },
      );
      const glavnaJson = await glavnaRes.json();
      if (!glavnaRes.ok || !glavnaJson.success) {
        setGreska(
          glavnaJson.error || glavnaJson.message || "Greška pri učitavanju računa",
        );
        setLoading(false);
        return;
      }
      setRacuni(samoVp(glavnaJson.data ?? []));
      setLoading(false);

      setUcitavaStarije(true);
      try {
        const pozadinaRes = await fetch(
          `${API_URL}/api/pregledi/racuna/pozadina?granica=${granica}`,
          { credentials: "include" },
        );
        const pozadinaJson = await pozadinaRes.json();
        if (pozadinaRes.ok && pozadinaJson.success) {
          setRacuni((prev) => [...prev, ...samoVp(pozadinaJson.data ?? [])]);
        } else {
          setGreskaStarije(
            pozadinaJson.error ||
              pozadinaJson.message ||
              "Greška pri učitavanju starijih računa",
          );
        }
      } catch {
        setGreskaStarije("Greška pri učitavanju starijih računa");
      } finally {
        setUcitavaStarije(false);
      }
    } catch {
      setGreska("Greška pri učitavanju računa");
      setLoading(false);
    }
  };

  useEffect(() => {
    void ucitajRacune();
  }, []);

  // Prikazuju se svi VP računi — i već stornirani, ali zaključani (katanac,
  // klik ne otvara storno). Procedura erp.racuni_unos_storno ionako odbija
  // ponovni storno ("Racun je vec storniran."), ovo je samo da se ne pokušava.
  const vpRacuni = racuni;
  const brojStorniranih = useMemo(
    () => vpRacuni.filter(jeStorniran).length,
    [vpRacuni],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return vpRacuni;
    return vpRacuni.filter((r) =>
      [r.naziv_partnera, r.broj_racuna, r.vrsta_racuna_novo, r.br_fiskalnog]
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [vpRacuni, pretraga]);

  const th =
    "px-4 py-2.5 font-semibold border-b border-teal-800 whitespace-nowrap";

  return (
    <div className="flex flex-col items-center">
      <div className="w-fit max-w-full space-y-4">
        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderLeftColor: VP_BOJA }}
        >
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraži VP račune..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-teal-600 transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
          <div className="text-right">
            {!loading && !greska && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878] flex items-center justify-end gap-1.5">
                VP računi: {filtrirani.length} / {vpRacuni.length} · stornirano:{" "}
                {brojStorniranih}
                {ucitavaStarije && (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    učitavanje starijih računa...
                  </>
                )}
              </p>
            )}
            {greskaStarije && (
              <p className="text-xs text-amber-500 flex items-center justify-end gap-1">
                <AlertTriangle size={11} />
                {greskaStarije} — prikazani su samo najnoviji računi.
              </p>
            )}
          </div>
        </div>

        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm overflow-hidden"
          style={{ borderLeftColor: VP_BOJA }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-10 px-16 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Učitavanje...</span>
            </div>
          ) : greska ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-red-500">
              <AlertTriangle size={24} />
              <span className="text-sm">{greska}</span>
            </div>
          ) : filtrirani.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-gray-400 dark:text-[#5f5878]">
              <Package size={24} className="text-gray-300 dark:text-[#3a3158]" />
              <span className="text-sm">Nema VP računa</span>
            </div>
          ) : (
            <table className="w-auto text-sm border-collapse">
              <thead>
                <tr className="text-white" style={{ background: VP_BOJA }}>
                  <th className={`${th} text-left`}>Broj računa</th>
                  <th className={`${th} text-left`}>Datum</th>
                  <th className={`${th} text-left`}>Partner</th>
                  <th className={`${th} text-right`}>UKUPNO</th>
                  <th className={`${th} text-left`}>Br. fiskalnog</th>
                  <th className={`${th} text-left`}>Datum fiskalnog</th>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r, i) => {
                  const imaFiskalni = imaVrijednost(r.br_fiskalnog);
                  const storniran = jeStorniran(r);
                  return (
                    <tr
                      key={r.sifra_tabele}
                      onClick={storniran ? undefined : () => otvoriModal(r)}
                      title={
                        storniran
                          ? "Račun je već storniran — ne može se ponovo stornirati"
                          : undefined
                      }
                      className={`border-b border-gray-100 dark:border-[#2a2340] transition-colors ${
                        storniran
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-500/15"
                      } ${
                        i % 2 === 0
                          ? "bg-white dark:bg-[#1a1528]"
                          : "bg-[#f3faf9] dark:bg-[#1e1a2d]"
                      }`}
                    >
                      <td
                        className={`px-4 py-2 font-semibold whitespace-nowrap ${
                          storniran
                            ? "text-red-500"
                            : "text-teal-700 dark:text-teal-400"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {storniran && <Lock size={13} className="flex-shrink-0" />}
                          {r.vrsta_racuna_novo ?? r.broj_racuna}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-[#c5bfd8] whitespace-nowrap">
                        {formatDatumDMY(r.datum_racuna)}
                      </td>
                      <td className="px-4 py-2 text-gray-800 dark:text-[#ede9f6]">
                        {r.naziv_partnera}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-[#ede9f6] whitespace-nowrap">
                        {Number(r.ukupno).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {imaFiskalni ? (
                          <span className="text-gray-600 dark:text-[#c5bfd8]">
                            {r.br_fiskalnog}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500 text-xs">
                            <AlertTriangle size={12} />
                            Nema fiskalnog
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-[#c5bfd8] whitespace-nowrap">
                        {imaFiskalni
                          ? formatDatumVrijemeDMY(r.datum_vreme_fiskalnog)
                          : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {odabraniRacun &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) zatvoriModal();
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border-2 w-[480px] max-h-[80vh] flex flex-col overflow-hidden"
              style={{ borderColor: storniranjeUspjeh ? ACCENT : DANGER }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: storniranjeUspjeh ? PRIMARY : DANGER }}
              >
                <AlertTriangle size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Storno računa{" "}
                    {odabraniRacun.vrsta_racuna_novo ?? odabraniRacun.broj_racuna}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabraniRacun.naziv_partnera}
                  </div>
                </div>
                <button
                  onClick={zatvoriModal}
                  disabled={storniranjeLoading}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-auto space-y-3">
                {storniranjeUspjeh ? (
                  <div className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeUspjeh}</span>
                  </div>
                ) : esirNedovrsen ? null : (
                  <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                    Da li ste sigurni da želite stornirati CIJELI račun br.{" "}
                    <strong>
                      {odabraniRacun.vrsta_racuna_novo ?? odabraniRacun.broj_racuna}
                    </strong>{" "}
                    od <strong>{formatDatumDMY(odabraniRacun.datum_racuna)}</strong>{" "}
                    (partner <strong>{odabraniRacun.naziv_partnera}</strong>, iznos{" "}
                    <strong>{Number(odabraniRacun.ukupno).toFixed(2)}</strong>)?
                    Djelimično storniranje nije moguće, a akcija se ne može
                    poništiti.
                  </p>
                )}

                {!storniranjeUspjeh && !imaVrijednost(odabraniRacun.br_fiskalnog) && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Ovaj račun nema broj fiskalnog računa — ESIR refundacija nije
                      moguća, pa se ne može ni stornirati.
                    </span>
                  </div>
                )}

                {!storniranjeUspjeh && vpcProvjera?.loading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#7d7498]">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    <span>Provjera VPC stavki u odnosu na trenutne cijene...</span>
                  </div>
                )}

                {!storniranjeUspjeh && vpcProvjera?.greska && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Provjera VPC nije urađena: {vpcProvjera.greska}
                    </span>
                  </div>
                )}

                {!storniranjeUspjeh &&
                  vpcProvjera &&
                  !vpcProvjera.loading &&
                  vpcProvjera.razlike.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>
                          Neslaganje VPC: {vpcProvjera.razlike.length}{" "}
                          {vpcProvjera.razlike.length === 1 ? "stavka ima" : "stavke imaju"}{" "}
                          drugačiju trenutnu VPC od one na računu. Storno vraća
                          robu na lager po količini, pa razlika u vrijednosti
                          zaliha neće biti poravnata.
                        </span>
                      </div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-left">
                            <th className="pr-2 font-semibold">Artikal</th>
                            <th className="px-2 font-semibold text-right">Kol.</th>
                            <th className="px-2 font-semibold text-right">VPC račun</th>
                            <th className="px-2 font-semibold text-right">VPC sada</th>
                            <th className="pl-2 font-semibold text-right">Razlika</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vpcProvjera.razlike.map((d) => (
                            <tr key={d.sifra_proizvoda}>
                              <td className="pr-2">{d.naziv_proizvoda}</td>
                              <td className="px-2 text-right">{d.kolicina}</td>
                              <td className="px-2 text-right">{d.vpcRacun.toFixed(2)}</td>
                              <td className="px-2 text-right">{d.vpcTrenutna.toFixed(2)}</td>
                              <td className="pl-2 text-right font-semibold">
                                {d.razlika.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-amber-200 dark:border-amber-500/30">
                            <td colSpan={4} className="pr-2 pt-1 font-semibold">
                              Ukupna razlika
                            </td>
                            <td className="pl-2 pt-1 text-right font-bold">
                              {round2(
                                vpcProvjera.razlike.reduce((z, d) => z + d.razlika, 0),
                              ).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {!esirNedovrsen && (
                        <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={nivelacijaZeljena}
                            disabled={storniranjeLoading}
                            onChange={(e) => setNivelacijaZeljena(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span className="font-semibold">
                            Nakon storna uradi nivelaciju razlike (VPC sa računa →
                            trenutna VPC, za vraćenu količinu)
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                {nivelacijaStatus?.loading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#7d7498]">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    <span>Nivelacija razlike VPC...</span>
                  </div>
                )}

                {nivelacijaStatus?.uspjeh && (
                  <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{nivelacijaStatus.uspjeh}</span>
                  </div>
                )}

                {nivelacijaStatus?.greska && (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        Storno je upisan, ali nivelacija razlike VPC nije urađena:{" "}
                        {nivelacijaStatus.greska}
                      </span>
                    </div>
                    {vpcProvjera && vpcProvjera.razlike.length > 0 && (
                      <button
                        onClick={() => void uradiNivelaciju(vpcProvjera.razlike)}
                        disabled={storniranjeLoading}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
                        style={{ background: VP_BOJA }}
                      >
                        Ponovi nivelaciju
                      </button>
                    )}
                  </div>
                )}

                {!storniranjeUspjeh && !esirNedovrsen && (
                  <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-[#7d7498] bg-gray-50 dark:bg-[#1e1a2d] rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Storno se upisuje u bazu i odmah se šalje ESIR refundacija
                      na kasu žiralni (isti sadržaj kao originalni fiskalni
                      račun).
                    </span>
                  </div>
                )}

                {storniranjeKorak && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#7d7498]">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    <span>{storniranjeKorak}</span>
                  </div>
                )}

                {storniranjeUpozorenje && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeUpozorenje}</span>
                  </div>
                )}

                {esirNedovrsen && !storniranjeLoading && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Ako zatvorite prozor bez ponovnog pokušaja, storno ostaje u
                      bazi bez fiskalnog broja.
                    </span>
                  </div>
                )}

                {storniranjeGreska && (
                  <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeGreska}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                {storniranjeUspjeh ? (
                  <button
                    onClick={zatvoriModal}
                    className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all"
                    style={{ background: PRIMARY }}
                  >
                    Zatvori
                  </button>
                ) : (
                  <>
                    <button
                      onClick={zatvoriModal}
                      disabled={storniranjeLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
                    >
                      {esirNedovrsen ? "Zatvori" : "Otkaži"}
                    </button>
                    {esirNedovrsen ? (
                      <button
                        onClick={handlePonoviEsir}
                        disabled={storniranjeLoading}
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60"
                        style={{ background: VP_BOJA }}
                      >
                        {storniranjeLoading && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        Ponovi ESIR refundaciju
                      </button>
                    ) : (
                      <button
                        onClick={handlePotvrdiStorno}
                        disabled={
                          storniranjeLoading ||
                          !imaVrijednost(odabraniRacun.br_fiskalnog)
                        }
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: DANGER }}
                      >
                        {storniranjeLoading && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        Potvrdi storno
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
