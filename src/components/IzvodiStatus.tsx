import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Landmark,
  Loader2,
  Lock,
  LockOpen,
  RotateCcw,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// NAPOMENA: status se čita iz erp.izvodi_pregled (zadnji izvod svake banke).
// Otvaranje (POST /api/izvodi/otvori) zove erp.izvod_otvaranje() koja još
// nije napravljena u bazi; zatvaranje izvoda i unos stavki su sljedeći korak.

interface ZadnjiIzvod {
  redni_broj: number;
  sifra_izvoda: number | string;
  datum_izvoda: string | null;
  status: "otvoren" | "zatvoren";
  pocetno_stanje: number;
  krajnje_stanje: number | null;
  tekuce_uplate: number;
  tekuce_isplate: number;
  tekuci_obracun: number;
  izvod_unos_otvoren: string | null;
  izvod_unos_zatvoren: string | null;
}

interface BankaStatus {
  sifra_banke: number | string;
  naziv_banke: string;
  broj_racuna: string | null;
  vrsta_racuna: string | null;
  broj_otvorenih: number;
  zadnji_izvod: ZadnjiIzvod | null;
}

const fmtDatum = (dt: string | null) => {
  if (!dt) return "–";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const fmtDatumVrijeme = (dt: string | null) => {
  if (!dt) return "–";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return `${fmtDatum(dt)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtKM = (n: number) =>
  n.toLocaleString("bs-BA", { minimumFractionDigits: 2 }) + " KM";

const danasISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Početno stanje novog izvoda = krajnje stanje zadnjeg izvoda te banke.
const pocetnoNovog = (b: BankaStatus) =>
  b.zadnji_izvod
    ? (b.zadnji_izvod.krajnje_stanje ?? b.zadnji_izvod.tekuci_obracun)
    : 0;

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
      <div className="h-px bg-gray-100 dark:bg-[#2d2648] my-1.5" />
    )}
    <div className="flex items-center justify-between py-1">
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

function KarticaBanke({
  banka,
  onOtvori,
  onZatvori,
}: {
  banka: BankaStatus;
  onOtvori: (b: BankaStatus) => void;
  onZatvori: (b: BankaStatus) => void;
}) {
  const z = banka.zadnji_izvod;
  const otvoren = z?.status === "otvoren";

  return (
    <div
      className="bg-white dark:bg-[#261f38] rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col"
      style={{ borderColor: otvoren ? `${ACCENT}80` : "#e5e7eb" }}
    >
      {/* Zaglavlje banke */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
          <Landmark size={16} style={{ color: PRIMARY }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
            {banka.naziv_banke}
          </div>
          <div className="text-[11px] text-gray-400 dark:text-[#5f5878] truncate">
            Šifra banke {banka.sifra_banke}
            {banka.broj_racuna && String(banka.broj_racuna) !== "0" && (
              <> · {banka.broj_racuna}</>
            )}
          </div>
        </div>
        {z && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
            style={
              otvoren
                ? { background: "#e9f7df", color: ACCENT }
                : { background: "#f3f4f6", color: "#6b7280" }
            }
          >
            {otvoren ? <LockOpen size={10} /> : <Lock size={10} />}
            {otvoren ? "OTVOREN" : "ZATVOREN"}
          </span>
        )}
      </div>

      <div className="px-4 py-3 flex-1 flex flex-col gap-3">
        {banka.broj_otvorenih > 1 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>
              Banka ima {banka.broj_otvorenih} otvorena izvoda — provjerite u
              Pregledu izvoda.
            </span>
          </div>
        )}

        {!z ? (
          <p className="text-xs text-gray-400 dark:text-[#5f5878] text-center py-4">
            Za ovu banku još nije otvoren nijedan izvod.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-700 dark:text-[#c5bfd8]">
                Izvod #{z.sifra_izvoda}
              </span>
              <span className="text-xs text-gray-500 dark:text-[#7d7498]">
                {fmtDatum(z.datum_izvoda)}
              </span>
            </div>

            <div className="text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-[#5f5878]">
                  Unos otvoren
                </span>
                <span className="text-gray-600 dark:text-[#9e96b8]">
                  {fmtDatumVrijeme(z.izvod_unos_otvoren)}
                </span>
              </div>
              {/* Labela stoji i kod otvorenog izvoda (vrijednost prazna) —
                  da se vidi da unos još nije zatvoren. */}
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-[#5f5878]">
                  Unos zatvoren
                </span>
                <span className="text-gray-600 dark:text-[#9e96b8]">
                  {otvoren ? "" : fmtDatumVrijeme(z.izvod_unos_zatvoren)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-3 py-2">
              <div
                className="text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: otvoren ? PRIMARY : "#9ca3af" }}
              >
                {otvoren ? (
                  "Tekući obračun"
                ) : (
                  <>
                    Zaključni obračun za dan{" "}
                    <span style={{ color: PRIMARY }}>
                      {fmtDatum(z.datum_izvoda)}
                    </span>
                  </>
                )}
              </div>
              <RedIznos label="Početno stanje" iznos={z.pocetno_stanje} />
              <RedIznos
                label="+ Uplate"
                iznos={z.tekuce_uplate}
                color={ACCENT}
              />
              <RedIznos
                label="− Isplate"
                iznos={z.tekuce_isplate}
                color="#ef4444"
              />
              <RedIznos
                label={otvoren ? "Obračunato stanje" : "Krajnje stanje"}
                iznos={
                  otvoren
                    ? z.tekuci_obracun
                    : (z.krajnje_stanje ?? z.tekuci_obracun)
                }
                color={PRIMARY}
                large
                separator
              />
            </div>
          </>
        )}

        <div className="mt-auto">
          {otvoren ? (
            <button
              type="button"
              onClick={() => onZatvori(banka)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all hover:opacity-90"
              style={{
                borderColor: "#ef4444",
                color: "#ef4444",
                background: "#ef444408",
              }}
            >
              <Lock size={14} />
              Zatvori izvod
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOtvori(banka)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: PRIMARY }}
            >
              <LockOpen size={14} />
              Otvori novi izvod
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function IzvodiStatus() {
  const [banke, setBanke] = useState<BankaStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const [otvaranjeZa, setOtvaranjeZa] = useState<BankaStatus | null>(null);
  const [brojIzvoda, setBrojIzvoda] = useState("");
  const [datumIzvoda, setDatumIzvoda] = useState(danasISO());
  const [submitting, setSubmitting] = useState(false);
  const [greskaModal, setGreskaModal] = useState<string | null>(null);
  const [zatvaranjeZa, setZatvaranjeZa] = useState<BankaStatus | null>(null);

  const ucitaj = async () => {
    setLoading(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/status`, {
        credentials: "include",
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setBanke(d.banke ?? []);
    } catch (e: unknown) {
      setGreska(
        e instanceof Error ? e.message : "Greška pri učitavanju statusa izvoda",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ucitaj();
  }, []);

  const pokreniOtvaranje = (b: BankaStatus) => {
    const zadnjiBroj = Number(b.zadnji_izvod?.sifra_izvoda);
    setBrojIzvoda(Number.isFinite(zadnjiBroj) ? String(zadnjiBroj + 1) : "1");
    setDatumIzvoda(danasISO());
    setGreskaModal(null);
    setOtvaranjeZa(b);
  };

  const handleOtvori = async () => {
    if (!otvaranjeZa) return;
    const broj = parseInt(brojIzvoda, 10);
    if (!Number.isFinite(broj) || broj <= 0) {
      setGreskaModal("Unesite ispravan broj izvoda");
      return;
    }
    if (!datumIzvoda) {
      setGreskaModal("Unesite datum izvoda");
      return;
    }
    setSubmitting(true);
    setGreskaModal(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/otvori`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sifraBanke: otvaranjeZa.sifra_banke,
          sifraIzvoda: broj,
          datumIzvoda,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setOtvaranjeZa(null);
      await ucitaj();
    } catch (e: unknown) {
      setGreskaModal(
        e instanceof Error ? e.message : "Greška pri otvaranju izvoda",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pokreniZatvaranje = (b: BankaStatus) => {
    setGreskaModal(null);
    setZatvaranjeZa(b);
  };

  const handleZatvori = async () => {
    const izvod = zatvaranjeZa?.zadnji_izvod;
    if (!izvod) return;
    setSubmitting(true);
    setGreskaModal(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/zatvori`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redniBroj: izvod.redni_broj }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      setZatvaranjeZa(null);
      await ucitaj();
    } catch (e: unknown) {
      setGreskaModal(
        e instanceof Error ? e.message : "Greška pri zatvaranju izvoda",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const jeOtvoren = (b: BankaStatus) => b.zadnji_izvod?.status === "otvoren";

  const brojOtvorenih = banke.filter(jeOtvoren).length;

  // Otvoreni izvodi prvi, pa zatvoreni (i banke bez izvoda); unutar grupe
  // ostaje redoslijed iz erp.banke_pregled.
  const sortiraneBanke = [
    ...banke.filter(jeOtvoren),
    ...banke.filter((b) => !jeOtvoren(b)),
  ];

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Landmark size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Status izvoda
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Otvaranje izvoda i tekući obračun po banci
          </p>
        </div>
        {!loading && !greska && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={
              brojOtvorenih > 0
                ? { background: "#e9f7df", color: ACCENT }
                : { background: "#f3f4f6", color: "#6b7280" }
            }
          >
            <LockOpen size={11} />
            {brojOtvorenih} otvoren{brojOtvorenih === 1 ? "" : "ih"}
          </span>
        )}
        <button
          type="button"
          onClick={() => void ucitaj()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      <div
        className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
        style={{ background: `${PRIMARY}12`, color: PRIMARY }}
      >
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          Status se čita iz zadnjeg izvoda svake banke. Početno stanje novog
          izvoda preuzima se iz krajnjeg stanja prethodnog. Unos stavki
          dolazi u sljedećem koraku.
        </span>
      </div>

      {loading && banke.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2
            size={26}
            className="animate-spin"
            style={{ color: PRIMARY }}
          />
          <span className="text-sm text-gray-400 dark:text-[#5f5878]">
            Učitavanje statusa...
          </span>
        </div>
      ) : greska ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          <button
            type="button"
            onClick={() => void ucitaj()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
          >
            Pokušaj ponovo
          </button>
        </div>
      ) : banke.length === 0 ? (
        <p className="text-sm text-center text-gray-400 dark:text-[#5f5878] py-16">
          Nema banaka za prikaz.
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sortiraneBanke.map((b) => (
            <KarticaBanke
              key={b.sifra_banke}
              banka={b}
              onOtvori={pokreniOtvaranje}
              onZatvori={pokreniZatvaranje}
            />
          ))}
        </div>
      )}

      {/* Potvrda zatvaranja izvoda */}
      {zatvaranjeZa?.zadnji_izvod && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#ef444414" }}
              >
                <Lock size={18} style={{ color: "#ef4444" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  Zatvaranje izvoda — {zatvaranjeZa.naziv_banke}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-1">
                  Da li ste sigurni da želite zatvoriti izvod{" "}
                  <strong className="text-gray-700 dark:text-[#c5bfd8]">
                    #{zatvaranjeZa.zadnji_izvod.sifra_izvoda}
                  </strong>{" "}
                  od {fmtDatum(zatvaranjeZa.zadnji_izvod.datum_izvoda)}? Nakon
                  zatvaranja više se ne mogu unositi stavke na ovaj izvod.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 dark:border-[#2d2648] px-3 py-2">
              <RedIznos
                label="Početno stanje"
                iznos={zatvaranjeZa.zadnji_izvod.pocetno_stanje}
              />
              <RedIznos
                label="+ Uplate"
                iznos={zatvaranjeZa.zadnji_izvod.tekuce_uplate}
                color={ACCENT}
              />
              <RedIznos
                label="− Isplate"
                iznos={zatvaranjeZa.zadnji_izvod.tekuce_isplate}
                color="#ef4444"
              />
              <RedIznos
                label="Krajnje stanje"
                iznos={zatvaranjeZa.zadnji_izvod.tekuci_obracun}
                color={PRIMARY}
                large
                separator
              />
            </div>

            {greskaModal && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="flex-1">{greskaModal}</span>
                <button type="button" onClick={() => setGreskaModal(null)}>
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setZatvaranjeZa(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={handleZatvori}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "#ef4444" }}
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Lock size={13} />
                )}
                Da, zatvori izvod
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Otvaranje novog izvoda */}
      {otvaranjeZa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${PRIMARY}14` }}
              >
                <LockOpen size={18} style={{ color: PRIMARY }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  Otvaranje izvoda — {otvaranjeZa.naziv_banke}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-1">
                  Početno stanje:{" "}
                  <strong style={{ color: PRIMARY }}>
                    {fmtKM(pocetnoNovog(otvaranjeZa))}
                  </strong>
                  {otvaranjeZa.zadnji_izvod &&
                    ` (krajnje stanje izvoda #${otvaranjeZa.zadnji_izvod.sifra_izvoda})`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-[#7d7498] mb-1">
                  Broj izvoda
                </label>
                <input
                  type="number"
                  min={1}
                  value={brojIzvoda}
                  onChange={(e) => setBrojIzvoda(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6] font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-[#7d7498] mb-1">
                  Datum izvoda
                </label>
                <input
                  type="date"
                  value={datumIzvoda}
                  onChange={(e) => setDatumIzvoda(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]"
                />
              </div>
            </div>

            {greskaModal && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="flex-1">{greskaModal}</span>
                <button type="button" onClick={() => setGreskaModal(null)}>
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOtvaranjeZa(null)}
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
                Otvori izvod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
