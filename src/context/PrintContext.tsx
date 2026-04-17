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

export interface PrintJob {
  title: string;
  component: ReactNode;
  orientation?: "portrait" | "landscape";
}

interface PrintContextType {
  openPrint: (job: PrintJob) => void;
}

const PrintContext = createContext<PrintContextType>({ openPrint: () => {} });

export const usePrint = () => useContext(PrintContext);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "print-root";
    document.body.appendChild(el);
    printRootRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  return (
    <PrintContext.Provider value={{ openPrint: setJob }}>
      {children}
      {job &&
        ReactDOM.createPortal(
          <PrintModal job={job} onClose={() => setJob(null)} />,
          document.body,
        )}
      {job &&
        printRootRef.current &&
        ReactDOM.createPortal(job.component, printRootRef.current)}
    </PrintContext.Provider>
  );
}
