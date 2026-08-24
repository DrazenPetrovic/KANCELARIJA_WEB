import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Loader2,
  Lock,
  LockOpen,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useBlagajna } from "../context/BlagajnaContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// NAPOMENA: zatvaranje naloga blagajne (POST /api/blagajna/zatvori) je
// sljedeći korak — backend za njega još nije napravljen. Otvaranje
// (POST /api/blagajna/otvori) je povezano na erp.blagajna_otvaranje().
// Status se čita iz zajedničkog BlagajnaContext-a, koji koristi i meni u
// Dashboard-u (da omogući/onemogući "Unos uplata/isplata"), tako da se oba
// mjesta odmah usklade nakon otvaranja/zatvaranja.

const fmtDatum = (dt: string) => {
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const fmtVrijeme = (dt: string) => {
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtKM = (n: number) =>
  n.toLocaleString("bs-BA", { minimumFractionDigits: 2 }) + " KM";

const RedIznos = ({
  label,
  iznos,
  color,
  large,
  separator,
}: {
  label: string;
  iznos: number;
  color?: string;
  large?: boolean;
  separator?: boolean;
}) => (
  <>
    {separator && (
      <div className="h-px bg-gray-100 dark:bg-[#2d2648] my-2" />
    )}
    <div className="flex items-center justify-between py-1.5">
      <span
        className={`${large ? "text-sm font-bold" : "text-xs text-gray-500 dark:text-[#7d7498]"}`}
        style={large ? { color } : undefined}
      >
        {label}
      </span>
      <span
        className={`font-bold tabular-nums ${large ? "text-base" : "text-sm"}`}
        style={{ color: color ?? "inherit" }}
      >
        {fmtKM(iznos)}
      </span>
    </div>
  </>
);

export function BlagajnaStatus() {
  const { stanje, loading, refresh } = useBlagajna();
  const [submitting, setSubmitting] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [zatvaranjeMode, setZatvaranjeMode] = useState(false);
  const [krajStvarno, setKrajStvarno] = useState("");
  const [showOtvoriModal, setShowOtvoriModal] = useState(false);

  const handleOtvori = async () => {
    setShowOtvoriModal(false);
    setSubmitting(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/blagajna/otvori`, {
        method: "POST",
        credentials: "include",
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      await refresh();
    } catch (e: unknown) {
      setGreska(
        e instanceof Error
          ? e.message
          : "Otvaranje blagajne još nije podržano na serveru",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleZatvori = async () => {
    const iznos = parseFloat(krajStvarno.replace(",", "."));
    if (isNaN(iznos) || iznos < 0) {
      setGreska("Unesite ispravno prebrojano stanje gotovine");
      return;
    }
    setSubmitting(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/blagajna/zatvori`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ krajStvarno: iznos }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setZatvaranjeMode(false);
      setKrajStvarno("");
      await refresh();
    } catch (e: unknown) {
      setGreska(
        e instanceof Error
          ? e.message
          : "Zatvaranje blagajne još nije podržano na serveru",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const razlikaPreview =
    zatvaranjeMode && stanje?.tekuci_obracun !== undefined && krajStvarno !== ""
      ? parseFloat(krajStvarno.replace(",", ".")) - stanje.tekuci_obracun
      : null;

  const isOtvorena = stanje?.status === "otvorena";
  const isZatvorena = stanje?.status === "zatvorena";

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Landmark size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Status blagajne
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Otvaranje, zatvaranje i tekući obračun blagajne
          </p>
        </div>
        {stanje !== null && stanje !== undefined && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#ede8f5] dark:bg-[#312a50]"
            style={{ color: PRIMARY }}
          >
            Blagajna #{stanje.id}
          </span>
        )}
        {stanje !== null && stanje !== undefined && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={
              isOtvorena
                ? { background: "#e9f7df", color: ACCENT }
                : { background: "#f3f4f6", color: "#6b7280" }
            }
          >
            {isOtvorena ? <LockOpen size={11} /> : <Lock size={11} />}
            {isOtvorena ? "OTVORENA" : "ZATVORENA"}
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {/* Napomena da otvaranje/zatvaranje još nije povezano sa serverom */}
      <div
        className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
        style={{ background: `${PRIMARY}12`, color: PRIMARY }}
      >
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          Status, početno i krajnje stanje se čitaju iz zadnjeg naloga
          blagajne. Otvaranje/zatvaranje novog naloga (i vezivanje
          uplata/isplata za njega) dolazi u sljedećem koraku.
        </span>
      </div>

      {/* Kartica */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        <div className="flex items-center justify-center p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2
                size={26}
                className="animate-spin"
                style={{ color: PRIMARY }}
              />
              <span className="text-sm text-gray-400 dark:text-[#5f5878]">
                Učitavanje stanja...
              </span>
            </div>
          ) : (
            <div className="w-full max-w-lg">
              {/* Greška */}
              {greska && (
                <div className="w-full mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span className="flex-1">{greska}</span>
                  <button type="button" onClick={() => setGreska(null)}>
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Nikad nije otvorena */}
              {(stanje === null || stanje === undefined) && (
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${PRIMARY}12` }}
                  >
                    <Landmark size={28} style={{ color: PRIMARY }} />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-[#5f5878] mb-6">
                    Blagajna nikad nije bila otvorena.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowOtvoriModal(true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: PRIMARY }}
                  >
                    {submitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <LockOpen size={15} />
                    )}
                    Otvori blagajnu
                  </button>
                </div>
              )}

              {/* Otvorena — prikaz + zatvaranje */}
              {isOtvorena && stanje && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-hidden">
                    <div
                      className="px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase"
                      style={{ background: `${PRIMARY}0a`, color: PRIMARY }}
                    >
                      Aktivna sesija
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-[#7d7498]">
                        Otvorena
                      </span>
                      <span className="font-semibold text-gray-700 dark:text-[#c5bfd8]">
                        {fmtDatum(stanje.datum_otvaranja)} u{" "}
                        {fmtVrijeme(stanje.datum_otvaranja)}
                      </span>
                    </div>
                    {stanje.naziv_operatera_otvaranje && (
                      <div className="px-4 pb-3 flex items-center justify-between text-sm border-t border-gray-50 dark:border-[#2d2648] pt-2">
                        <span className="text-gray-500 dark:text-[#7d7498]">
                          Operater
                        </span>
                        <span className="font-semibold text-gray-700 dark:text-[#c5bfd8]">
                          {stanje.naziv_operatera_otvaranje}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-4 py-3">
                    <div
                      className="text-[10px] font-bold tracking-widest uppercase mb-2"
                      style={{ color: PRIMARY }}
                    >
                      Tekući obračun
                    </div>
                    <RedIznos
                      label="Početak gotovine"
                      iznos={Number(stanje.pocetak_gotovine)}
                    />
                    <RedIznos
                      label="+ Uplate od otvaranja"
                      iznos={stanje.tekuce_uplate ?? 0}
                      color={ACCENT}
                    />
                    <RedIznos
                      label="− Isplate od otvaranja"
                      iznos={stanje.tekuce_isplate ?? 0}
                      color="#ef4444"
                    />
                    <RedIznos
                      label="Obračunato stanje"
                      iznos={stanje.tekuci_obracun ?? 0}
                      color={PRIMARY}
                      large
                      separator
                    />
                  </div>

                  {!zatvaranjeMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setZatvaranjeMode(true);
                        setGreska(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all hover:opacity-90"
                      style={{
                        borderColor: "#ef4444",
                        color: "#ef4444",
                        background: "#ef444408",
                      }}
                    >
                      <Lock size={15} />
                      Zatvori blagajnu
                    </button>
                  ) : (
                    <div
                      className="rounded-xl border-2 overflow-hidden"
                      style={{ borderColor: "#ef444440" }}
                    >
                      <div
                        className="px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase"
                        style={{ background: "#ef44440a", color: "#ef4444" }}
                      >
                        Zatvaranje blagajne
                      </div>
                      <div className="px-4 py-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-[#7d7498]">
                            Obračunato stanje
                          </span>
                          <span className="font-bold" style={{ color: PRIMARY }}>
                            {fmtKM(stanje.tekuci_obracun ?? 0)}
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 dark:text-[#7d7498] mb-1">
                            Prebrojano gotovine (KM)
                          </label>
                          <input
                            type="text"
                            value={krajStvarno}
                            onChange={(e) => setKrajStvarno(e.target.value)}
                            placeholder="0,00"
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6] text-right font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            autoFocus
                          />
                        </div>

                        {razlikaPreview !== null && !isNaN(razlikaPreview) && (
                          <div
                            className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold"
                            style={
                              Math.abs(razlikaPreview) < 0.01
                                ? { background: "#e9f7df", color: ACCENT }
                                : razlikaPreview > 0
                                  ? { background: "#eff6ff", color: "#2563eb" }
                                  : { background: "#fef2f2", color: "#ef4444" }
                            }
                          >
                            <span>Razlika</span>
                            <span>
                              {razlikaPreview >= 0 ? "+" : ""}
                              {fmtKM(razlikaPreview)}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setZatvaranjeMode(false);
                              setKrajStvarno("");
                              setGreska(null);
                            }}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                          >
                            Otkaži
                          </button>
                          <button
                            type="button"
                            onClick={handleZatvori}
                            disabled={submitting || krajStvarno === ""}
                            className="flex-2 flex-grow flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: "#ef4444" }}
                          >
                            {submitting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Lock size={14} />
                            )}
                            Potvrdi zatvaranje
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Zatvorena — pregled zadnje sesije + otvori */}
              {isZatvorena && stanje && (
                <div className="space-y-4">
                  <div
                    className="rounded-2xl border-2 overflow-hidden"
                    style={{ borderColor: "#d1d5db" }}
                  >
                    <div className="px-4 py-2.5 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-[#9e96b8] bg-[#f3f4f6] dark:bg-[#1e1a2d]">
                      <Lock size={12} />
                      Nalog #{stanje.id} — zatvoren
                    </div>

                    <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-[#2d2648]">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-[#7d7498]">
                          Otvorena
                        </span>
                        <span className="font-semibold text-gray-700 dark:text-[#c5bfd8]">
                          {fmtDatum(stanje.datum_otvaranja)}{" "}
                          {fmtVrijeme(stanje.datum_otvaranja)}
                          {stanje.naziv_operatera_otvaranje && (
                            <span className="text-gray-400 dark:text-[#5f5878] font-normal">
                              {" "}
                              · {stanje.naziv_operatera_otvaranje}
                            </span>
                          )}
                        </span>
                      </div>
                      {stanje.datum_zatvaranja && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-[#7d7498]">
                            Zatvorena
                          </span>
                          <span className="font-semibold text-gray-700 dark:text-[#c5bfd8]">
                            {fmtDatum(stanje.datum_zatvaranja)}{" "}
                            {fmtVrijeme(stanje.datum_zatvaranja)}
                            {stanje.naziv_operatera_zatvaranje && (
                              <span className="text-gray-400 dark:text-[#5f5878] font-normal">
                                {" "}
                                · {stanje.naziv_operatera_zatvaranje}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      <div className="text-[10px] font-bold tracking-widest uppercase mb-2 text-gray-400 dark:text-[#5f5878]">
                        Zaključni obračun
                      </div>
                      <RedIznos
                        label="Početak gotovine"
                        iznos={Number(stanje.pocetak_gotovine)}
                      />
                      <RedIznos
                        label="+ Ukupno uplaćeno"
                        iznos={stanje.tekuce_uplate ?? 0}
                        color={ACCENT}
                      />
                      <RedIznos
                        label="− Ukupno isplaćeno"
                        iznos={stanje.tekuce_isplate ?? 0}
                        color="#ef4444"
                      />
                      {stanje.kraj_gotovine_obracun !== null && (
                        <RedIznos
                          label="Trebalo biti"
                          iznos={Number(stanje.kraj_gotovine_obracun)}
                          color={PRIMARY}
                          large
                          separator
                        />
                      )}
                      {stanje.kraj_gotovine_stvarno !== null && (
                        <RedIznos
                          label="Prebrojano"
                          iznos={Number(stanje.kraj_gotovine_stvarno)}
                        />
                      )}
                      {stanje.razlika !== null && (
                        <div className="flex items-center justify-between py-1.5 mt-1">
                          <span
                            className="text-sm font-bold"
                            style={{
                              color:
                                Math.abs(Number(stanje.razlika)) < 0.01
                                  ? ACCENT
                                  : "#ef4444",
                            }}
                          >
                            Razlika
                          </span>
                          <div className="flex items-center gap-1.5">
                            {Math.abs(Number(stanje.razlika)) < 0.01 ? (
                              <CheckCircle2
                                size={14}
                                style={{ color: ACCENT }}
                              />
                            ) : Number(stanje.razlika) > 0 ? (
                              <TrendingUp
                                size={14}
                                style={{ color: "#2563eb" }}
                              />
                            ) : (
                              <TrendingDown
                                size={14}
                                style={{ color: "#ef4444" }}
                              />
                            )}
                            <span
                              className="font-bold tabular-nums text-base"
                              style={{
                                color:
                                  Math.abs(Number(stanje.razlika)) < 0.01
                                    ? ACCENT
                                    : Number(stanje.razlika) > 0
                                      ? "#2563eb"
                                      : "#ef4444",
                              }}
                            >
                              {Number(stanje.razlika) >= 0 ? "+" : ""}
                              {fmtKM(Number(stanje.razlika))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] px-4 py-3 text-center">
                    <p className="text-xs text-gray-400 dark:text-[#5f5878] mb-3">
                      Početni iznos nove sesije:{" "}
                      <span className="font-bold" style={{ color: PRIMARY }}>
                        {fmtKM(
                          Number(
                            stanje.kraj_gotovine_stvarno ??
                              stanje.kraj_gotovine_obracun ??
                              0,
                          ),
                        )}
                      </span>{" "}
                      (preuzeto iz zadnjeg zatvaranja)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowOtvoriModal(true)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                      style={{ background: PRIMARY }}
                    >
                      {submitting ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <LockOpen size={15} />
                      )}
                      Otvori blagajnu
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Potvrda otvaranja blagajne */}
      {showOtvoriModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${PRIMARY}14` }}
              >
                <LockOpen size={18} style={{ color: PRIMARY }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  Otvaranje blagajne
                </p>
                <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-1">
                  Da li ste sigurni da želite otvoriti novi nalog blagajne
                  {isZatvorena && stanje ? (
                    <>
                      {" "}
                      sa početnim stanjem od{" "}
                      <strong style={{ color: PRIMARY }}>
                        {fmtKM(
                          Number(
                            stanje.kraj_gotovine_stvarno ??
                              stanje.kraj_gotovine_obracun ??
                              0,
                          ),
                        )}
                      </strong>
                      ?
                    </>
                  ) : (
                    "?"
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOtvoriModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={handleOtvori}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LockOpen size={13} />
                )}
                Da, otvori blagajnu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
