import { useState } from "react";
import { LogOut, Home } from "lucide-react";

interface DashboardProps {
  username: string;
  vrstaRadnika: number;
  onLogout: () => void;
}

type MenuSection = "pocetna" | null;

export function Dashboard({
  username,
  vrstaRadnika: _vrstaRadnika,
  onLogout,
}: DashboardProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>("pocetna");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#3B5998] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-wide">Kancelarija</span>
            <span className="text-blue-200 text-sm hidden md:inline">
              Karpas Ambalaže
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-100">
              Korisnik: <strong>{username}</strong>
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 px-3 py-2 rounded-lg text-sm transition"
            >
              <LogOut size={16} />
              Odjava
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 py-2 overflow-x-auto">
          <button
            onClick={() => setActiveSection("pocetna")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeSection === "pocetna"
                ? "bg-[#3B5998] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Home size={16} />
            Početna
          </button>
          {/* Ovdje dodati nove module po potrebi */}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeSection === "pocetna" && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Dobrodošli u Kancelariju
            </h2>
            <p className="text-gray-500">Odaberite modul iz navigacije.</p>
          </div>
        )}
      </main>
    </div>
  );
}
