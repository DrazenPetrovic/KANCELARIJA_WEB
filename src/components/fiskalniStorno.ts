// ESIR refundacija (storno) — dopuna za fiskalniRacuni.ts bez izmjene postojećih
// funkcija tamo. Refundacija po ESIR uputstvu ima ISTI sadržaj kao originalni
// račun, uz transactionType = "Refund" i referentDocumentNumber/DT originala.
// Zato se originalni invoiceRequest preuzima direktno sa ESIR-a (GET
// /api/invoices/:invoiceNumber vraća { invoiceRequest, invoiceResponse, ... }),
// umjesto da se rekonstruiše iz baze — stavke, oznake, GTIN, kupac i plaćanje
// su tako garantovano isti kao na originalu.

import {
  ESIR_INVOICE_TYPE,
  type EsirInvoiceRequest,
  type EsirInvoiceResponse,
  type EsirPlacanje,
  type EsirStavka,
  type EsirUredjaj,
} from "./fiskalniRacuni";

// Isti izvor konfiguracije kao ESIR_CONFIG u fiskalniRacuni.ts (tamo nije
// izvezen, a taj fajl se namjerno ne dira).
const ESIR_CONFIG: Record<EsirUredjaj, { baseUrl: string; apiKey: string }> = {
  gotovinski: {
    baseUrl: import.meta.env.VITE_ESIR_URL_GOTOVINSKI || "http://127.0.0.1:3566",
    apiKey: import.meta.env.VITE_ESIR_API_KEY_GOTOVINSKI || "",
  },
  ziralni: {
    baseUrl: import.meta.env.VITE_ESIR_URL_ZIRALNI || "http://127.0.0.1:3566",
    apiKey: import.meta.env.VITE_ESIR_API_KEY_ZIRALNI || "",
  },
};

export interface OriginalniFiskalniRacun {
  invoiceRequest: EsirInvoiceRequest;
  invoiceResponse: EsirInvoiceResponse;
}

// Preuzima i originalni zahtjev i odgovor za već fiskalizovan račun.
export async function preuzmiOriginalniFiskalniRacun(
  uredjaj: EsirUredjaj,
  invoiceNumber: string,
): Promise<OriginalniFiskalniRacun> {
  const { baseUrl, apiKey } = ESIR_CONFIG[uredjaj];
  const res = await fetch(
    `${baseUrl}/api/invoices/${encodeURIComponent(invoiceNumber)}`,
    { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const rawText = await res.text();
  if (!res.ok) {
    console.error("ESIR GET /api/invoices/:invoiceNumber (storno):", rawText);
    throw new Error(
      `ESIR nije vratio originalni fiskalni račun ${invoiceNumber} (HTTP ${res.status})${
        rawText.trim() ? `: ${rawText.trim().slice(0, 300)}` : ""
      }`,
    );
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }
  const invoiceRequest = parsed?.invoiceRequest as EsirInvoiceRequest | undefined;
  const invoiceResponse = parsed?.invoiceResponse as EsirInvoiceResponse | undefined;
  if (
    !invoiceRequest ||
    !Array.isArray(invoiceRequest.items) ||
    invoiceRequest.items.length === 0 ||
    !invoiceResponse ||
    typeof invoiceResponse.invoiceNumber !== "string"
  ) {
    throw new Error(
      `ESIR je vratio neočekivan oblik originalnog računa ${invoiceNumber} — refundacija nije moguća.`,
    );
  }
  return { invoiceRequest, invoiceResponse };
}

// Sastavlja zahtjev za refundaciju od originalnog zahtjeva: isti kupac, stavke
// i plaćanje (pozitivne količine/iznosi, kao u ESIR primjeru), transactionType
// "Refund" i reference na original. invoiceType prati VITE_ESIR_INVOICE_TYPE
// kao i svi ostali pozivi u aplikaciji (Training u razvoju, Normal u produkciji).
export function pripremiRefundZahtjev(
  original: OriginalniFiskalniRacun,
  cashier: string,
): EsirInvoiceRequest {
  const o = original.invoiceRequest;
  const items: EsirStavka[] = o.items.map((s) => ({
    name: s.name,
    gtin: s.gtin,
    labels: s.labels,
    totalAmount: s.totalAmount,
    unitPrice: s.unitPrice,
    quantity: s.quantity,
    ...(s.discount !== undefined ? { discount: s.discount } : {}),
    ...(s.discountAmount !== undefined ? { discountAmount: s.discountAmount } : {}),
  }));
  const payment: EsirPlacanje[] =
    Array.isArray(o.payment) && o.payment.length > 0
      ? o.payment.map((p) => ({ amount: p.amount, paymentType: p.paymentType }))
      : [
          {
            amount:
              Math.round(
                items.reduce((z, s) => z + (Number(s.totalAmount) || 0), 0) * 100,
              ) / 100,
            paymentType: "Cash",
          },
        ];
  return {
    invoiceType: ESIR_INVOICE_TYPE,
    transactionType: "Refund",
    referentDocumentNumber: original.invoiceResponse.invoiceNumber,
    referentDocumentDT: original.invoiceResponse.sdcDateTime,
    ...(o.buyerId ? { buyerId: o.buyerId } : {}),
    ...(o.buyerCostCenterId ? { buyerCostCenterId: o.buyerCostCenterId } : {}),
    payment,
    items,
    cashier,
  };
}
