import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  Loader2,
  RotateCcw,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

type Status = "ok" | "upozorenje" | "greska";

interface BackupFajl {
  fajl: string;
  datum: string;
  izmijenjen: string;
  velicina: number;
}

interface BazaStatus {
  baza: string;
  cron: string;
  folder: string;
  status: Status;
  poruka: string;
  zadnji: BackupFajl | null;
  prethodni: BackupFajl | null;
  brojFajlova: number;
  ukupnaVelicina: number;
  zadnjiFajlovi: BackupFajl[];
  tmpUToku: boolean;
  log: {
    dostupan: boolean;
    linije: string[];
    rezultat: "ok" | "greska" | "nepoznato";
    razlog?: string;
  } | null;
}

interface BackupOdgovor {
  backupDir: string;
  vrijemeProvjere: string;
  disk: { ukupno: number; slobodno: number } | null;
  baze: BazaStatus[];
}

const pad = (n: number) => String(n).padStart(2, "0");

const fmtDatumVrijeme = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtVelicina = (b: number) => {
  if (b < 1024) return `${b} B`;
  const jed = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < jed.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("bs-BA", { maximumFractionDigits: v < 10 ? 2 : 1 })} ${jed[i]}`;
};

const fmtStarost = (iso: string, sada: Date) => {
  const min = Math.max(0, Math.floor((sada.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `prije ${h} h`;
  return `prije ${Math.floor(h / 24)} dana`;
};

const fmtPromjena = (z: BackupFajl | null, p: BackupFajl | null) => {
  if (!z || !p || p.velicina === 0) return null;
  const proc = ((z.velicina - p.velicina) / p.velicina) * 100;
  return proc;
};

const STATUS_STIL: Record<Status, { boja: string; tekst: string; ikona: JSX.Element }> = {
  ok: { boja: ACCENT, tekst: "OK", ikona: <CheckCircle2 size={12} /> },
  upozorenje: { boja: "#f59e0b", tekst: "UPOZORENJE", ikona: <AlertTriangle size={12} /> },
  greska: { boja: "#ef4444", tekst: "GREŠKA", ikona: <AlertCircle size={12} /> },
};

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
}) => (
  <td
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

export function BackupStatus() {
  const [podaci, setPodaci] = useState<BackupOdgovor | null>(null);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [otvorena, setOtvorena] = useState<string | null>(null);

  const ucitaj = useCallback(async () => {
    setLoading(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/backup/status`, {
        credentials: "include",
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Greška pri učitavanju");
      setPodaci(d.data);
    } catch (e: unknown) {
      setGreska(e instanceof Error ? e.message : "Greška pri učitavanju");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  const sada = podaci ? new Date(podaci.vrijemeProvjere) : new Date();
  const brojGresaka = podaci?.baze.filter((b) => b.status === "greska").length ?? 0;
  const brojUpozorenja = podaci?.baze.filter((b) => b.status === "upozorenje").length ?? 0;
  const ukupno = podaci?.baze.reduce((s, b) => s + b.ukupnaVelicina, 0) ?? 0;

  return (
    <div className="w-[90%] mx-auto space-y-4">
      {/* Zaglavlje */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <DatabaseBackup size={18} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-[#ede9f6]">
              Backup baze podataka
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-[#5f5878]">
              {podaci
                ? `${podaci.backupDir} · provjereno ${fmtDatumVrijeme(podaci.vrijemeProvjere)}`
                : "Učitavanje..."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {podaci && (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white"
              style={{
                background:
                  brojGresaka > 0 ? "#ef4444" : brojUpozorenja > 0 ? "#f59e0b" : ACCENT,
              }}
            >
              {brojGresaka > 0
                ? `${brojGresaka} GREŠKA`
                : brojUpozorenja > 0
                  ? `${brojUpozorenja} UPOZORENJE`
                  : "SVI BACKUPI OK"}
            </span>
          )}
          {podaci?.disk && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-[#c5bfd8]">
              <HardDrive size={14} className="text-gray-400" />
              Slobodno {fmtVelicina(podaci.disk.slobodno)} od{" "}
              {fmtVelicina(podaci.disk.ukupno)}
              <span className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                ({Math.round((podaci.disk.slobodno / podaci.disk.ukupno) * 100)}%)
              </span>
            </span>
          )}
          <button
            onClick={() => void ucitaj()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: PRIMARY }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RotateCcw size={13} />
            )}
            Osvježi
          </button>
        </div>
      </div>

      {greska && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />
          {greska}
        </div>
      )}

      {/* Tabela */}
      {podaci && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TH>Baza</TH>
                  <TH>Cron</TH>
                  <TH>Zadnji backup</TH>
                  <TH right>Veličina</TH>
                  <TH right>Promjena</TH>
                  <TH right>Broj fajlova</TH>
                  <TH right>Ukupno</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {podaci.baze.map((b) => {
                  const stil = STATUS_STIL[b.status];
                  const promjena = fmtPromjena(b.zadnji, b.prethodni);
                  const jeOtvorena = otvorena === b.baza;
                  return (
                    <Fragment key={b.baza}>
                      <tr
                        onClick={() => setOtvorena(jeOtvorena ? null : b.baza)}
                        className={`border-b border-gray-200 dark:border-[#3a3158] cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${jeOtvorena ? "bg-purple-50/60 dark:bg-[#2d2648]" : ""}`}
                      >
                        <TD bold>{b.baza}</TD>
                        <TD>{b.cron}</TD>
                        <TD>
                          {b.zadnji ? (
                            <>
                              {fmtDatumVrijeme(b.zadnji.datum)}
                              <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                                {fmtStarost(b.zadnji.datum, sada)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD right bold>
                          {b.zadnji ? fmtVelicina(b.zadnji.velicina) : "—"}
                        </TD>
                        <TD right>
                          {promjena === null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                promjena < -50
                                  ? "text-red-500 font-bold"
                                  : promjena < 0
                                    ? "text-amber-500"
                                    : ""
                              }
                            >
                              {promjena > 0 ? "+" : ""}
                              {promjena.toLocaleString("bs-BA", { maximumFractionDigits: 1 })}%
                            </span>
                          )}
                        </TD>
                        <TD right>{b.brojFajlova}</TD>
                        <TD right>{fmtVelicina(b.ukupnaVelicina)}</TD>
                        <TD>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white"
                              style={{ background: stil.boja }}
                            >
                              {stil.ikona}
                              {stil.tekst}
                            </span>
                            {b.status !== "ok" && (
                              <span className="text-[10px]" style={{ color: stil.boja }}>
                                {b.poruka}
                              </span>
                            )}
                          </span>
                        </TD>
                      </tr>

                      {jeOtvorena && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-3 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                          >
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="rounded-xl border-2 border-red-500 overflow-hidden">
                                <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr>
                                        <TH>Fajl</TH>
                                        <TH>Datum</TH>
                                        <TH right>Veličina</TH>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {b.zadnjiFajlovi.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={3}
                                            className="px-3 py-8 text-center text-sm text-gray-400"
                                          >
                                            Nema backup fajlova
                                          </td>
                                        </tr>
                                      ) : (
                                        b.zadnjiFajlovi.map((f) => (
                                          <tr
                                            key={f.fajl}
                                            className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1"
                                          >
                                            <TD>{f.fajl}</TD>
                                            <TD>{fmtDatumVrijeme(f.datum)}</TD>
                                            <TD right>{fmtVelicina(f.velicina)}</TD>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-2">
                                  Zadnji zapis iz backup.log
                                </p>
                                {b.log?.dostupan ? (
                                  <pre className="text-[11px] leading-5 whitespace-pre-wrap font-mono">
                                    {b.log.linije.map((l, i) => (
                                      <div
                                        key={i}
                                        className={
                                          l.includes("GRESKA")
                                            ? "text-red-500 font-bold"
                                            : l.includes("USPJESNO")
                                              ? "font-bold"
                                              : "text-gray-600 dark:text-[#c5bfd8]"
                                        }
                                        style={l.includes("USPJESNO") ? { color: ACCENT } : undefined}
                                      >
                                        {l}
                                      </div>
                                    ))}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-gray-400">
                                    Log nije dostupan
                                    {b.log?.razlog ? ` (${b.log.razlog})` : ""}
                                  </p>
                                )}
                                <p className="mt-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                                  Folder: {b.folder}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                  <TD bold>Ukupno</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD right bold>
                    {fmtVelicina(
                      podaci.baze.reduce((s, b) => s + (b.zadnji?.velicina ?? 0), 0),
                    )}
                  </TD>
                  <TD>{""}</TD>
                  <TD right bold>
                    {podaci.baze.reduce((s, b) => s + b.brojFajlova, 0)}
                  </TD>
                  <TD right bold>
                    {fmtVelicina(ukupno)}
                  </TD>
                  <TD>{""}</TD>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
