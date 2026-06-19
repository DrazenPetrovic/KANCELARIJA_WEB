import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import ReactDOM from "react-dom";
import { PrintModal } from "../print/PrintModal";
import { getAvailablePrinters } from "../utils/printService";

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

interface PrintContextType {
  openPrint: (job: PrintJob) => void;
  printers: string[];
  loadingPrinters: boolean;
  loadPrinters: () => Promise<void>;
  selectedPrinter: string;
  setSelectedPrinter: (name: string) => void;
  savePrinter: () => boolean;
}

const PrintContext = createContext<PrintContextType>({
  openPrint: () => {},
  printers: [],
  loadingPrinters: false,
  loadPrinters: async () => {},
  selectedPrinter: "",
  setSelectedPrinter: () => {},
  savePrinter: () => false,
});

export const usePrint = () => useContext(PrintContext);

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
