// Klijent za ESIR (napredni ESIR sertifikovan od PURS-a) — HTTP REST JSON API na portu 3566.
// Poziva se direktno iz komponenti (GotovinskiRacuni, ZiralniRacuni), ne preko backend servera,
// jer je ESIR/LPFR dostupan samo na lokalnoj mreži gdje je fiskalni uređaj povezan.

export type EsirUredjaj = "gotovinski" | "ziralni";

interface EsirConfig {
  baseUrl: string;
  apiKey: string;
}

// Dva fiskalna uređaja (različite IP adrese) — Gotovinski i Žiralni računi svaki ima svoj.
const ESIR_CONFIG: Record<EsirUredjaj, EsirConfig> = {
  gotovinski: {
    baseUrl: import.meta.env.VITE_ESIR_URL_GOTOVINSKI || "http://127.0.0.1:3566",
    apiKey: import.meta.env.VITE_ESIR_API_KEY_GOTOVINSKI || "",
  },
  ziralni: {
    baseUrl: import.meta.env.VITE_ESIR_URL_ZIRALNI || "http://127.0.0.1:3566",
    apiKey: import.meta.env.VITE_ESIR_API_KEY_ZIRALNI || "",
  },
};

async function esirFetch(uredjaj: EsirUredjaj, path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, apiKey } = ESIR_CONFIG[uredjaj];
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=UTF-8");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

// ---------------------------------------------------------------------------
// GET /api/attention — provjera dostupnosti ESIR-a/PFR-a i ispravnosti API ključa
// ---------------------------------------------------------------------------

export async function proveriDostupnostEsira(uredjaj: EsirUredjaj): Promise<boolean> {
  try {
    const res = await esirFetch(uredjaj, "/api/attention", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

interface CekajDostupnostOpcije {
  intervalMs?: number;
  signal?: AbortSignal;
  onPokusaj?: (uspjesno: boolean) => void;
}

// Prema uputstvu: ponavljati provjeru bez ograničenja dok ESIR ne postane dostupan.
export async function cekajDostupnostEsira(
  uredjaj: EsirUredjaj,
  opcije: CekajDostupnostOpcije = {},
): Promise<void> {
  const { intervalMs = 3000, signal, onPokusaj } = opcije;
  for (;;) {
    if (signal?.aborted) throw new DOMException("Prekinuto", "AbortError");
    const dostupan = await proveriDostupnostEsira(uredjaj);
    onPokusaj?.(dostupan);
    if (dostupan) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// GET /api/status — status PFR-a (LPFR ili VPFR)
// ---------------------------------------------------------------------------

export interface EsirTaxRate {
  label: string;
  rate: number;
}

export interface EsirTaxCategory {
  categoryType: number;
  name: string;
  orderId: number;
  taxRates: EsirTaxRate[];
}

export interface EsirTaxGroup {
  groupId: number;
  taxCategories: EsirTaxCategory[];
  validFrom: string;
}

export interface EsirStatus {
  sdcDateTime: string;
  gsc?: string[];
  mssc?: string[];
  uid?: string;
  deviceSerialNumber: string;
  lastInvoiceNumber?: string;
  make: string;
  model: string;
  hardwareVersion: string;
  softwareVersion: string;
  protocolVersion: string;
  supportedLanguages: string[];
  allTaxRates: EsirTaxGroup[];
  currentTaxRates: EsirTaxGroup;
}

export async function preuzmiStatusEsira(uredjaj: EsirUredjaj): Promise<EsirStatus> {
  const res = await esirFetch(uredjaj, "/api/status", { method: "GET" });
  if (!res.ok) throw new Error(`Greška pri čitanju statusa ESIR-a (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/pin — otključavanje bezbjednosnog elementa unosom PIN-a
// ---------------------------------------------------------------------------

export type PinStatusKod = "0100" | "1300" | "2400" | "2800" | "2806";

export const PIN_STATUS_PORUKE: Record<PinStatusKod, string> = {
  "0100": "PIN je ispravno unet",
  "1300": "Bezbjednosni element nije prisutan",
  "2400": "LPFR nije spreman",
  "2800": "Pogrešan format PIN-a (očekivano 4 cifre)",
  "2806": "Pogrešan format PIN-a (očekivano 4 cifre)",
};

export interface UnosPinRezultat {
  uspjesno: boolean;
  kod: string;
  poruka: string;
}

export async function unesiPinEsira(uredjaj: EsirUredjaj, pin: string): Promise<UnosPinRezultat> {
  // Dokumentacija najavljuje text/plain, ali primjer zahtjeva šalje sirov tekst (bez navodnika) uz Content-Type: application/json — pratimo primjer.
  const res = await esirFetch(uredjaj, "/api/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: pin,
  });
  let kod: string;
  try {
    kod = await res.json();
  } catch {
    kod = String(res.status);
  }
  return {
    uspjesno: kod === "0100",
    kod,
    poruka: PIN_STATUS_PORUKE[kod as PinStatusKod] ?? `Nepoznat status kod (${kod})`,
  };
}

// ---------------------------------------------------------------------------
// POST /api/invoices — izdavanje fiskalnog (gotovinskog) računa
// ---------------------------------------------------------------------------

// VAŽNO: ovo su ćirilična slova (Е = U+0415 Cyrillic Ie, К = U+041A Cyrillic Ka),
// vizuelno identična latiničnim "E"/"K" ali to NIJE isti karakter — ne zamijeniti kod kucanja/kopiranja.
export const ESIR_OZNAKA_SA_PDV = "Е"; // PDV se obračunava na proizvod
export const ESIR_OZNAKA_BEZ_PDV = "К"; // PDV se NE obračunava na proizvod

export interface EsirStavka {
  name: string;
  // Obavezno pri fiskalizaciji — dužina 8 do 14 znakova.
  gtin: string;
  // Oznake poreskih kategorija stavke — ESIR_OZNAKA_SA_PDV ("Е") ili ESIR_OZNAKA_BEZ_PDV ("К").
  labels: string[];
  totalAmount: number;
  unitPrice: number;
  quantity: number;
  discount?: number;
  discountAmount?: number;
}

export interface EsirPlacanje {
  amount: number;
  paymentType: string;
}

export interface EsirInvoiceRequest {
  invoiceType: string;
  transactionType: string;
  // Referenca na originalni dokument — samo za storno/refundaciju, inače null.
  referentDocumentNumber?: string | null;
  referentDocumentDT?: string | null;
  // Dodatna polja za "gotovinski račun sa identifikacijom kupca":
  buyerId?: string;
  buyerCostCenterId?: string;
  payment: EsirPlacanje[];
  items: EsirStavka[];
  cashier: string;
}

// Opcije štampe/prikaza — idu kao sestrinska polja uz "invoiceRequest" u tijelu
// zahtjeva (NE unutar njega). Vidi ESIR_SLIP_PRESET_58MM / _80MM za receiptSlip* vrijednosti.
export interface EsirOpcijeStampe {
  print?: boolean;
  renderReceiptImage?: boolean;
  receiptLayout?: "Slip" | "Invoice";
  receiptImageFormat?: "Png" | "Pdf";
  receiptSlipWidth?: number;
  receiptSlipFontSizeNormal?: number;
  receiptSlipFontSizeLarge?: number;
}

// Preporučene vrijednosti iz dokumentacije za format isečka (Slip).
export const ESIR_SLIP_PRESET_58MM = {
  receiptSlipWidth: 386,
  receiptSlipFontSizeNormal: 23,
  receiptSlipFontSizeLarge: 27,
} as const;

export const ESIR_SLIP_PRESET_80MM = {
  receiptSlipWidth: 576,
  receiptSlipFontSizeNormal: 25,
  receiptSlipFontSizeLarge: 30,
} as const;

export interface EsirTaxItem {
  amount: number;
  categoryName: string;
  categoryType: number;
  label: string;
  rate: number;
}

export interface EsirInvoiceResponse {
  address: string;
  businessName: string;
  district: string;
  encryptedInternalData: string;
  invoiceCounter: string;
  invoiceCounterExtension: string;
  // Jedino ispravno za štampu — journal se NE smije štampati.
  invoiceImageHtml: string | null;
  invoiceImagePdfBase64: string | null;
  invoiceImagePngBase64: string | null;
  invoiceNumber: string;
  journal: string;
  locationName: string;
  messages: string;
  mrc: string;
  requestedBy: string;
  sdcDateTime: string;
  signature: string;
  signedBy: string;
  taxGroupRevision: number;
  taxItems: EsirTaxItem[];
  tin: string;
  totalAmount: number;
  totalCounter: number;
  transactionTypeCounter: number;
  verificationQRCode: string;
  verificationUrl: string;
}

// Polja iz ESIR odgovora koja treba upisati u već sačuvan račun (br_fiskalnog /
// datum_vreme_fiskalnog) — procedura za taj update na backend-u još ne postoji,
// ovo samo priprema podatke da budu spremni čim procedura bude gotova.
export interface FiskalniPodaciZaRacun {
  brFiskalnog: string;
  datumVremeFiskalnog: string;
}

export function izdvojiFiskalnePodatke(
  odgovor: EsirInvoiceResponse,
): FiskalniPodaciZaRacun {
  return {
    brFiskalnog: odgovor.invoiceNumber,
    datumVremeFiskalnog: odgovor.sdcDateTime,
  };
}

function generisiRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}

// Izdvaja poruku greške iz odgovora ESIR-a — pokriva i standardni .NET
// ValidationProblemDetails oblik ({ title, errors: { Polje: ["greška"] } }),
// ne samo ravno { message } / { messages }.
function izdvojiEsirGresku(rawText: string, status: number): string {
  let json: unknown = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // Odgovor nije JSON — prikaži sirov tekst (ako postoji).
    return rawText.trim() || `Greška pri fiskalizaciji računa (${status})`;
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;

    if (typeof obj.messages === "string") return obj.messages;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.detail === "string") return obj.detail;

    // .NET ValidationProblemDetails: { title, errors: { Polje: ["poruka", ...] } }
    if (obj.errors && typeof obj.errors === "object") {
      const detalji = Object.entries(
        obj.errors as Record<string, unknown>,
      ).map(([polje, poruke]) => {
        const spisak = Array.isArray(poruke) ? poruke.join("; ") : String(poruke);
        return `${polje}: ${spisak}`;
      });
      const naslov = typeof obj.title === "string" ? `${obj.title} — ` : "";
      if (detalji.length > 0) return `${naslov}${detalji.join(" | ")}`;
    }

    if (typeof obj.title === "string") return obj.title;
  }

  return rawText.trim() || `Greška pri fiskalizaciji računa (${status})`;
}

export interface EsirFiskalizacijaRezultat {
  invoiceResponse: EsirInvoiceResponse;
  // Fiskalizacija je uspjela (imamo validan invoiceResponse), ali uređaj je
  // uz to prijavio problem koji NIJE vezan za samu fiskalizaciju — npr. lokalni
  // štampač nije uspio da odštampa paragon ("Printer error: ... printInit
  // failed"). U tom slučaju ESIR vraća HTTP grešku sa oblikom
  // { message, statusCode, invoiceResponse: {...} } umjesto ravnog objekta.
  // Ovo polje nosi tu poruku da operater zna da paragon možda nije odštampan,
  // iako je račun ispravno fiskalizovan.
  upozorenje: string | null;
}

// Iz sirovog (parsiranog) JSON odgovora izdvaja stvarni invoiceResponse — bilo
// da je odgovor RAVAN (normalan uspješan slučaj, cijeli objekat JE
// invoiceResponse) ili OMOTAN (npr. { message, statusCode, invoiceResponse }
// kod greške štampača dok je fiskalizacija ipak prošla).
function izdvojiInvoiceResponse(parsed: unknown): {
  invoiceResponse: EsirInvoiceResponse | null;
  poruka: string | null;
} {
  if (!parsed || typeof parsed !== "object") {
    return { invoiceResponse: null, poruka: null };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.invoiceResponse && typeof obj.invoiceResponse === "object") {
    const ugnijezdjeno = obj.invoiceResponse as Record<string, unknown>;
    if (typeof ugnijezdjeno.invoiceNumber === "string") {
      const poruka = typeof obj.message === "string" ? obj.message : null;
      return {
        invoiceResponse: ugnijezdjeno as unknown as EsirInvoiceResponse,
        poruka,
      };
    }
  }

  if (typeof obj.invoiceNumber === "string") {
    return { invoiceResponse: obj as unknown as EsirInvoiceResponse, poruka: null };
  }

  return { invoiceResponse: null, poruka: null };
}

// requestId — po preporuci treba biti sifra_tabele računa (dodijeljena tek kad
// se račun uspješno sačuva u bazu), ne slučajan UUID: tako je zahtjev prirodno
// idempotentan po računu (ponovni pokušaj za isti račun šalje isti RequestId,
// pa ga ESIR prepoznaje kao istu transakciju umjesto duplikata). Ako
// sifra_tabele još nije poznata (npr. debug test prije čuvanja), generiše se
// nasumičan UUID kao fallback.
export async function izdajFiskalniRacun(
  uredjaj: EsirUredjaj,
  invoiceRequest: EsirInvoiceRequest,
  opcijeStampe: EsirOpcijeStampe = {},
  requestId?: string,
): Promise<EsirFiskalizacijaRezultat> {
  const res = await esirFetch(uredjaj, "/api/invoices", {
    method: "POST",
    headers: { RequestId: requestId || generisiRequestId() },
    body: JSON.stringify({ ...opcijeStampe, invoiceRequest }),
  });
  const rawText = await res.text();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  const { invoiceResponse, poruka } = izdvojiInvoiceResponse(parsed);

  // Fiskalizacija je uspjela (imamo invoiceResponse sa invoiceNumber) čak i ako
  // je HTTP status "neuspješan" (npr. zbog greške štampača) — greška štampača
  // NIJE isto što i neuspjela fiskalizacija.
  if (invoiceResponse) {
    return { invoiceResponse, upozorenje: poruka };
  }

  console.error("ESIR /api/invoices — sirov odgovor greške:", rawText);
  throw new Error(izdvojiEsirGresku(rawText, res.status));
}

export interface EsirSirovOdgovor {
  status: number;
  ok: boolean;
  rawText: string;
}

// Privremeno (debug) — šalje isti zahtjev kao izdajFiskalniRacun, ali NE baca
// grešku i vraća sirov (neobrađen) tekst odgovora bez obzira na status, da bi
// se tačan odgovor uređaja mogao prikazati korisniku (npr. u debug modalu),
// isto ono što bi se vidjelo u Postman-u.
export async function posaljiEsirDebugZahtjev(
  uredjaj: EsirUredjaj,
  invoiceRequest: EsirInvoiceRequest,
  opcijeStampe: EsirOpcijeStampe = {},
  requestId?: string,
): Promise<EsirSirovOdgovor> {
  const res = await esirFetch(uredjaj, "/api/invoices", {
    method: "POST",
    headers: { RequestId: requestId || generisiRequestId() },
    body: JSON.stringify({ ...opcijeStampe, invoiceRequest }),
  });
  const rawText = await res.text();
  return { status: res.status, ok: res.ok, rawText };
}

// ---------------------------------------------------------------------------
// GET /api/invoices/request/:requestId — provjera da li je fiskalizacija za dati
// RequestId (isti koji je poslat u headeru prilikom /api/invoices poziva)
// stvarno izvršena. Koristi se kad zahtjev za fiskalizaciju ne dobije odgovor
// (mrežni problem/timeout), da se izbjegne duplirana fiskalizacija istog
// računa — ako je fiskalizacija uspjela, vraća kompletan sadržaj računa; ako
// nije, vraća null (prazan odgovor). Napomena: moguće provjeriti samo
// posljednjih 100 zahtjeva.
// ---------------------------------------------------------------------------

export async function proveriFiskalizacijuPoRequestId(
  uredjaj: EsirUredjaj,
  requestId: string,
): Promise<EsirInvoiceResponse | null> {
  const res = await esirFetch(
    uredjaj,
    `/api/invoices/request/${encodeURIComponent(requestId)}`,
    { method: "GET" },
  );
  const rawText = await res.text();
  if (!res.ok) {
    console.error(
      "ESIR /api/invoices/request — sirov odgovor greške:",
      rawText,
    );
    throw new Error(izdvojiEsirGresku(rawText, res.status));
  }
  if (!rawText.trim()) return null;
  return JSON.parse(rawText) as EsirInvoiceResponse;
}
