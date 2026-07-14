import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PrintModal } from "../print/PrintModal";
import {
  getAvailablePrinters,
  getPrintServiceStatus,
  sendPrintJob,
  bytesToBase64,
} from "../utils/printService";

export interface PrintJob {
  title: string;
  component: ReactNode;
  orientation?: "portrait" | "landscape";
  allowBrowserPrintFallback?: boolean;
  onPrint?: (options: {
    format: "A4" | "A5";
    orientation: "portrait" | "landscape";
  }) => Promise<void> | void;
}

export interface DirektnoStampajOpcije {
  printerName: string;
  format: "A4" | "A5";
  orientation?: "portrait" | "landscape";
  documentType?: string;
}

interface PrintContextType {
  openPrint: (job: PrintJob) => void;
  printers: string[];
  loadingPrinters: boolean;
  loadPrinters: () => Promise<void>;
  selectedPrinter: string;
  setSelectedPrinter: (name: string) => void;
  savePrinter: () => boolean;
  // Renderuje component off-screen i šalje ga direktno na print servis, bez
  // otvaranja PrintModal-a — koristi se za "Direktno" opciju (nema koraka da
  // korisnik klikne štampaj u modalu).
  printDirectly: (
    component: ReactNode,
    opcije: DirektnoStampajOpcije,
  ) => Promise<void>;
}

const PrintContext = createContext<PrintContextType>({
  openPrint: () => {},
  printers: [],
  loadingPrinters: false,
  loadPrinters: async () => {},
  selectedPrinter: "",
  setSelectedPrinter: () => {},
  savePrinter: () => false,
  printDirectly: async () => {},
});

export const usePrint = () => useContext(PrintContext);

const MM_TO_PX = 3.7795;

async function printDirectly(
  component: ReactNode,
  opcije: DirektnoStampajOpcije,
): Promise<void> {
  const {
    printerName,
    format,
    orientation = "portrait",
    documentType = "racun",
  } = opcije;

  if (!printerName.trim()) {
    throw new Error("Printer nije izabran.");
  }

  const status = await getPrintServiceStatus();
  if (!status.serviceActive || !status.pdfRendererActive) {
    throw new Error("Print servis nije aktivan.");
  }

  const pageWidthMm =
    format === "A4"
      ? orientation === "portrait"
        ? 210
        : 297
      : orientation === "portrait"
        ? 148
        : 210;
  const pageHeightMm =
    format === "A4"
      ? orientation === "portrait"
        ? 297
        : 210
      : orientation === "portrait"
        ? 210
        : 148;
  const paperW = pageWidthMm * MM_TO_PX;
  const paperH = pageHeightMm * MM_TO_PX;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${paperW}px`;
  container.style.background = "white";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    root.render(component);
    // Sačekaj da se sadržaj (i eventualne slike, npr. memorandum) renderuje.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const renderScale = 2;
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: renderScale,
      useCORS: true,
      logging: false,
      windowWidth: Math.ceil(paperW),
    });

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format,
      compress: true,
    });

    const pageHeightPx = Math.round(paperH * renderScale);
    const pageWidthPx = canvas.width;
    const totalHeightPx = canvas.height;

    let renderedHeightPx = 0;
    let pageIndex = 0;

    while (renderedHeightPx < totalHeightPx) {
      const sliceHeightPx = Math.min(
        pageHeightPx,
        totalHeightPx - renderedHeightPx,
      );

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = pageWidthPx;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageWidthPx, sliceHeightPx);
        ctx.drawImage(
          canvas,
          0,
          renderedHeightPx,
          pageWidthPx,
          sliceHeightPx,
          0,
          0,
          pageWidthPx,
          sliceHeightPx,
        );
      }

      if (pageIndex > 0) pdf.addPage(format, orientation);

      const sliceHeightMm = (sliceHeightPx / pageHeightPx) * pageHeightMm;
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pageWidthMm,
        sliceHeightMm,
        undefined,
        "FAST",
      );

      renderedHeightPx += sliceHeightPx;
      pageIndex++;
    }

    const documentBase64 = bytesToBase64(
      new Uint8Array(pdf.output("arraybuffer")),
    );

    await sendPrintJob({
      appId: "kancelarija-web",
      mode: "pdf",
      paperSize: format,
      orientation,
      printerName,
      copies: 1,
      documentType,
      documentBase64,
    });
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

export function PrintProvider({
  username,
  children,
}: {
  username?: string;
  children: ReactNode;
}) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const printerStorageKey = `printService.printer.${username || "default"}`;

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "print-root";
    document.body.appendChild(el);
    printRootRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const list = await getAvailablePrinters();
      setPrinters(list);
    } catch {
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const savePrinter = () => {
    const printer = selectedPrinter.trim();
    if (!printer) return false;
    localStorage.setItem(printerStorageKey, printer);
    return true;
  };

  useEffect(() => {
    const saved = localStorage.getItem(printerStorageKey);
    if (saved) setSelectedPrinter(saved);
    void loadPrinters();
  }, [printerStorageKey]);

  return (
    <PrintContext.Provider
      value={{
        openPrint: setJob,
        printers,
        loadingPrinters,
        loadPrinters,
        selectedPrinter,
        setSelectedPrinter,
        savePrinter,
        printDirectly,
      }}
    >
      {children}
      {job &&
        ReactDOM.createPortal(
          <PrintModal
            job={job}
            onClose={() => setJob(null)}
            printerName={selectedPrinter}
          />,
          document.body,
        )}
      {job &&
        printRootRef.current &&
        ReactDOM.createPortal(job.component, printRootRef.current)}
    </PrintContext.Provider>
  );
}
