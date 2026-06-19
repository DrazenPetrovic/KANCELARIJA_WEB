import { useEffect, useRef, useState } from "react";
import { X, Printer, ZoomIn, ZoomOut } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PrintJob } from "../context/PrintContext";
import {
  bytesToBase64,
  getPrintServiceStatus,
  mapPrintError,
  sendPrintJob,
  type PrintServiceStatus,
} from "../utils/printService";

const PRIMARY = "#785E9E";

const MM_TO_PX = 3.7795;

interface Props {
  job: PrintJob;
  onClose: () => void;
  printerName?: string;
}

export function PrintModal({ job, onClose, printerName }: Props) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    job.orientation ?? "portrait",
  );
  const [format, setFormat] = useState<"A4" | "A5">("A4");
  const [scale, setScale] = useState(0.62);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<PrintServiceStatus | null>(
    null,
  );
  const directPrintRef = useRef<HTMLDivElement | null>(null);

  const allowBrowserPrintFallback = job.allowBrowserPrintFallback !== false;

  const paperW =
    orientation === "portrait"
      ? (format === "A4" ? 210 : 148) * MM_TO_PX
      : (format === "A4" ? 297 : 210) * MM_TO_PX;

  const paperH =
    orientation === "portrait"
      ? (format === "A4" ? 297 : 210) * MM_TO_PX
      : (format === "A4" ? 210 : 148) * MM_TO_PX;

  const loadServiceStatus = async (): Promise<PrintServiceStatus | null> => {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const status = await getPrintServiceStatus();
      setServiceStatus(status);
      return status;
    } catch {
      setStatusError("Print servis nije dostupan");
      return null;
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void loadServiceStatus();
  }, [job.title]);

  const isServiceReadyForDirectPrint = (status: PrintServiceStatus | null) =>
    !!status && status.serviceActive && status.pdfRendererActive;

  const resolvePrinterName = (status: PrintServiceStatus) => {
    if (printerName?.trim()) return printerName.trim();
    if (status.defaultPrinter.trim()) return status.defaultPrinter.trim();
    if (status.printers.length > 0) return status.printers[0];
    return "";
  };

  const runBrowserPrint = () => {
    const existing = document.getElementById("__print_page_style__");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "__print_page_style__";
    style.textContent = `@media print { @page { size: ${format} ${orientation}; margin: 12mm; } }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(
      () => document.getElementById("__print_page_style__")?.remove(),
      1500,
    );
  };

  const sendDirectPrintFromPreview = async (status: PrintServiceStatus) => {
    const printSource = directPrintRef.current;
    if (!printSource) {
      throw { code: "INVALID_REQUEST", message: "Nema izvora za štampu" };
    }

    const resolvedPrinter = resolvePrinterName(status);
    if (!resolvedPrinter) {
      throw { code: "PRINTER_NOT_FOUND", message: "Printer nije pronađen" };
    }

    const canvas = await html2canvas(printSource, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: Math.ceil(paperW),
      windowHeight: Math.ceil(paperH),
    });

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format,
      compress: true,
    });

    const pageWidthMm = format === "A4" ? (orientation === "portrait" ? 210 : 297) : (orientation === "portrait" ? 148 : 210);
    const pageHeightMm = format === "A4" ? (orientation === "portrait" ? 297 : 210) : (orientation === "portrait" ? 210 : 148);

    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      pageWidthMm,
      pageHeightMm,
      undefined,
      "FAST",
    );

    const documentBase64 = bytesToBase64(
      new Uint8Array(pdf.output("arraybuffer")),
    );

    return sendPrintJob({
      appId: "kancelarija-web",
      mode: "pdf",
      paperSize: format,
      orientation,
      printerName: resolvedPrinter,
      copies: 1,
      documentType: job.title.toLowerCase(),
      documentBase64,
    });
  };

  const handlePrint = async () => {
    setPrintError(null);

    let latestStatus = serviceStatus;
    if (!latestStatus || statusLoading) {
      latestStatus = await loadServiceStatus();
    }

    const canUseDirectPrint = isServiceReadyForDirectPrint(latestStatus);

    if (!canUseDirectPrint) {
      if (allowBrowserPrintFallback) runBrowserPrint();
      return;
    }

    if (job.onPrint) {
      try {
        await job.onPrint({ format, orientation });
        setPrintSuccess(true);
        setTimeout(onClose, 900);
        return;
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : undefined;
        setPrintError(mapPrintError(code));
        return;
      }
    }

    if (!latestStatus) return;

    try {
      await sendDirectPrintFromPreview(latestStatus);
      setPrintSuccess(true);
      setTimeout(onClose, 900);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : undefined;
      setPrintError(mapPrintError(code));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 920, maxWidth: "95vw", height: "88vh" }}>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{ background: PRIMARY }}
        >
          <div className="flex items-center gap-3 text-white">
            <Printer size={17} />
            <span className="font-semibold text-sm">{job.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Preview area */}
          <div className="flex-1 bg-gray-200 dark:bg-[#1c1828] overflow-auto p-8 flex justify-center items-start">
            <div
              style={{
                width: paperW * scale,
                height: paperH * scale,
                flexShrink: 0,
                overflow: "hidden",
                boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  width: paperW,
                  height: paperH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  background: "white",
                  overflow: "hidden",
                }}
              >
                {job.component}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="w-52 border-l border-gray-100 dark:border-[#2d2648] flex flex-col p-5 gap-5 flex-shrink-0">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878] mb-2.5">
                Zoom preview
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScale((s) => Math.max(0.3, +(s - 0.1).toFixed(2)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-[#3a3158] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-all"
                >
                  <ZoomOut size={14} className="text-gray-500 dark:text-[#7d7498]" />
                </button>
                <span className="flex-1 text-center text-sm font-semibold text-gray-700 dark:text-[#c5bfd8]">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(1.2, +(s + 0.1).toFixed(2)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-[#3a3158] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-all"
                >
                  <ZoomIn size={14} className="text-gray-500 dark:text-[#7d7498]" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878] mb-2.5">
                Orijentacija
              </p>
              {(["portrait", "landscape"] as const).map((o) => (
                <label
                  key={o}
                  className="flex items-center gap-2 mb-2 cursor-pointer text-sm text-gray-700 dark:text-[#c5bfd8] select-none"
                >
                  <input
                    type="radio"
                    name="orientation"
                    value={o}
                    checked={orientation === o}
                    onChange={() => setOrientation(o)}
                    className="accent-purple-600"
                  />
                  {o === "portrait" ? "Portrait" : "Landscape"}
                </label>
              ))}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878] mb-2.5">
                Format papira
              </p>
              {(["A4", "A5"] as const).map((f) => (
                <label
                  key={f}
                  className="flex items-center gap-2 mb-2 cursor-pointer text-sm text-gray-700 dark:text-[#c5bfd8] select-none"
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="accent-purple-600"
                  />
                  {f}
                </label>
              ))}
            </div>

            <div className="mt-auto space-y-2">
              <div className="rounded-xl border border-gray-200 dark:border-[#3a3158] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878]">
                    Print servis
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      statusLoading
                        ? "bg-gray-50 text-gray-500 border-gray-200"
                        : isServiceReadyForDirectPrint(serviceStatus)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {statusLoading
                      ? "..."
                      : isServiceReadyForDirectPrint(serviceStatus)
                        ? "AKTIVAN"
                        : "OFFLINE"}
                  </span>
                </div>
                {!statusLoading && statusError && (
                  <p className="text-[11px] text-rose-600 mt-1.5">
                    {statusError}
                  </p>
                )}
                {!statusLoading && printError && (
                  <p className="text-[11px] text-rose-600 mt-1.5">
                    {printError}
                  </p>
                )}
                {!statusLoading && printSuccess && (
                  <p className="text-[11px] text-emerald-600 mt-1.5">
                    Poslano na štampu
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  void handlePrint();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                <Printer size={15} />
                Štampaj / PDF
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-[#7d7498] border border-gray-200 dark:border-[#3a3158] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
              >
                Zatvori
              </button>
            </div>

            {allowBrowserPrintFallback && (
              <p className="text-[10px] text-gray-400 dark:text-[#5f5878] text-center leading-relaxed">
                Bez print servisa otvara se sistemski dijalog za štampu/PDF
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            position: "fixed",
            left: -10000,
            top: 0,
            width: paperW,
            height: paperH,
            opacity: 0,
            pointerEvents: "none",
            overflow: "hidden",
            background: "white",
            zIndex: -1,
          }}
        >
          <div
            ref={directPrintRef}
            style={{
              width: paperW,
              height: paperH,
              overflow: "hidden",
              background: "white",
            }}
          >
            {job.component}
          </div>
        </div>
      </div>
    </div>
  );
}
