export function getPrintServiceBaseUrl(): string {
  return "http://127.0.0.1:4567";
}

const PRINT_SERVICE_URL = getPrintServiceBaseUrl();

export type PrintMode = "pdf" | "text" | "raw";
export type PaperSize = "A4" | "A5";
export type Orientation = "portrait" | "landscape";

export interface PrintServiceRequest {
  appId: string;
  mode: PrintMode;
  paperSize: PaperSize;
  orientation: Orientation;
  printerName: string;
  copies: number;
  documentType: string;
  documentBase64: string;
}

export interface PrintServiceResponse {
  success?: boolean;
  ok?: boolean;
  jobId?: string;
  errorCode?: string;
  message?: string;
}

export interface PrintServiceStatus {
  serviceActive: boolean;
  pdfRendererActive: boolean;
  sumatraExists: boolean;
  hasDefaultPrinter: boolean;
  defaultPrinter: string;
  printers: string[];
  printerCount: number;
  checkedAt: string;
}

function normalizeResponse(data: unknown): PrintServiceResponse {
  if (!data || typeof data !== "object") return {};
  return data as PrintServiceResponse;
}

function readBool(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key] as boolean;
  }
  return false;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function readStringArray(
  record: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((x): x is string => typeof x === "string");
    }
  }
  return [];
}

function normalizeStatus(data: unknown): PrintServiceStatus {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  const serviceActive = readBool(record, [
    "serviceActive",
    "active",
    "isActive",
    "ok",
    "success",
  ]);

  const pdfRendererActive = readBool(record, [
    "pdfRendererActive",
    "rendererActive",
    "pdfRendererOk",
    "isPdfRendererActive",
  ]);

  const sumatraExists = readBool(record, [
    "sumatraExists",
    "sumatraInstalled",
    "hasSumatra",
    "sumatraPdfExists",
  ]);

  const hasDefaultPrinter = readBool(record, [
    "hasDefaultPrinter",
    "defaultPrinterExists",
    "defaultPrinterActive",
  ]);

  const defaultPrinter = readString(record, [
    "defaultPrinter",
    "defaultPrinterName",
    "printerDefault",
  ]);

  const printers = readStringArray(record, ["printers", "printerList"]);

  let printerCount = readNumber(record, [
    "printerCount",
    "printersCount",
    "numPrinters",
  ]);

  if (!printerCount && Array.isArray(record.printers)) {
    printerCount = record.printers.length;
  }

  const checkedAtRaw = readString(record, [
    "checkedAt",
    "lastCheckTime",
    "timestamp",
    "time",
    "checked_at",
  ]);

  const checkedAt = checkedAtRaw || new Date().toISOString();

  return {
    serviceActive,
    pdfRendererActive,
    sumatraExists,
    hasDefaultPrinter,
    defaultPrinter,
    printers,
    printerCount,
    checkedAt,
  };
}

export async function getPrintServiceStatus(): Promise<PrintServiceStatus> {
  const response = await fetch(`${PRINT_SERVICE_URL}/status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("PRINT_STATUS_ENDPOINT_FAILED");
  }

  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return normalizeStatus(data);
}

export async function getAvailablePrinters(): Promise<string[]> {
  const response = await fetch(`${PRINT_SERVICE_URL}/printers`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("PRINTERS_ENDPOINT_FAILED");
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data.filter((x) => typeof x === "string");
  }

  if (Array.isArray(data?.printers)) {
    return data.printers.filter((x: unknown) => typeof x === "string");
  }

  return [];
}

export async function sendPrintJob(
  payload: PrintServiceRequest,
): Promise<PrintServiceResponse> {
  const response = await fetch(`${PRINT_SERVICE_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data: PrintServiceResponse = {};
  try {
    data = normalizeResponse(await response.json());
  } catch {
    data = {};
  }

  if (!response.ok || data.success === false || data.ok === false) {
    throw {
      code: data.errorCode || "PRINT_FAILED",
      message: data.message || "Greška pri štampi",
    };
  }

  return data;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function mapPrintError(code?: string): string {
  switch (code) {
    case "PRINTER_NOT_FOUND":
      return "Printer nije izabran ili više ne postoji.";
    case "PDF_RENDERER_NOT_FOUND":
      return "SumatraPDF nije instaliran ili putanja nije tačna.";
    case "PRINT_TIMEOUT":
      return "Štampanje je zapelo (isteklo vrijeme čekanja).";
    case "INVALID_REQUEST":
      return "Polja za štampu nisu dobro popunjena.";
    default:
      return "Greška pri slanju na print servis.";
  }
}
