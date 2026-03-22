import ReactDOM from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderArchive,
  LogOut,
  Settings,
  ShoppingCart,
} from "lucide-react";

const PRIMARY = "#785E9E";
const PRIMARY_DARK = "#604880";
const ACCENT = "#8FC74A";

interface DashboardProps {
  username: string;
  vrstaRadnika: number;
  onLogout: () => void;
}

type MenuSection =
  | "file-opcije"
  | "file-arhiva-2025"
  | "file-arhiva-2024"
  | "file-arhiva-2023"
  | "file-arhiva-2022"
  | "file-arhiva-2021"
  | "pregledi"
  | "narudzbe-pregled"
  | null;

export function Dashboard({
  username,
  vrstaRadnika,
  onLogout,
}: DashboardProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>(null);
  const [openMenu, setOpenMenu] = useState<"file" | "narudzbe" | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const narudzbeBtnRef = useRef<HTMLButtonElement>(null);
  const fileDropRef = useRef<HTMLDivElement>(null);
  const narudzbeDropRef = useRef<HTMLDivElement>(null);

  const isAdministrator = vrstaRadnika === 1;
  const isStandardUser = vrstaRadnika === 3;
  const roleLabel = isAdministrator ? "Administrator" : "Korisnik";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inFile =
        fileBtnRef.current?.contains(t) || fileDropRef.current?.contains(t);
      const inNarudzbe =
        narudzbeBtnRef.current?.contains(t) ||
        narudzbeDropRef.current?.contains(t);
      if (!inFile && !inNarudzbe) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleMenu = (menu: "file" | "narudzbe") => {
    const ref = menu === "file" ? fileBtnRef : narudzbeBtnRef;
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left });
    }
    setOpenMenu((prev) => (prev === menu ? null : menu));
    if (menu !== "file") setArchiveExpanded(false);
  };

  const handleSectionChange = (section: MenuSection) => {
    setActiveSection(section);
    setOpenMenu(null);
    setArchiveExpanded(false);
  };

  const navBtnActive = {
    background: PRIMARY,
    color: "#fff",
    borderColor: PRIMARY,
  } as React.CSSProperties;

  const navBtnBase =
    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 transition-all duration-150 whitespace-nowrap hover:border-[#785E9E] hover:text-[#785E9E] text-gray-600 bg-white";

  const dropdownItemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
      active ? "text-white" : "text-gray-700 hover:bg-purple-50"
    }`;

  return (
    <div className="min-h-screen" style={{ background: "#f4f1f9" }}>
      {/* Header */}
      <header style={{ background: PRIMARY }} className="text-white shadow-lg">
        <div className="mx-[15px] px-[5px] py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/foto/karpas_logo_software.png"
              alt="Karpas logo"
              className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <p className="text-lg font-bold leading-tight tracking-wide">
                Kancelarija
              </p>
              <p className="text-xs text-white/60 hidden sm:block">
                Karpas Ambalaže
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider">
                {roleLabel}
              </p>
              <p className="text-sm font-semibold">{username}</p>
            </div>
            <button
              onClick={onLogout}
              style={{ background: ACCENT }}
              className="flex items-center gap-2 hover:brightness-110 px-3 py-2 rounded-xl text-sm font-semibold transition-all shadow"
            >
              <LogOut size={15} />
              Odjava
            </button>
          </div>
        </div>

        {/* Accent stripe */}
        <div className="h-1" style={{ background: ACCENT }} />
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-100">
        <div className="mx-[5px] px-[5px] flex gap-2 py-3 items-center">
          {isStandardUser && (
            <>
              {/* FILE */}
              <div>
                <button
                  ref={fileBtnRef}
                  onClick={() => toggleMenu("file")}
                  className={navBtnBase}
                  style={
                    openMenu === "file" || activeSection?.startsWith("file-")
                      ? navBtnActive
                      : {}
                  }
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{
                      background:
                        openMenu === "file" ||
                        activeSection?.startsWith("file-")
                          ? "rgba(255,255,255,0.2)"
                          : "#ede8f5",
                    }}
                  >
                    <FileText
                      size={13}
                      style={{
                        color:
                          openMenu === "file" ||
                          activeSection?.startsWith("file-")
                            ? "#fff"
                            : PRIMARY,
                      }}
                    />
                  </span>
                  File
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "file" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "file" &&
                  ReactDOM.createPortal(
                    <div
                      ref={fileDropRef}
                      style={{
                        position: "fixed",
                        top: dropPos.top,
                        left: dropPos.left,
                        zIndex: 9999,
                      }}
                      className="w-52 rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
                    >
                      <div
                        className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2"
                        style={{ color: PRIMARY, background: "#f4f1f9" }}
                      >
                        <FileText size={12} />
                        File
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => handleSectionChange("file-opcije")}
                          className={dropdownItemClass(
                            activeSection === "file-opcije",
                          )}
                          style={
                            activeSection === "file-opcije"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
                            style={{
                              background:
                                activeSection === "file-opcije"
                                  ? "rgba(255,255,255,0.2)"
                                  : "#ede8f5",
                            }}
                          >
                            <Settings
                              size={13}
                              style={{
                                color:
                                  activeSection === "file-opcije"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Opcije
                        </button>

                        {/* Arhiva toggle */}
                        <button
                          onClick={() => setArchiveExpanded((p) => !p)}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-purple-50 transition-all"
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
                              style={{ background: "#edf7e0" }}
                            >
                              <FolderArchive
                                size={13}
                                style={{ color: ACCENT }}
                              />
                            </span>
                            Arhiva
                          </span>
                          <ChevronRight
                            size={14}
                            className={`transition-transform duration-200 text-gray-400 ${archiveExpanded ? "rotate-90" : ""}`}
                          />
                        </button>

                        {archiveExpanded && (
                          <div
                            className="ml-4 pl-3 space-y-0.5 border-l-2"
                            style={{ borderColor: ACCENT }}
                          >
                            {["2025", "2024", "2023", "2022", "2021"].map(
                              (year) => {
                                const val =
                                  `file-arhiva-${year}` as MenuSection;
                                const isActive = activeSection === val;
                                return (
                                  <button
                                    key={year}
                                    onClick={() => handleSectionChange(val)}
                                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                      isActive
                                        ? "font-bold"
                                        : "text-gray-600 hover:bg-purple-50"
                                    }`}
                                    style={isActive ? { color: PRIMARY } : {}}
                                  >
                                    <Calendar
                                      size={12}
                                      className="text-gray-400 flex-shrink-0"
                                    />
                                    {year}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              {/* PREGLEDI */}
              <button
                onClick={() => handleSectionChange("pregledi")}
                className={navBtnBase}
                style={activeSection === "pregledi" ? navBtnActive : {}}
              >
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-lg"
                  style={{
                    background:
                      activeSection === "pregledi"
                        ? "rgba(255,255,255,0.2)"
                        : "#ede8f5",
                  }}
                >
                  <BarChart2
                    size={13}
                    style={{
                      color: activeSection === "pregledi" ? "#fff" : PRIMARY,
                    }}
                  />
                </span>
                Pregledi
              </button>

              {/* NARUDZBE */}
              <div>
                <button
                  ref={narudzbeBtnRef}
                  onClick={() => toggleMenu("narudzbe")}
                  className={navBtnBase}
                  style={
                    openMenu === "narudzbe" ||
                    activeSection === "narudzbe-pregled"
                      ? navBtnActive
                      : {}
                  }
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{
                      background:
                        openMenu === "narudzbe" ||
                        activeSection === "narudzbe-pregled"
                          ? "rgba(255,255,255,0.2)"
                          : "#edf7e0",
                    }}
                  >
                    <ShoppingCart
                      size={13}
                      style={{
                        color:
                          openMenu === "narudzbe" ||
                          activeSection === "narudzbe-pregled"
                            ? "#fff"
                            : ACCENT,
                      }}
                    />
                  </span>
                  Narudžbe
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "narudzbe" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "narudzbe" &&
                  ReactDOM.createPortal(
                    <div
                      ref={narudzbeDropRef}
                      style={{
                        position: "fixed",
                        top: dropPos.top,
                        left: dropPos.left,
                        zIndex: 9999,
                      }}
                      className="w-52 rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
                    >
                      <div
                        className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2"
                        style={{ color: ACCENT, background: "#edf7e0" }}
                      >
                        <ShoppingCart size={12} />
                        Narudžbe
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() =>
                            handleSectionChange("narudzbe-pregled")
                          }
                          className={dropdownItemClass(
                            activeSection === "narudzbe-pregled",
                          )}
                          style={
                            activeSection === "narudzbe-pregled"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
                            style={{
                              background:
                                activeSection === "narudzbe-pregled"
                                  ? "rgba(255,255,255,0.2)"
                                  : "#edf7e0",
                            }}
                          >
                            <ShoppingCart
                              size={13}
                              style={{
                                color:
                                  activeSection === "narudzbe-pregled"
                                    ? "#fff"
                                    : ACCENT,
                              }}
                            />
                          </span>
                          Pregled narudžbi
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-[10px] px-[10px] py-8">
        {activeSection === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow"
              style={{ background: PRIMARY }}
            >
              <FileText size={28} className="text-white" />
            </div>
            <p className="text-gray-400 text-sm">Odaberite stavku iz menija.</p>
          </div>
        )}

        {activeSection === "file-opcije" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#ede8f5" }}
              >
                <Settings size={20} style={{ color: PRIMARY }} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Opcije</h2>
            </div>
            <p className="text-gray-500">Podešavanja modula File.</p>
          </div>
        )}

        {activeSection?.startsWith("file-arhiva-") && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#edf7e0" }}
              >
                <FolderArchive size={20} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Arhiva {activeSection.replace("file-arhiva-", "")}
              </h2>
            </div>
            <p className="text-gray-500">
              Pregled arhive za godinu{" "}
              <strong>{activeSection.replace("file-arhiva-", "")}</strong>.
            </p>
          </div>
        )}

        {activeSection === "pregledi" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#ede8f5" }}
              >
                <BarChart2 size={20} style={{ color: PRIMARY }} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Pregledi</h2>
            </div>
            <p className="text-gray-500">Prikazi i izvještaji.</p>
          </div>
        )}

        {activeSection === "narudzbe-pregled" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#edf7e0" }}
              >
                <ShoppingCart size={20} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Pregled narudžbi
              </h2>
            </div>
            <p className="text-gray-500">Sve narudžbe.</p>
          </div>
        )}
      </main>
    </div>
  );
}
