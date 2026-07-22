import ReactDOM from "react-dom";
import { KlisePregled } from "./KlisePregled";
import { KliseNaplataOdKupca } from "./KliseNaplataOdKupca";
import { KliseUnosNovog } from "./KliseUnosNovog";
import { KliseUnosZaDobavljaca } from "./KliseUnosZaDobavljaca";
import { OrdersList } from "./OrdersList.tsx";
import { NarudzbeUnosTeren } from "./NarudzbeUnosTeren";
import { NarudzbeUnosLokalno } from "./NarudzbeUnosLokalno";
import { NarudzbeZavrseneLokalno } from "./NarudzbeZavrseneLokalno";
import { GotovinskiRacuni } from "./racuniGotovinski.tsx";
import { ZiralniRacuni } from "./racuniZiralni.tsx";
import { RacuniPregled } from "./racuniPregled.tsx";
import { PartneriUnos } from "./PartneriUnos";
import { PartneriPregled } from "./PartneriPregled";
import { useEffect, useRef, useState } from "react";
import { BazaContext } from "../context/BazaContext";
import { useTheme } from "../context/ThemeContext";
import { usePrint } from "../context/PrintContext";
import {
  getPrintServiceStatus,
  getPrintServiceVersion,
} from "../utils/printService";
import {
  proveriDostupnostEsira,
  unesiPinEsira,
  type EsirUredjaj,
} from "./fiskalniRacuni";
import {
  Banknote,
  BarChart2,
  BookMarked,
  BookOpen,
  Calculator,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Eye,
  Factory,
  FilePlus,
  FileText,
  FolderArchive,
  Landmark,
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
  UserPlus,
  Users,
} from "lucide-react";

const PRIMARY = "#785E9E";
const PRIMARY_DARK = "#604880";
const ACCENT = "#8FC74A";

type ServisStatus = "checking" | "online" | "offline";

const statusBoja = (status: ServisStatus) =>
  status === "online" ? "#22c55e" : status === "offline" ? "#ef4444" : "#f59e0b";

const statusTekst = (status: ServisStatus) =>
  status === "online" ? "online" : status === "offline" ? "offline" : "provjera";

function StatusIndikator({
  label,
  status,
  dodatak,
  tekst,
  boja,
}: {
  label: string;
  status: ServisStatus;
  dodatak?: string;
  tekst?: string;
  boja?: string;
}) {
  const bojaKonacna = boja ?? statusBoja(status);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${status === "online" && !boja ? "animate-blink" : ""}`}
        style={{ background: bojaKonacna }}
      />
      <p className="text-[10px] uppercase tracking-wide text-white/70 font-medium">
        {label}: {tekst ?? statusTekst(status)}
        {dodatak ? ` (v${dodatak})` : ""}
      </p>
    </div>
  );
}

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
  | "partneri-unos"
  | "partneri-pregled"
  | "pregledi-racuna"
  | "pregled-kalkulacija"
  | "narudzbe-pregled"
  | "narudzbe-teren"
  | "narudzbe-lokalno"
  | "narudzbe-zavrsene-lokalno"
  | "klise-unos"
  | "klise-naplata"
  | "klise-dobavljac"
  | "klise-pregled"
  | "racuni-gotovinski"
  | "racuni-virmanski"
  | "racuni-knjizna-gotovinski"
  | "racuni-knjizna-virmanski"
  | null;

export function Dashboard({
  username,
  vrstaRadnika,
  onLogout,
}: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const {
    printers,
    loadingPrinters,
    loadPrinters,
    selectedPrinter,
    setSelectedPrinter,
    savePrinter,
  } = usePrint();
  const [printServiceStatus, setPrintServiceStatus] =
    useState<ServisStatus>("checking");
  const [printServiceVersion, setPrintServiceVersion] = useState("");
  const [esirGotovinskiStatus, setEsirGotovinskiStatus] =
    useState<ServisStatus>("checking");
  const [esirZiralniStatus, setEsirZiralniStatus] =
    useState<ServisStatus>("checking");
  const [esirGotovinskiPin, setEsirGotovinskiPin] = useState<{
    ok: boolean;
    poruka?: string;
  }>({ ok: false });
  const [esirZiralniPin, setEsirZiralniPin] = useState<{
    ok: boolean;
    poruka?: string;
  }>({ ok: false });
  const [showPrinterSavedModal, setShowPrinterSavedModal] = useState(false);
  const [activeSection, setActiveSection] = useState<MenuSection>(null);
  const [openMenu, setOpenMenu] = useState<
    "file" | "partneri" | "pregledi" | "narudzbe" | "proizvodnja" | "racuni" | null
  >(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [kliseExpanded, setKliseExpanded] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [hoveredBtn, setHoveredBtn] = useState<
    "file" | "partneri" | "pregledi" | "narudzbe" | "proizvodnja" | "racuni" | null
  >(null);

  const pinUnesenRef = useRef<Record<EsirUredjaj, boolean>>({
    gotovinski: false,
    ziralni: false,
  });

  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const partneriBtnRef = useRef<HTMLButtonElement>(null);
  const preglediBtnRef = useRef<HTMLButtonElement>(null);
  const narudzbeBtnRef = useRef<HTMLButtonElement>(null);
  const proizvodnjaBtnRef = useRef<HTMLButtonElement>(null);
  const racuniBtnRef = useRef<HTMLButtonElement>(null);
  const fileDropRef = useRef<HTMLDivElement>(null);
  const partneriDropRef = useRef<HTMLDivElement>(null);
  const preglediDropRef = useRef<HTMLDivElement>(null);
  const narudzbeDropRef = useRef<HTMLDivElement>(null);
  const proizvodnjaDrop = useRef<HTMLDivElement>(null);
  const racuniDropRef = useRef<HTMLDivElement>(null);

  const isAdministrator = vrstaRadnika === 1;
  const isStandardUser = vrstaRadnika === 3;
  const roleLabel = isAdministrator ? "Administrator" : "Korisnik";

  const isArhiva = activeSection?.startsWith("file-arhiva-") ?? false;
  const aktivnaGodina = isArhiva
    ? activeSection!.replace("file-arhiva-", "")
    : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inFile =
        fileBtnRef.current?.contains(t) || fileDropRef.current?.contains(t);
      const inPartneri =
        partneriBtnRef.current?.contains(t) ||
        partneriDropRef.current?.contains(t);
      const inPregledi =
        preglediBtnRef.current?.contains(t) ||
        preglediDropRef.current?.contains(t);
      const inNarudzbe =
        narudzbeBtnRef.current?.contains(t) ||
        narudzbeDropRef.current?.contains(t);
      const inProizvodnja =
        proizvodnjaBtnRef.current?.contains(t) ||
        proizvodnjaDrop.current?.contains(t);
      const inRacuni =
        racuniBtnRef.current?.contains(t) || racuniDropRef.current?.contains(t);
      if (
        !inFile &&
        !inPartneri &&
        !inPregledi &&
        !inNarudzbe &&
        !inProizvodnja &&
        !inRacuni
      )
        setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkPrintService = async () => {
      try {
        const status = await getPrintServiceStatus();
        if (mounted) {
          setPrintServiceStatus(
            status.serviceActive && status.pdfRendererActive
              ? "online"
              : "offline",
          );
        }
      } catch {
        if (mounted) setPrintServiceStatus("offline");
      }

      try {
        const version = await getPrintServiceVersion();
        if (mounted) setPrintServiceVersion(version);
      } catch {
        if (mounted) setPrintServiceVersion("");
      }
    };

    void checkPrintService();
    const intervalId = setInterval(checkPrintService, 15000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const osigurajPin = async (
      uredjaj: EsirUredjaj,
      pin: string | undefined,
      setPinStanje: (s: { ok: boolean; poruka?: string }) => void,
    ) => {
      if (pinUnesenRef.current[uredjaj]) {
        if (mounted) setPinStanje({ ok: true });
        return;
      }
      if (!pin) {
        if (mounted) setPinStanje({ ok: false, poruka: "PIN nije podešen" });
        return;
      }
      try {
        const rezultat = await unesiPinEsira(uredjaj, pin);
        if (rezultat.uspjesno) pinUnesenRef.current[uredjaj] = true;
        if (mounted)
          setPinStanje({ ok: rezultat.uspjesno, poruka: rezultat.poruka });
      } catch {
        if (mounted)
          setPinStanje({ ok: false, poruka: "Greška pri unosu PIN-a" });
      }
    };

    const checkEsirUredjaji = async () => {
      const [gotovinski, ziralni] = await Promise.all([
        proveriDostupnostEsira("gotovinski"),
        proveriDostupnostEsira("ziralni"),
      ]);
      if (gotovinski) {
        void osigurajPin(
          "gotovinski",
          import.meta.env.VITE_ESIR_PIN_GOTOVINSKI,
          setEsirGotovinskiPin,
        );
      } else if (mounted) {
        setEsirGotovinskiPin({ ok: false });
      }
      if (ziralni) {
        void osigurajPin(
          "ziralni",
          import.meta.env.VITE_ESIR_PIN_ZIRALNI,
          setEsirZiralniPin,
        );
      } else if (mounted) {
        setEsirZiralniPin({ ok: false });
      }
      if (mounted) {
        setEsirGotovinskiStatus(gotovinski ? "online" : "offline");
        setEsirZiralniStatus(ziralni ? "online" : "offline");
      }
    };

    void checkEsirUredjaji();
    const intervalId = setInterval(checkEsirUredjaji, 15000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!showPrinterSavedModal) return;
    const timeoutId = setTimeout(() => setShowPrinterSavedModal(false), 2500);
    return () => clearTimeout(timeoutId);
  }, [showPrinterSavedModal]);

  const toggleMenu = (
    menu:
      | "file"
      | "partneri"
      | "pregledi"
      | "narudzbe"
      | "proizvodnja"
      | "racuni",
  ) => {
    const ref =
      menu === "file"
        ? fileBtnRef
        : menu === "partneri"
          ? partneriBtnRef
          : menu === "pregledi"
            ? preglediBtnRef
            : menu === "narudzbe"
              ? narudzbeBtnRef
              : menu === "racuni"
                ? racuniBtnRef
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
    menu:
      | "file"
      | "partneri"
      | "pregledi"
      | "narudzbe"
      | "proizvodnja"
      | "racuni",
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSectionChange(null)}
              className="flex flex-col leading-tight hover:opacity-80 transition-opacity"
              title="Početna strana"
            >
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">
                Rad u bazi podataka:{" "}
                <span className="text-white/80">
                  {import.meta.env.VITE_DB_HOST ?? "—"}
                </span>
              </p>
              <p
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: ACCENT }}
              >
                {isArhiva ? `Arhiva ${aktivnaGodina}` : "Za godinu 2026"}
              </p>
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-white/20">
              <div className="flex flex-col leading-tight">
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
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col gap-0.5">
              <StatusIndikator
                label="Print servis"
                status={printServiceStatus}
                dodatak={printServiceVersion || undefined}
              />
              <StatusIndikator
                label="ESIR gotovinski"
                status={esirGotovinskiStatus}
                tekst={
                  esirGotovinskiStatus === "online" && !esirGotovinskiPin.ok
                    ? `PIN — ${esirGotovinskiPin.poruka ?? "nije unesen"}`
                    : undefined
                }
                boja={
                  esirGotovinskiStatus === "online" && !esirGotovinskiPin.ok
                    ? "#f59e0b"
                    : undefined
                }
              />
              <StatusIndikator
                label="ESIR žiralni"
                status={esirZiralniStatus}
                tekst={
                  esirZiralniStatus === "online" && !esirZiralniPin.ok
                    ? `PIN — ${esirZiralniPin.poruka ?? "nije unesen"}`
                    : undefined
                }
                boja={
                  esirZiralniStatus === "online" && !esirZiralniPin.ok
                    ? "#f59e0b"
                    : undefined
                }
              />
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

              {/* PARTNERI */}
              <div>
                <button
                  ref={partneriBtnRef}
                  onClick={() => toggleMenu("partneri")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "partneri",
                    !!(
                      openMenu === "partneri" ||
                      activeSection?.startsWith("partneri-")
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("partneri")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <Users size={13} style={{ color: "#111" }} />
                  </span>
                  Partneri
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "partneri" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "partneri" &&
                  ReactDOM.createPortal(
                    <div
                      ref={partneriDropRef}
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
                        <Users size={12} />
                        Partneri
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => handleSectionChange("partneri-unos")}
                          className={dropdownItemClass(
                            activeSection === "partneri-unos",
                          )}
                          style={
                            activeSection === "partneri-unos"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                              activeSection === "partneri-unos"
                                ? ""
                                : "bg-[#ede8f5] dark:bg-[#312a50]"
                            }`}
                            style={
                              activeSection === "partneri-unos"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <UserPlus
                              size={13}
                              style={{
                                color:
                                  activeSection === "partneri-unos"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Unos
                        </button>

                        <button
                          onClick={() =>
                            handleSectionChange("partneri-pregled")
                          }
                          className={dropdownItemClass(
                            activeSection === "partneri-pregled",
                          )}
                          style={
                            activeSection === "partneri-pregled"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                              activeSection === "partneri-pregled"
                                ? ""
                                : "bg-[#ede8f5] dark:bg-[#312a50]"
                            }`}
                            style={
                              activeSection === "partneri-pregled"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <Eye
                              size={13}
                              style={{
                                color:
                                  activeSection === "partneri-pregled"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Pregled
                        </button>
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

                        <button
                          onClick={() =>
                            handleSectionChange("narudzbe-zavrsene-lokalno")
                          }
                          className={dropdownItemClass(
                            activeSection === "narudzbe-zavrsene-lokalno",
                          )}
                          style={
                            activeSection === "narudzbe-zavrsene-lokalno"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "narudzbe-zavrsene-lokalno" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "narudzbe-zavrsene-lokalno"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <CheckCheck
                              size={13}
                              style={{
                                color:
                                  activeSection === "narudzbe-zavrsene-lokalno"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Završene lokalne narudžbe
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
              {/* RAČUNI */}
              <div>
                <button
                  ref={racuniBtnRef}
                  onClick={() => toggleMenu("racuni")}
                  className={navBtnBase}
                  style={navBtnStyle(
                    "racuni",
                    !!(
                      openMenu === "racuni" ||
                      activeSection?.startsWith("racuni-")
                    ),
                  )}
                  onMouseEnter={() => setHoveredBtn("racuni")}
                  onMouseLeave={() => setHoveredBtn(null)}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.85)" }}
                  >
                    <Receipt size={13} style={{ color: "#111" }} />
                  </span>
                  Računi
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${openMenu === "racuni" ? "rotate-180" : ""}`}
                  />
                </button>

                {openMenu === "racuni" &&
                  ReactDOM.createPortal(
                    <div
                      ref={racuniDropRef}
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
                        <Receipt size={12} />
                        Računi
                      </div>
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() =>
                            handleSectionChange("racuni-gotovinski")
                          }
                          className={dropdownItemClass(
                            activeSection === "racuni-gotovinski",
                          )}
                          style={
                            activeSection === "racuni-gotovinski"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "racuni-gotovinski" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "racuni-gotovinski"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <Banknote
                              size={13}
                              style={{
                                color:
                                  activeSection === "racuni-gotovinski"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Gotovinski račun
                        </button>

                        <button
                          onClick={() =>
                            handleSectionChange("racuni-virmanski")
                          }
                          className={dropdownItemClass(
                            activeSection === "racuni-virmanski",
                          )}
                          style={
                            activeSection === "racuni-virmanski"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "racuni-virmanski" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "racuni-virmanski"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <Landmark
                              size={13}
                              style={{
                                color:
                                  activeSection === "racuni-virmanski"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Virmanski račun
                        </button>

                        <div className="my-1.5 border-t border-dashed border-gray-200 dark:border-[#3a3158]" />

                        <button
                          onClick={() =>
                            handleSectionChange("racuni-knjizna-gotovinski")
                          }
                          className={dropdownItemClass(
                            activeSection === "racuni-knjizna-gotovinski",
                          )}
                          style={
                            activeSection === "racuni-knjizna-gotovinski"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "racuni-knjizna-gotovinski" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "racuni-knjizna-gotovinski"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <BookOpen
                              size={13}
                              style={{
                                color:
                                  activeSection === "racuni-knjizna-gotovinski"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Knjižna gotovinski
                        </button>

                        <button
                          onClick={() =>
                            handleSectionChange("racuni-knjizna-virmanski")
                          }
                          className={dropdownItemClass(
                            activeSection === "racuni-knjizna-virmanski",
                          )}
                          style={
                            activeSection === "racuni-knjizna-virmanski"
                              ? { background: PRIMARY }
                              : {}
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${activeSection === "racuni-knjizna-virmanski" ? "" : "bg-[#ede8f5] dark:bg-[#312a50]"}`}
                            style={
                              activeSection === "racuni-knjizna-virmanski"
                                ? { background: "rgba(255,255,255,0.2)" }
                                : {}
                            }
                          >
                            <BookMarked
                              size={13}
                              style={{
                                color:
                                  activeSection === "racuni-knjizna-virmanski"
                                    ? "#fff"
                                    : PRIMARY,
                              }}
                            />
                          </span>
                          Knjižna virmanski
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
        <main
          className={`mx-[10px] px-[10px] ${activeSection === "racuni-gotovinski" ? "pt-[10px] pb-0" : "py-8"}`}
        >
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

              <div className="max-w-xl rounded-2xl border border-gray-200 dark:border-[#2d2648] p-4 bg-[#faf9fc] dark:bg-[#1e1730]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#7d7498]">
                    Print servis
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      printServiceStatus === "online"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : printServiceStatus === "offline"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {printServiceStatus === "online"
                      ? "AKTIVAN"
                      : printServiceStatus === "offline"
                        ? "OFFLINE"
                        : "PROVJERA..."}
                    {printServiceVersion ? ` · v${printServiceVersion}` : ""}
                  </span>
                </div>

                <label className="block text-sm font-semibold text-gray-700 dark:text-[#c5bfd8] mb-1">
                  Printer
                </label>

                <div className="flex gap-2">
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]"
                  >
                    <option value="">-- Izaberi printer --</option>
                    {printers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => void loadPrinters()}
                    className="px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#a89fc2] hover:bg-white dark:hover:bg-[#2d2648] transition-colors"
                  >
                    {loadingPrinters ? "..." : "Osvježi"}
                  </button>
                </div>

                <input
                  type="text"
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  placeholder="Naziv printera (ručni unos)"
                  className="mt-2 w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]"
                />

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (savePrinter()) setShowPrinterSavedModal(true);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: PRIMARY }}
                  >
                    Sačuvaj printer
                  </button>
                  <span className="text-xs text-gray-500 dark:text-[#7d7498]">
                    Čuva se za korisnika: {username}
                  </span>
                </div>
              </div>
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

          {activeSection === "partneri-unos" && (
            <PartneriUnos username={username} />
          )}

          {activeSection === "partneri-pregled" && <PartneriPregled />}

          {activeSection === "pregledi-racuna" && <RacuniPregled />}

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

          {activeSection === "narudzbe-zavrsene-lokalno" && (
            <NarudzbeZavrseneLokalno />
          )}

          {activeSection === "klise-unos" && <KliseUnosNovog />}

          {activeSection === "klise-naplata" && <KliseNaplataOdKupca />}

          {activeSection === "klise-dobavljac" && <KliseUnosZaDobavljaca />}

          {activeSection === "klise-pregled" && <KlisePregled />}

          {activeSection === "racuni-gotovinski" && <GotovinskiRacuni />}

          {activeSection === "racuni-virmanski" && <ZiralniRacuni />}

          {activeSection === "racuni-knjizna-gotovinski" && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                  <BookOpen size={20} style={{ color: PRIMARY }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Knjižna gotovinski
                </h2>
              </div>
            </div>
          )}

          {activeSection === "racuni-knjizna-virmanski" && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                  <BookMarked size={20} style={{ color: PRIMARY }} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
                  Knjižna virmanski
                </h2>
              </div>
            </div>
          )}
        </main>
      </BazaContext.Provider>

      {showPrinterSavedModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={() => setShowPrinterSavedModal(false)}
        >
          <div
            className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl flex flex-col items-center text-center p-8 gap-3"
            style={{ width: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "#e9f7df" }}
            >
              <CheckCircle2 size={30} style={{ color: ACCENT }} />
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-[#ede9f6]">
              Printer je sačuvan
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#7d7498]">
              Izabrani printer: <strong>{selectedPrinter}</strong>
            </p>
            <button
              onClick={() => setShowPrinterSavedModal(false)}
              className="mt-2 w-full px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: PRIMARY }}
            >
              U redu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
