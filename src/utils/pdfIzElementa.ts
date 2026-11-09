import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const MM_TO_PX = 3.7795;

// Najveća visina jednog canvas-a — browseri imaju ograničenje (~32 767 px),
// a ogroman canvas zamrzava stranicu ("Page unresponsive").
const MAX_CANVAS_VISINA_PX = 16000;

// Od ovoliko strana dokument se smatra velikim: JPEG umjesto PNG-a i
// kreiranje u pozadini (modal se zatvara, operater radi dalje).
export const VELIKI_DOKUMENT_STRANA = 20;

export interface PdfOpcije {
  format: "A4" | "A5";
  orientation: "portrait" | "landscape";
  renderScale?: number;
  // Poziva se poslije svake iscrtane strane (za prikaz napretka).
  onNapredak?: (gotovo: number, ukupno: number) => void;
}

// Pravi PDF od HTML elementa. Dugi dokumenti se iscrtavaju u dijelovima od po
// nekoliko strana (umjesto jednog ogromnog canvas-a), uz kratku pauzu između
// dijelova da browser ostane responzivan.
export async function pdfIzElementa(
  izvor: HTMLElement,
  { format, orientation, renderScale = 2, onNapredak }: PdfOpcije,
): Promise<jsPDF> {
  const pageWidthMm =
    format === "A4"
      ? orientation === "portrait" ? 210 : 297
      : orientation === "portrait" ? 148 : 210;
  const pageHeightMm =
    format === "A4"
      ? orientation === "portrait" ? 297 : 210
      : orientation === "portrait" ? 210 : 148;
  const paperW = pageWidthMm * MM_TO_PX;
  const paperH = pageHeightMm * MM_TO_PX;

  const pdf = new jsPDF({ orientation, unit: "mm", format, compress: true });

  const ukupnaVisina = Math.max(izvor.scrollHeight, 1);
  const brojStrana = Math.max(1, Math.ceil(ukupnaVisina / paperH - 0.001));
  const stranaPoDijelu = Math.max(
    1,
    Math.floor(MAX_CANVAS_VISINA_PX / (paperH * renderScale)),
  );

  const pageHeightPx = Math.round(paperH * renderScale);

  // Veliki dokumenti: JPEG je višestruko brži od PNG-a (manje "Page
  // unresponsive"). Mali dokumenti ostaju PNG kao i do sada.
  const koristiJpeg = brojStrana > VELIKI_DOKUMENT_STRANA;

  let pageIndex = 0;
  for (let prva = 0; prva < brojStrana; prva += stranaPoDijelu) {
    const offsetPx = prva * paperH;
    const visinaDijela = Math.min(
      stranaPoDijelu * paperH,
      ukupnaVisina - offsetPx,
    );
    if (visinaDijela <= 0) break;

    const canvas = await html2canvas(izvor, {
      backgroundColor: "#ffffff",
      scale: renderScale,
      useCORS: true,
      logging: false,
      windowWidth: Math.ceil(paperW),
      // html2canvas x/y su pomak u odnosu na sam element (ne apsolutne
      // koordinate stranice) — sam dodaje poziciju elementa.
      x: 0,
      y: offsetPx,
      width: Math.ceil(paperW),
      height: Math.ceil(visinaDijela),
    });

    let iscrtano = 0;
    while (iscrtano < canvas.height - 1) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - iscrtano);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, sliceHeightPx);
        ctx.drawImage(
          canvas,
          0,
          iscrtano,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );
      }

      if (pageIndex > 0) pdf.addPage(format, orientation);
      pdf.addImage(
        koristiJpeg
          ? pageCanvas.toDataURL("image/jpeg", 0.92)
          : pageCanvas.toDataURL("image/png"),
        koristiJpeg ? "JPEG" : "PNG",
        0,
        0,
        pageWidthMm,
        (sliceHeightPx / pageHeightPx) * pageHeightMm,
        undefined,
        "FAST",
      );
      iscrtano += sliceHeightPx;
      pageIndex++;
      pageCanvas.width = 0;
      pageCanvas.height = 0;
      onNapredak?.(Math.min(pageIndex, brojStrana), brojStrana);

      // Kratka pauza poslije svake strane da browser ostane responzivan.
      await new Promise((r) => setTimeout(r, 0));
    }

    // Oslobodi memoriju i pusti browser da "diše" prije sljedećeg dijela.
    canvas.width = 0;
    canvas.height = 0;
    await new Promise((r) => setTimeout(r, 0));
  }

  return pdf;
}
