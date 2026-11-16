import { useState } from "react";
import { FilePlus, PackageCheck, Truck } from "lucide-react";
import { RadniNalogZatvoreni } from "./RadniNalogZatvoreni";

type Sekvenca = "unos" | "prenos" | "zatvoreni";

const SEKVENCE: {
  key: Sekvenca;
  label: string;
  icon: React.ReactNode;
  boja: string;
}[] = [
  { key: "unos", label: "Unos novog radnog naloga", icon: <FilePlus size={14} />, boja: "#0d9488" },
  { key: "prenos", label: "Prenos proizvoda", icon: <Truck size={14} />, boja: "#d97706" },
  { key: "zatvoreni", label: "Zatvoreni radni nalozi", icon: <PackageCheck size={14} />, boja: "#2563eb" },
];

export function RadniNalog() {
  const [aktivna, setAktivna] = useState<Sekvenca>("zatvoreni");

  return (
    <div className="space-y-4">
      {/* Sekvence */}
      <div className="flex flex-wrap justify-center gap-2">
        {SEKVENCE.map(({ key, label, icon, boja }) => {
          const isActive = aktivna === key;
          return (
            <button
              key={key}
              onClick={() => setAktivna(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                isActive
                  ? "text-white shadow-md"
                  : "text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] border-gray-200 dark:border-[#3a3158] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
              }`}
              style={isActive ? { background: boja, borderColor: boja } : {}}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>

      {aktivna === "zatvoreni" && <RadniNalogZatvoreni />}

      {aktivna !== "zatvoreni" && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm py-20 text-center text-sm text-gray-400 dark:text-[#5f5878]">
          U izradi.
        </div>
      )}
    </div>
  );
}
