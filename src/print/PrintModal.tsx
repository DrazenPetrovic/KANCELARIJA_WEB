import { useState } from "react";
import { X, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { PrintJob } from "../context/PrintContext";

const PRIMARY = "#785E9E";

const MM_TO_PX = 3.7795;

interface Props {
  job: PrintJob;
  onClose: () => void;
}

export function PrintModal({ job, onClose }: Props) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    job.orientation ?? "portrait",
  );
  const [format, setFormat] = useState<"A4" | "A5">("A4");
  const [scale, setScale] = useState(0.62);

  const paperW =
    orientation === "portrait"
      ? (format === "A4" ? 210 : 148) * MM_TO_PX
      : (format === "A4" ? 297 : 210) * MM_TO_PX;

  const paperH =
    orientation === "portrait"
      ? (format === "A4" ? 297 : 210) * MM_TO_PX
      : (format === "A4" ? 210 : 148) * MM_TO_PX;


  const handlePrint = () => {
    const existing = document.getElementById("__print_page_style__");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "__print_page_style__";
    style.textContent = `@media print { @page { size: ${format} ${orientation}; margin: 12mm; } }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById("__print_page_style__")?.remove(), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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
          <div className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center items-start">
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
          <div className="w-52 border-l border-gray-100 flex flex-col p-5 gap-5 flex-shrink-0">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                Zoom preview
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScale((s) => Math.max(0.3, +(s - 0.1).toFixed(2)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 transition-all"
                >
                  <ZoomOut size={14} className="text-gray-500" />
                </button>
                <span className="flex-1 text-center text-sm font-semibold text-gray-700">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(1.2, +(s + 0.1).toFixed(2)))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 transition-all"
                >
                  <ZoomIn size={14} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                Orijentacija
              </p>
              {(["portrait", "landscape"] as const).map((o) => (
                <label
                  key={o}
                  className="flex items-center gap-2 mb-2 cursor-pointer text-sm text-gray-700 select-none"
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                Format papira
              </p>
              {(["A4", "A5"] as const).map((f) => (
                <label
                  key={f}
                  className="flex items-center gap-2 mb-2 cursor-pointer text-sm text-gray-700 select-none"
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
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                <Printer size={15} />
                Štampaj / PDF
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Zatvori
              </button>
            </div>

            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              Za export u PDF izaberi "Spremi kao PDF" u sistemskom dijalogu
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
