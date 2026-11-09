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
import { CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import { pdfIzElementa } from "../utils/pdfIzElementa";
import { PrintModal } from "../print/PrintModal";
import {
  getAvailablePrinters,
  getPrintServiceStatus,
  sendPrintJob,
  bytesToBase64,
  mapPrintError,
} from "../utils/printService";

// Veliki dokument se pretvara u PDF "u pozadini": modal se zatvori, a
// napredak se prikazuje u malom prozorčiću u uglu. html2canvas mora raditi na
// glavnoj niti, pa aplikacija može kratko zastati, ali operater radi dalje.
export interface PozadinskiPosao {
  naziv: string;
  component: ReactNode;
  format: "A4" | "A5";
  orientation: "portrait" | "landscape";
  akcija:
    | { tip: "pdf"; nazivFajla: string }
    | {
        tip: "stampa";
        printerName: string;
        copies: number;
        documentType: string;
      };
}

interface StanjePosla {
  id: number;
  naziv: string;
  tip: "pdf" | "stampa";
  gotovo: number;
  ukupno: number;
  status: "radi" | "gotovo" | "greska";
  poruka?: string;
}

export interface PrintJob {
  title: string;
  component: ReactNode;
  orientation?: "portrait" | "landscape";
  // Podrazumijevani format papira u PrintModal-u — bira se prema šablonu koji
  // se štampa (RacunA5 -> "A5", RacunA4 -> "A4"). Bez ovoga modal uvijek
  // kreće od "A4" bez obzira na stvarni šablon.
  format?: "A4" | "A5";
  allowBrowserPrintFallback?: boolean;
  // Broj fizičkih kopija koje se šalju print servisu (podrazumijevano 1).
  copies?: number;
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
  // Broj fizičkih kopija koje se šalju print servisu (podrazumijevano 1).
  copies?: number;
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
  pokreniUPozadini: (posao: PozadinskiPosao) => void;
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
  pokreniUPozadini: () => {},
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
    copies = 1,
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
  const paperW = pageWidthMm * MM_TO_PX;

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

    const pdf = await pdfIzElementa(container, { format, orientation });

    const documentBase64 = bytesToBase64(
      new Uint8Array(pdf.output("arraybuffer")),
    );

    await sendPrintJob({
      appId: "kancelarija-web",
      mode: "pdf",
      paperSize: format,
      orientation,
      printerName,
      copies,
      documentType,
      documentBase64,
    });
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

async function izvrsiPozadinskiPosao(
  posao: PozadinskiPosao,
  onNapredak: (gotovo: number, ukupno: number) => void,
): Promise<void> {
  const { component, format, orientation, akcija } = posao;

  const pageWidthMm =
    format === "A4"
      ? orientation === "portrait"
        ? 210
        : 297
      : orientation === "portrait"
        ? 148
        : 210;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${pageWidthMm * MM_TO_PX}px`;
  container.style.background = "white";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    root.render(component);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const pdf = await pdfIzElementa(container, {
      format,
      orientation,
      onNapredak,
    });

    if (akcija.tip === "pdf") {
      pdf.save(akcija.nazivFajla);
      return;
    }

    const documentBase64 = bytesToBase64(
      new Uint8Array(pdf.output("arraybuffer")),
    );
    await sendPrintJob({
      appId: "kancelarija-web",
      mode: "pdf",
      paperSize: format,
      orientation,
      printerName: akcija.printerName,
      copies: akcija.copies,
      documentType: akcija.documentType,
      documentBase64,
    });
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

function PozadinskiPosloviPrikaz({
  poslovi,
  onZatvori,
}: {
  poslovi: StanjePosla[];
  onZatvori: (id: number) => void;
}) {
  if (poslovi.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 w-72">
      {poslovi.map((p) => (
        <div
          key={p.id}
          className="rounded-xl shadow-lg border bg-white dark:bg-[#261f38] border-gray-200 dark:border-[#3a3158] p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            {p.status === "radi" && (
              <Loader2
                size={16}
                className="animate-spin mt-0.5 flex-shrink-0"
                style={{ color: "#785E9E" }}
              />
            )}
            {p.status === "gotovo" && (
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            )}
            {p.status === "greska" && (
              <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-700 dark:text-[#c5bfd8] truncate">
                {p.naziv}
              </p>
              <p className="text-xs text-gray-500 dark:text-[#7d7498]">
                {p.status === "radi" &&
                  `${p.tip === "pdf" ? "Kreiranje PDF-a" : "Priprema za štampu"}${
                    p.ukupno > 0 ? ` — ${p.gotovo}/${p.ukupno} str.` : "..."
                  }`}
                {p.status === "gotovo" &&
                  (p.tip === "pdf" ? "PDF sačuvan" : "Poslano na štampu")}
                {p.status === "greska" && (p.poruka || "Greška")}
              </p>
              {p.status === "radi" && p.ukupno > 0 && (
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-[#2d2648] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((p.gotovo / p.ukupno) * 100)}%`,
                      background: "#785E9E",
                    }}
                  />
                </div>
              )}
            </div>
            {p.status !== "radi" && (
              <button
                onClick={() => onZatvori(p.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[#c5bfd8]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
  const [poslovi, setPoslovi] = useState<StanjePosla[]>([]);
  const sljedeciIdRef = useRef(1);

  const zatvoriPosao = (id: number) =>
    setPoslovi((prev) => prev.filter((p) => p.id !== id));

  const azurirajPosao = (id: number, izmjena: Partial<StanjePosla>) =>
    setPoslovi((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...izmjena } : p)),
    );

  const pokreniUPozadini = (posao: PozadinskiPosao) => {
    const id = sljedeciIdRef.current++;
    setPoslovi((prev) => [
      ...prev,
      {
        id,
        naziv: posao.naziv,
        tip: posao.akcija.tip,
        gotovo: 0,
        ukupno: 0,
        status: "radi",
      },
    ]);

    // Pusti browser da zatvori modal i prikaže obavijest prije rada.
    setTimeout(() => {
      izvrsiPozadinskiPosao(posao, (gotovo, ukupno) =>
        azurirajPosao(id, { gotovo, ukupno }),
      )
        .then(() => {
          azurirajPosao(id, { status: "gotovo" });
          setTimeout(() => zatvoriPosao(id), 4000);
        })
        .catch((error: unknown) => {
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? String((error as { code: unknown }).code)
              : undefined;
          azurirajPosao(id, {
            status: "greska",
            poruka:
              posao.akcija.tip === "pdf"
                ? "Greška prilikom kreiranja PDF-a"
                : mapPrintError(code),
          });
        });
    }, 50);
  };

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
        pokreniUPozadini,
      }}
    >
      {children}
      {ReactDOM.createPortal(
        <PozadinskiPosloviPrikaz poslovi={poslovi} onZatvori={zatvoriPosao} />,
        document.body,
      )}
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
