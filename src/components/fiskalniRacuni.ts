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
}

export interface EsirPlacanje {
  amount: number;
  paymentType: string;
}

export interface EsirInvoiceRequest {
  invoiceType: string;
  transactionType: string;
  // Dodatna polja za "gotovinski račun sa identifikacijom kupca":
  buyerId?: string;
  buyerCostCenterId?: string;
  payment: EsirPlacanje[];
  items: EsirStavka[];
  cashier: string;
  // Štampa na drugom (ne-integrisanom) štampaču — vidi ESIR_SLIP_PRESET_58MM / _80MM za receiptSlip* vrijednosti.
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

function generisiRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}

export async function izdajFiskalniRacun(
  uredjaj: EsirUredjaj,
  invoiceRequest: EsirInvoiceRequest,
): Promise<EsirInvoiceResponse> {
  const res = await esirFetch(uredjaj, "/api/invoices", {
    method: "POST",
    headers: { RequestId: generisiRequestId() },
    body: JSON.stringify({ invoiceRequest }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const poruka =
      (json && (json.messages || json.message)) ||
      `Greška pri fiskalizaciji računa (${res.status})`;
    throw new Error(poruka);
  }
  return json as EsirInvoiceResponse;
}
