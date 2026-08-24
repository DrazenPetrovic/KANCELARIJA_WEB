import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

// Osvježavanje statusa u pozadini — dovoljno često da meni (disable/enable
// stavke "Unos uplata/isplata") ne zaostaje predugo za stvarnim stanjem.
const POLL_MS = 20000;

export interface BlagajnaStanje {
  id: number;
  datum_otvaranja: string;
  pocetak_gotovine: number;
  datum_zatvaranja: string | null;
  kraj_gotovine_obracun: number | null;
  kraj_gotovine_stvarno: number | null;
  razlika: number | null;
  id_operatera_otvaranje: number | null;
  id_operatera_zatvaranje: number | null;
  status: "otvorena" | "zatvorena";
  naziv_operatera_otvaranje: string | null;
  naziv_operatera_zatvaranje: string | null;
  tekuce_uplate?: number;
  tekuce_isplate?: number;
  tekuci_obracun?: number;
}

interface BlagajnaContextType {
  // undefined = još nije učitano (prvi fetch u toku)
  stanje: BlagajnaStanje | null | undefined;
  loading: boolean;
  otvorena: boolean;
  refresh: () => Promise<void>;
}

const BlagajnaContext = createContext<BlagajnaContextType>({
  stanje: undefined,
  loading: true,
  otvorena: false,
  refresh: async () => {},
});

export const useBlagajna = () => useContext(BlagajnaContext);

export function BlagajnaProvider({ children }: { children: ReactNode }) {
  const [stanje, setStanje] = useState<BlagajnaStanje | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/blagajna/stanje`, {
        credentials: "include",
      });
      const d = await res.json();
      if (mountedRef.current) setStanje(d.success ? d.stanje : null);
    } catch {
      if (mountedRef.current) setStanje(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const intervalId = setInterval(() => void refresh(), POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <BlagajnaContext.Provider
      value={{
        stanje,
        loading,
        otvorena: stanje?.status === "otvorena",
        refresh,
      }}
    >
      {children}
    </BlagajnaContext.Provider>
  );
}
