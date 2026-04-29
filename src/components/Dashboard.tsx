import ReactDOM from "react-dom";
import { KlisePregled } from "./KlisePregled";
import { KliseNaplataOdKupca } from "./KliseNaplataOdKupca";
import { KliseUnosNovog } from "./KliseUnosNovog";
import { KliseUnosZaDobavljaca } from "./KliseUnosZaDobavljaca";
import { OrdersList } from "./OrdersList.tsx";
import { NarudzbeUnosTeren } from "./NarudzbeUnosTeren";
import { NarudzbeUnosLokalno } from "./NarudzbeUnosLokalno";
import { useEffect, useRef, useState } from "react";
import { BazaContext } from "../context/BazaContext";
import { useTheme } from "../context/ThemeContext";
import {
  BarChart2,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Eye,
  Factory,
  FilePlus,
  FileText,
  FolderArchive,
  Layers,
  LogOut,
  MapPin,
  Moon,
  PenLine,
  Receipt,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
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
  | "pregledi-racuna"
  | "pregled-kalkulacija"
  | "narudzbe-pregled"
  | "narudzbe-teren"
  | "narudzbe-lokalno"
  | "klise-unos"
  | "klise-naplata"
  | "klise-dobavljac"
  | "klise-pregled"
  | null;

export function Dashboard({
  username,
  vrstaRadnika,
  onLogout,
}: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<MenuSection>(null);
  const [openMenu, setOpenMenu] = useState<
    "file" | "pregledi" | "narudzbe" | "proizvodnja" | null
  >(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [kliseExpanded, setKliseExpanded] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [hoveredBtn, setHoveredBtn] = useState<
    "file" | "pregledi" | "narudzbe" | "proizvodnja" | null
  >(null);

  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const preglediBtnRef = useRef<HTMLButtonElement>(null);
  const narudzbeBtnRef = useRef<HTMLButtonElement>(null);
  const proizvodnjaBtnRef = useRef<HTMLButtonElement>(null);
  const fileDropRef = useRef<HTMLDivElement>(null);
  const preglediDropRef = useRef<HTMLDivElement>(null);
  const narudzbeDropRef = useRef<HTMLDivElement>(null);
  const proizvodnjaDrop = useRef<HTMLDivElement>(null);

  const isAdministrator = vrstaRadnika === 1;
  const isStandardUser = vrstaRadnika === 3;
  const roleLabel = isAdministrator ? "Administrator" : "Korisnik";

  const bazaLabel = activeSection?.startsWith("file-arhiva-")
    ? `žiralni ${activeSection.replace("file-arhiva-", "")}`
    : "žiralni";

  const isArhiva = activeSection?.startsWith("file-arhiva-") ?? false;
  const aktivnaGodina = isArhiva
    ? activeSection!.replace("file-arhiva-", "")
    : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inFile =
        fileBtnRef.current?.contains(t) || fileDropRef.current?.contains(t);
      const inPregledi =
        preglediBtnRef.current?.contains(t) ||
        preglediDropRef.current?.contains(t);
      const inNarudzbe =
        narudzbeBtnRef.current?.contains(t) ||
        narudzbeDropRef.current?.contains(t);
      const inProizvodnja =
        proizvodnjaBtnRef.current?.contains(t) ||
        proizvodnjaDrop.current?.contains(t);
      if (!inFile && !inPregledi && !inNarudzbe && !inProizvodnja)
        setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleMenu = (
    menu: "file" | "pregledi" | "narudzbe" | "proizvodnja",
  ) => {
    const ref =
      menu === "file"
        ? fileBtnRef
        : menu === "pregledi"
          ? preglediBtnRef
          : menu === "narudzbe"
            ? narudzbeBtnRef
            : proizvodnjaBtnRef;
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left });
    }
    setOpenMenu((prev) => (prev === menu ? null : menu));
    if (menu !== "file") setArchiveExpanded(false);
    if (menu !== "proizvodnja") setKliseExpanded(false);
  };

  const handleSectionChange = (section: MenuSection) => {
    setActiveSection(section);
    setOpenMenu(null);
    setArchiveExpanded(false);
    setKliseExpanded(false);
  };

  const navBtnStyle = (
    menu: "file" | "pregledi" | "narudzbe" | "proizvodnja",
    isActive: boolean,
  ): React.CSSProperties => ({
    background: isActive || hoveredBtn === menu ? ACCENT : PRIMARY,
    borderColor: ACCENT,
    color: "#fff",
  });

  const navBtnBase =
    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 whitespace-nowrap";

  const dropdownItemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
      active
        ? "text-white"
        : "text-gray-700 dark:text-[#c5bfd8] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
    }`;

  const dropBg =
    "bg-white dark:bg-[#261f38] border-gray-100 dark:border-[#2d2648]";
  const dropStripeBg = "bg-[#f4f1f9] dark:bg-[#2a2340]";

  return (
    <div className="min-h-screen bg-[#f4f1f9] dark:bg-[#1c1828]">
      {/* Header */}
      <header style={{ background: PRIMARY }} className="text-white shadow-lg">
        <div className="mx-[15px] px-[5px] py-3 flex items-center justify-between relative">
          <button
            onClick={() => handleSectionChange(null)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            title="Početna strana"
          >
            <img
              src="/foto/karpas_logo_software.png"
              alt="Karpas logo"
              className="h-10 w-10 object-contain rounded-lg bg-white/40 p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <p
              className="text-lg font-bold leading-tight tracking-wide"
              style={{ color: ACCENT }}
            >
              Kancelarija
            </p>
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center">
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">
              Rad u bazi podataka
            </p>
            <p
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: ACCENT }}
            >
              {bazaLabel}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wider">
                {roleLabel}:
              </p>
              <p
                className="text-sm font-semibold uppercase"
                style={{ color: ACCENT }}
              >
                {username}
              </p>
            </div>
            <button
              onClick={onLogout}
              style={{ background: PRIMARY_DARK }}
              className="flex items-center gap-2 hover:brightness-110 px-3 py-2 rounded-xl text-sm font-semibold transition-all shadow"
            >
              <LogOut size={15} />
              Odjava
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title={theme === "dark" ? "Svjetla tema" : "Tamna tema"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Accent stripe */}
        <div className="h-1" style={{ background: ACCENT }} />
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-[#1e1730] shadow-sm border-b border-gray-100 dark:border-[#2d2648]">
        <div className="mx-[5px] px-[5px] flex gap-2 py-3 items-center justify-center">
          {isStandardUser && (
            <>
              {/* FILE */}
              <div>
                <button
                  ref={fileBtnRef}
                  onClick={() => toggleMenu("file")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "file",
                    !!(
                      openMenu === "file" || activeSection?.startsWith("file-")
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("file")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <FileText size={13} style={{ color: "#111" }} />
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
                      className={`w-52 rounded-2xl border ${dropBg} shadow-2xl overflow-hidden`}
                    >
                      <div
                        className={`px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2 ${dropStripeBg}`}
                        style={{ color: PRIMARY }}
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
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                              activeSection === "file-opcije"
                                ? ""
                                : "bg-[#ede8f5] dark:bg-[#312a50]"
                            }`}
                            style={
                              activeSection === "file-opcije"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
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
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#c5bfd8] hover:bg-purple-50 dark:hover:bg-[#2d2648] transition-all"
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 bg-[#edf7e0] dark:bg-[#1a2c12]">
                              <FolderArchive
                                size={13}
                                style={{ color: ACCENT }}
                              />
                            </span>
                            Arhiva
                          </span>
                          <ChevronRight
                            size={14}
                            className={`transition-transform duration-200 text-gray-400 dark:text-[#5f5878] ${archiveExpanded ? "rotate-90" : ""}`}
                          />
                        </button>

                        {archiveExpanded && (
                          <div
                            className="ml-4 pl-3 space-y-0.5 border-l-2"
                            style={{ borderColor: ACCENT }}
                          >
                            <button
                              onClick={() => handleSectionChange(null)}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                !activeSection?.startsWith("file-arhiva-")
                                  ? "font-bold"
                                  : "text-gray-600 dark:text-[#9e96b8] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                              }`}
                              style={
                                !activeSection?.startsWith("file-arhiva-")
                                  ? { color: ACCENT }
                                  : {}
                              }
                            >
                              <Database
                                size={12}
                                className="flex-shrink-0"
                                style={{
                                  color: !activeSection?.startsWith(
                                    "file-arhiva-",
                                  )
                                    ? ACCENT
                                    : "#9ca3af",
                                }}
                              />
                              Žiralni
                            </button>
                            <div className="my-1 border-t border-dashed border-gray-200 dark:border-[#3a3158]" />
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
                                        : "text-gray-600 dark:text-[#9e96b8] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                                    }`}
                                    style={isActive ? { color: PRIMARY } : {}}
                                  >
                                    <Calendar
                                      size={12}
                                      className="text-gray-400 dark:text-[#5f5878] flex-shrink-0"
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
              <div>
                <button
                  ref={preglediBtnRef}
                  onClick={() => toggleMenu("pregledi")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "pregledi",
                    !!(
                      openMenu === "pregledi" ||
                      activeSection === "pregledi-racuna" ||
                      activeSection === "pregled-kalkulacija"
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("pregledi")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <BarChart2 size={13} style={{ color: "#111" }} />
                  </span>
                  Pregledi
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "pregledi" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "pregledi" &&
                  ReactDOM.createPortal(
                    <div
                      ref={preglediDropRef}
                      style={{
                        position: "fixed",
                        top: dropPos.top,
                        left: dropPos.left,
                        zIndex: 9999,
                      }}
                      className={`w-56 rounded-2xl border ${dropBg} shadow-2xl overflow-hidden`}
                    >
                      <div
                        className={`px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2 ${dropStripeBg}`}
                        style={{ color: PRIMARY }}
                      >
                        <BarChart2 size={12} />
                        Pregledi
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => handleSectionChange("pregledi-racuna")}
                          className={dropdownItemClass(
                            activeSection === "pregledi-racuna",
                          )}
                          style={
                            activeSection === "pregledi-racuna"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                              activeSection === "pregledi-racuna"
                                ? ""
                                : "bg-[#ede8f5] dark:bg-[#312a50]"
                            }`}
                            style={
                              activeSection === "pregledi-racuna"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <Receipt
                              size={13}
                              style={{
                                color:
                                  activeSection === "pregledi-racuna"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Pregledi računa
                        </button>

                        <button
                          onClick={() =>
                            handleSectionChange("pregled-kalkulacija")
                          }
                          className={dropdownItemClass(
                            activeSection === "pregled-kalkulacija",
                          )}
                          style={
                            activeSection === "pregled-kalkulacija"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                              activeSection === "pregled-kalkulacija"
                                ? ""
                                : "bg-[#ede8f5] dark:bg-[#312a50]"
                            }`}
                            style={
                              activeSection === "pregled-kalkulacija"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <Calculator
                              size={13}
                              style={{
                                color:
                                  activeSection === "pregled-kalkulacija"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Pregled kalkulacija
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              {/* NARUDZBE */}
              <div>
                <button
                  ref={narudzbeBtnRef}
                  onClick={() => toggleMenu("narudzbe")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "narudzbe",
                    !!(
                      openMenu === "narudzbe" ||
                      activeSection === "narudzbe-pregled"
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("narudzbe")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <ShoppingCart size={13} style={{ color: "#111" }} />
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
                      className={`w-52 rounded-2xl border ${dropBg} shadow-2xl overflow-hidden`}
                    >
                      <div
                        className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2 bg-[#edf7e0] dark:bg-[#1a2c12]"
                        style={{ color: ACCENT }}
                      >
                        <ShoppingCart size={12} />
                        Narudžbe
                      </div>
                      <div className="p-2 space-y-0.5">
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
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "narudzbe-pregled" ? "" : "bg-[#edf7e0] dark:bg-[#1a2c12]"}`}
                            style={
                              activeSection === "narudzbe-pregled"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
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

                        <button
                          onClick={() => handleSectionChange("narudzbe-teren")}
                          className={dropdownItemClass(
                            activeSection === "narudzbe-teren",
                          )}
                          style={
                            activeSection === "narudzbe-teren"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "narudzbe-teren" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "narudzbe-teren"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <MapPin
                              size={13}
                              style={{
                                color:
                                  activeSection === "narudzbe-teren"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Unos narudžbe teren
                        </button>

                        <button
                          onClick={() =>
                            handleSectionChange("narudzbe-lokalno")
                          }
                          className={dropdownItemClass(
                            activeSection === "narudzbe-lokalno",
                          )}
                          style={
                            activeSection === "narudzbe-lokalno"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "narudzbe-lokalno" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "narudzbe-lokalno"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <PenLine
                              size={13}
                              style={{
                                color:
                                  activeSection === "narudzbe-lokalno"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Unos narudžbe lokalno
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
              {/* PROIZVODNJA */}
              <div>
                <button
                  ref={proizvodnjaBtnRef}
                  onClick={() => toggleMenu("proizvodnja")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "proizvodnja",
                    !!(
                      openMenu === "proizvodnja" ||
                      activeSection?.startsWith("klise-")
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("proizvodnja")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <Factory size={13} style={{ color: "#111" }} />
                  </span>
                  Proizvodnja
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "proizvodnja" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "proizvodnja" &&
                  ReactDOM.createPortal(
                    <div
                      ref={proizvodnjaDrop}
                      style={{
                        position: "fixed",
                        top: dropPos.top,
                        left: dropPos.left,
                        zIndex: 9999,
                      }}
                      className={`w-56 rounded-2xl border ${dropBg} shadow-2xl overflow-hidden`}
                    >
                      <div
                        className={`px-4 py-2.5 text-xs font-bold tracking-widest uppercase flex items-center gap-2 ${dropStripeBg}`}
                        style={{ color: PRIMARY }}
                      >
                        <Factory size={12} />
                        Proizvodnja
                      </div>
                      <div className="p-2 space-y-0.5">
                        {/* Kliše toggle */}
                        <button
                          onClick={() => setKliseExpanded((p) => !p)}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-[#c5bfd8] hover:bg-purple-50 dark:hover:bg-[#2d2648] transition-all"
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                              <Layers size={13} style={{ color: PRIMARY }} />
                            </span>
                            Kliše
                          </span>
                          <ChevronRight
                            size={14}
                            className={`transition-transform duration-200 text-gray-400 dark:text-[#5f5878] ${kliseExpanded ? "rotate-90" : ""}`}
                          />
                        </button>

                        {kliseExpanded && (
                          <div
                            className="ml-4 pl-3 space-y-0.5 border-l-2"
                            style={{ borderColor: PRIMARY }}
                          >
                            {[
                              {
                                key: "klise-unos" as MenuSection,
                                label: "Unos kliše",
                                icon: <FilePlus size={13} />,
                              },
                              {
                                key: "klise-naplata" as MenuSection,
                                label: "Unos naplate klišea",
                                icon: <CreditCard size={13} />,
                              },
                              {
                                key: "klise-dobavljac" as MenuSection,
                                label: "Unos podataka od dobavljača",
                                icon: <Truck size={13} />,
                              },
                              {
                                key: "klise-pregled" as MenuSection,
                                label: "Pregled",
                                icon: <Eye size={13} />,
                              },
                            ].map(({ key, label, icon }) => {
                              const isActive = activeSection === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => handleSectionChange(key)}
                                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                    isActive
                                      ? "font-bold"
                                      : "text-gray-600 dark:text-[#9e96b8] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                                  }`}
                                  style={isActive ? { color: PRIMARY } : {}}
                                >
                                  <span
                                    className="flex-shrink-0"
                                    style={{
                                      color: isActive ? PRIMARY : "#9ca3af",
                                    }}
                                  >
                                    {icon}
                                  </span>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
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
      <BazaContext.Provider value={{ isArhiva, godina: aktivnaGodina }}>
        <main className="mx-[10px] px-[10px] py-8">
          {activeSection === null && (
            <div className="flex flex-col items-center justify-center py-20 text-center"></div>
          )}

          {activeSection === "file-opcije" && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                  <Settings size={20} style={{ color: PRIMARY }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Opcije
                </h2>
              </div>
              <p className="text-gray-500 dark:text-[#7d7498]">
                Podešavanja modula File.
              </p>
            </div>
          )}

          {activeSection?.startsWith("file-arhiva-") && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#edf7e0] dark:bg-[#1a2c12]">
                  <FolderArchive size={20} style={{ color: ACCENT }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Arhiva {activeSection.replace("file-arhiva-", "")}
                </h2>
              </div>
              <p className="text-gray-500 dark:text-[#7d7498]">
                Pregled arhive za godinu{" "}
                <strong>{activeSection.replace("file-arhiva-", "")}</strong>.
              </p>
            </div>
          )}

          {activeSection === "pregledi-racuna" && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                  <Receipt size={20} style={{ color: PRIMARY }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Pregledi računa
                </h2>
              </div>
              <p className="text-gray-500 dark:text-[#7d7498]">
                Prikaz i pretraga računa.
              </p>
            </div>
          )}

          {activeSection === "pregled-kalkulacija" && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                  <Calculator size={20} style={{ color: PRIMARY }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Pregled kalkulacija
                </h2>
              </div>
              <p className="text-gray-500 dark:text-[#7d7498]">
                Prikaz svih kalkulacija.
              </p>
            </div>
          )}

          {activeSection === "narudzbe-pregled" && <OrdersList />}

          {activeSection === "narudzbe-teren" && <NarudzbeUnosTeren />}

          {activeSection === "narudzbe-lokalno" && <NarudzbeUnosLokalno />}

          {activeSection === "klise-unos" && <KliseUnosNovog />}

          {activeSection === "klise-naplata" && <KliseNaplataOdKupca />}

          {activeSection === "klise-dobavljac" && <KliseUnosZaDobavljaca />}

          {activeSection === "klise-pregled" && <KlisePregled />}
        </main>
      </BazaContext.Provider>
    </div>
  );
}
