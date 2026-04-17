import { createContext, useContext } from "react";

interface BazaContextType {
  isArhiva: boolean;
  godina: string | null;
}

export const BazaContext = createContext<BazaContextType>({
  isArhiva: false,
  godina: null,
});

export const useBaza = () => useContext(BazaContext);
