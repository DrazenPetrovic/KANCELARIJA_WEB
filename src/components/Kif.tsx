import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  Percent,
  RefreshCcw,
  Tags,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.sp_kif(datumOd, datumDo).
interface KifRed {
  sifra_kif: number;
  broj_racuna: string;
  vrsta_racuna: string;
  datum_racuna: string;
  sifra_partnera: number;
  naziv_partnera: string;
  adresa_partnera: string;
  naziv_grada: string;
  entitet: string;
  jib: string;
  pib: string;
  ukupno: number;
  rabat_km: number;
  osnova_za_obracun_pdv: number;
  pdv: number;
  vrednost: number;
  datum_unosa: string;
  vrsta_racuna_pod: string;
  el_kif_tip: string;
}

const formatIznos = (v: number | null | undefined) =>
  `${Number(v ?? 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/,/g, " ")} KM`;

// Formatira lokalni datum kao yyyy-MM-dd (bez prolaska kroz UTC, jer
// toISOString() pomjera datum unazad za korisnike u zonama ispred UTC-a).
const formatDatumISO = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const prviDanMjeseca = () => {
  const d = new Date();
  return formatDatumISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => formatDatumISO(new Date());

const formatSifru = (v: string | number | null | undefined): string =>
  v && String(v) !== "0" ? String(v) : "-";

const RABAT_BOJA = "#f59e0b";

function RabatVrijednost({ iznos }: { iznos: number }) {
  const imaRabat = Number(iznos) !== 0;
  return (
    <div
      className={`text-[10px] ${imaRabat ? "font-bold" : "text-gray-400 dark:text-[#5f5878]"}`}
      style={imaRabat ? { color: RABAT_BOJA } : undefined}
    >
      {formatIznos(iznos)}
    </div>
  );
}

// dd.MM.yyyy — za prikaz u poljima Datum od / Datum do i u koloni Datum.
const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const formatDatumVrijemeDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDatumDMY(v)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3 flex-1 min-w-[170px]">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-gray-800 dark:text-[#ede9f6]">
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

const TH = ({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap bg-[#faf9fc] dark:bg-[#1e1a2d] text-gray-400 dark:text-[#5f5878] ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

// Windowing tabele — kod velikog broja redova drži se u DOM-u samo vidljivi
// opseg (+ overscan), a razlika u visini se nadoknađuje "spacer" <tr> prije/
// poslije, isti pristup kao u racuniPregled.tsx.
const ROW_HEIGHT_PX = 56;
const OVERSCAN_REDOVA = 15;
const PRAG_VIRTUALIZACIJE = 150;
const BROJ_KOLONA = 10;

const TD = ({
  children,
  right,
  bold,
  boja,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  boja?: string;
}) => (
  <td
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold" : "text-gray-600 dark:text-[#c5bfd8]"}`}
    style={boja ? { color: boja } : undefined}
  >
    {children}
  </td>
);

export function Kif() {
  const [datumOd, setDatumOd] = useState(prviDanMjeseca());
  const [datumDo, setDatumDo] = useState(danas());
  // Primijenjeni period — mijenja se samo na klik "Prikaži", da odabir datuma
  // sam po sebi ne filtrira tabelu.
  const [primenjeniOd, setPrimenjeniOd] = useState(datumOd);
  const [primenjeniDo, setPrimenjeniDo] = useState(datumDo);
  const [redovi, setRedovi] = useState<KifRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const datumOdRef = useRef<HTMLInputElement>(null);
  const datumDoRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visinaKontejnera, setVisinaKontejnera] = useState(600);

  const otvoriPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  };

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/pregledi-razni/kif`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju KIF-a");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  // sp_kif ne prima parametre (vraća sve stavke) — period se filtrira ovdje.
  useEffect(ucitaj, []);

  const prikazi = () => {
    setPrimenjeniOd(datumOd);
    setPrimenjeniDo(datumDo);
    ucitaj();
  };

  const redoviFiltrirano = useMemo(() => {
    const od = primenjeniOd ? new Date(`${primenjeniOd}T00:00:00`) : null;
    const doo = primenjeniDo ? new Date(`${primenjeniDo}T23:59:59`) : null;
    return redovi.filter((r) => {
      const d = new Date(r.datum_racuna);
      if (isNaN(d.getTime())) return false;
      if (od && d < od) return false;
      if (doo && d > doo) return false;
      return true;
    });
  }, [redovi, primenjeniOd, primenjeniDo]);

  const jeVirtualizovano = redoviFiltrirano.length > PRAG_VIRTUALIZACIJE;

  useEffect(() => {
    if (!jeVirtualizovano) return;
    const el = scrollRef.current;
    if (!el) return;
    setVisinaKontejnera(el.clientHeight);
    setScrollTop(el.scrollTop);
    const naScroll = () => setScrollTop(el.scrollTop);
    const naResize = () => setVisinaKontejnera(el.clientHeight);
    el.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", naResize);
    return () => {
      el.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", naResize);
    };
  }, [jeVirtualizovano]);

  let startIndex = 0;
  let endIndex = redoviFiltrirano.length;
  if (jeVirtualizovano) {
    const prviVidljivi = Math.floor(scrollTop / ROW_HEIGHT_PX);
    const brojVidljivih = Math.ceil(visinaKontejnera / ROW_HEIGHT_PX);
    startIndex = Math.max(0, prviVidljivi - OVERSCAN_REDOVA);
    endIndex = Math.min(
      redoviFiltrirano.length,
      prviVidljivi + brojVidljivih + OVERSCAN_REDOVA,
    );
  }
  const vidljiviRedovi = jeVirtualizovano
    ? redoviFiltrirano.slice(startIndex, endIndex)
    : redoviFiltrirano;
  const visinaPrijeRedova = startIndex * ROW_HEIGHT_PX;
  const visinaPoslijeRedova = (redoviFiltrirano.length - endIndex) * ROW_HEIGHT_PX;

  const ukupnoOsnovica = useMemo(
    () =>
      redoviFiltrirano.reduce(
        (s, r) => s + Number(r.osnova_za_obracun_pdv || 0),
        0,
      ),
    [redoviFiltrirano],
  );
  const ukupnoPdv = useMemo(
    () => redoviFiltrirano.reduce((s, r) => s + Number(r.pdv || 0), 0),
    [redoviFiltrirano],
  );
  const ukupnoRabat = useMemo(
    () => redoviFiltrirano.reduce((s, r) => s + Number(r.rabat_km || 0), 0),
    [redoviFiltrirano],
  );
  const ukupnoVrijednost = useMemo(
    () => redoviFiltrirano.reduce((s, r) => s + Number(r.vrednost || 0), 0),
    [redoviFiltrirano],
  );
  const ukupnoUkupno = useMemo(
    () => redoviFiltrirano.reduce((s, r) => s + Number(r.ukupno || 0), 0),
    [redoviFiltrirano],
  );

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <BookMarked size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            KIF
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Knjiga izlaznih faktura za izabrani period
          </p>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum od
            </span>
            <div
              className="relative cursor-pointer"
              onClick={() => otvoriPicker(datumOdRef)}
            >
              <input
                ref={datumOdRef}
                type="date"
                value={datumOd}
                onChange={(e) => setDatumOd(e.target.value)}
                style={{ color: "transparent" }}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
              />
              <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
                {formatDatumDMY(datumOd) ?? "Izaberite datum"}
              </div>
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Datum do
            </span>
            <div
              className="relative cursor-pointer"
              onClick={() => otvoriPicker(datumDoRef)}
            >
              <input
                ref={datumDoRef}
                type="date"
                value={datumDo}
                onChange={(e) => setDatumDo(e.target.value)}
                style={{ color: "transparent" }}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] cursor-pointer"
              />
              <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 dark:text-[#ede9f6] pointer-events-none">
                {formatDatumDMY(datumDo) ?? "Izaberite datum"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={prikazi}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
          </button>
        </div>
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<FileText size={16} />}
            vrijednost={String(redoviFiltrirano.length)}
            naziv="Broj računa"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={formatIznos(ukupnoOsnovica)}
            naziv="Osnovica za PDV"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Percent size={16} />}
            vrijednost={formatIznos(ukupnoPdv)}
            naziv="PDV ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<CreditCard size={16} />}
            vrijednost={formatIznos(ukupnoRabat)}
            naziv="Rabat ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Calendar size={16} />}
            vrijednost={formatIznos(ukupnoVrijednost)}
            naziv="Vrijednost ukupno"
            boja={ACCENT}
          />
        </div>
      )}

      {loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {greska && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          <button
            type="button"
            onClick={ucitaj}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {!loading && !greska && redoviFiltrirano.length === 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
          <BookMarked size={28} />
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Nema podataka za izabrani period.
          </p>
        </div>
      )}

      {!loading && !greska && redoviFiltrirano.length > 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
          <div
            ref={jeVirtualizovano ? scrollRef : undefined}
            className="overflow-x-auto"
            style={
              jeVirtualizovano
                ? { maxHeight: "70vh", overflowY: "auto" }
                : undefined
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`border-b border-gray-100 dark:border-[#2d2648] ${jeVirtualizovano ? "sticky top-0 z-10" : ""}`}
                >
                  <TH>#</TH>
                  <TH>Datum</TH>
                  <TH>Broj računa</TH>
                  <TH>Partner</TH>
                  <TH>JIB / PIB</TH>
                  <TH>Entitet</TH>
                  <TH>Tip</TH>
                  <TH right>Vrijednost / Rabat</TH>
                  <TH right>Osnovica / PDV</TH>
                  <TH right>Ukupno</TH>
                </tr>
              </thead>
              <tbody>
                {jeVirtualizovano && visinaPrijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{
                        height: visinaPrijeRedova,
                        padding: 0,
                        border: "none",
                      }}
                    />
                  </tr>
                )}
                {vidljiviRedovi.map((r) => (
                  <tr
                    key={r.sifra_kif}
                    className="border-b border-gray-50 dark:border-[#2d2648] hover:bg-[#faf9fc] dark:hover:bg-[#1e1a2d] transition-colors"
                  >
                    <TD>{r.sifra_kif}</TD>
                    <TD>
                      <span title={formatDatumVrijemeDMY(r.datum_unosa) ?? undefined}>
                        {formatDatumDMY(r.datum_racuna) ?? "—"}
                      </span>
                    </TD>
                    <TD>
                      <div className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {r.broj_racuna}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {r.vrsta_racuna}
                        {r.vrsta_racuna_pod ? ` · ${r.vrsta_racuna_pod}` : ""}
                      </div>
                    </TD>
                    <TD>
                      <div className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {r.naziv_partnera}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {[r.adresa_partnera, r.naziv_grada]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </TD>
                    <TD>
                      <div>{formatSifru(r.jib)}</div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {formatSifru(r.pib)}
                      </div>
                    </TD>
                    <TD>{r.entitet || "—"}</TD>
                    <TD>{r.el_kif_tip || "—"}</TD>
                    <TD right>
                      <div className="font-bold" style={{ color: PRIMARY }}>
                        {formatIznos(r.vrednost)}
                      </div>
                      <RabatVrijednost iznos={r.rabat_km} />
                    </TD>
                    <TD right>
                      <div>{formatIznos(r.osnova_za_obracun_pdv)}</div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        {formatIznos(r.pdv)}
                      </div>
                    </TD>
                    <TD right bold>
                      {formatIznos(r.ukupno)}
                    </TD>
                  </tr>
                ))}
                {jeVirtualizovano && visinaPoslijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{
                        height: visinaPoslijeRedova,
                        padding: 0,
                        border: "none",
                      }}
                    />
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                  <TD bold>Ukupno</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD>{""}</TD>
                  <TD right>
                    <div className="font-bold" style={{ color: PRIMARY }}>
                      {formatIznos(ukupnoVrijednost)}
                    </div>
                    <RabatVrijednost iznos={ukupnoRabat} />
                  </TD>
                  <TD right>
                    <div className="font-bold">{formatIznos(ukupnoOsnovica)}</div>
                    <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                      {formatIznos(ukupnoPdv)}
                    </div>
                  </TD>
                  <TD right bold>
                    {formatIznos(ukupnoUkupno)}
                  </TD>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
