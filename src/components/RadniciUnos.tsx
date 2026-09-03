import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  UserPlus,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface PostojeciRadnik {
  radnik_id: number;
  naziv_radnika: string;
  oznaka: string | null;
}

// Šifarnik vrsta_radnika u novoj bazi (erp.radnici_unos) — isto kao
// docs/radnici_vrste_radnika.txt, uz dodatu vrijednost 0 = Ostalo (default
// kolone u novoj tabeli).
const VRSTA_RADNIKA_OPTIONS = [
  { value: "0", label: "Ostalo" },
  { value: "1", label: "Vlasnik" },
  { value: "2", label: "Komercijala" },
  { value: "3", label: "Kancelarija" },
  { value: "4", label: "Proizvodnja kesa" },
  { value: "5", label: "Proizvodnja kutija" },
  { value: "6", label: "Magacin" },
  { value: "7", label: "Vozač" },
  { value: "10", label: "Spoljni saradnik" },
];

// Šifarnik status_radnika u novoj bazi (erp.radnici_unos) — različit od
// starog "zaposlenik" (1/0/-1/2/3) iz erp.radnici_unos_staro.
const STATUS_RADNIKA_OPTIONS = [
  { value: "1", label: "Zaposlen" },
  { value: "0", label: "Nije zaposlen" },
  { value: "4", label: "Osnivač" },
  { value: "2", label: "Zaposleni spoljni saradnik" },
  { value: "3", label: "Spoljni saradnik koji više ne sarađuje" },
];

// aktivan (nova baza) se izvodi iz status_radnika — 1 za statuse koji znače
// da radnik trenutno radi/sarađuje, 0 za neaktivne.
const AKTIVNI_STATUS_RADNIKA = new Set([1, 2, 4]);

// Vrijednosti koje se koriste kao placeholder za "nema kartice" kod postojećih
// radnika — ne treba ih tretirati kao zauzetu oznaku pri provjeri duplikata.
const PRAZNE_OZNAKE = new Set(["", "-", "0"]);

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

const praznaForma = () => ({
  naziv: "",
  lozinka: "",
  oznaka: "",
  vrstaRadnika: "",
  statusRadnika: "1",
});

export function RadniciUnos() {
  const [forma, setForma] = useState(praznaForma());
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [cuvanje, setCuvanje] = useState(false);

  const [postojeciRadnici, setPostojeciRadnici] = useState<
    PostojeciRadnik[]
  >([]);

  const ucitajPostojeceRadnike = () => {
    fetch(`${API_URL}/api/radnici/pregled-sve`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setPostojeciRadnici(json.data ?? []))
      .catch(() => setPostojeciRadnici([]));
  };

  useEffect(() => {
    ucitajPostojeceRadnike();
  }, []);

  const nazivDuplikat = useMemo(() => {
    const q = forma.naziv.trim().toLowerCase();
    if (!q) return null;
    return (
      postojeciRadnici.find(
        (r) => r.naziv_radnika?.trim().toLowerCase() === q,
      ) ?? null
    );
  }, [forma.naziv, postojeciRadnici]);

  const oznakaDuplikat = useMemo(() => {
    const q = forma.oznaka.trim();
    if (PRAZNE_OZNAKE.has(q)) return null;
    return postojeciRadnici.find((r) => r.oznaka?.trim() === q) ?? null;
  }, [forma.oznaka, postojeciRadnici]);

  const setPolje = (polje: keyof ReturnType<typeof praznaForma>, v: string) =>
    setForma((f) => ({ ...f, [polje]: v }));

  const handleSacuvaj = async () => {
    setGreska(null);

    if (!forma.naziv.trim()) {
      setGreska("Naziv radnika je obavezan");
      return;
    }
    if (!forma.lozinka.trim()) {
      setGreska("Lozinka je obavezna");
      return;
    }
    if (!forma.vrstaRadnika) {
      setGreska("Vrsta radnika je obavezna");
      return;
    }
    if (nazivDuplikat) {
      setGreska(
        `Radnik sa nazivom "${forma.naziv.trim()}" već postoji (#${nazivDuplikat.radnik_id})`,
      );
      return;
    }
    if (oznakaDuplikat) {
      setGreska(
        `Oznaka "${forma.oznaka.trim()}" je već dodijeljena radniku: ${oznakaDuplikat.naziv_radnika}`,
      );
      return;
    }

    const statusRadnika = Number(forma.statusRadnika);
    const payload = {
      naziv_radnika: forma.naziv.trim(),
      lozinka: forma.lozinka.trim(),
      oznaka: forma.oznaka.trim() || "-",
      vrsta_radnika: Number(forma.vrstaRadnika),
      status_radnika: statusRadnika,
      aktivan: AKTIVNI_STATUS_RADNIKA.has(statusRadnika) ? 1 : 0,
    };

    setCuvanje(true);
    try {
      const res = await fetch(`${API_URL}/api/radnici/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu radnika");
      }
      setUspjeh(`Radnik "${payload.naziv_radnika}" je sačuvan.`);
      setForma(praznaForma());
      ucitajPostojeceRadnike();
    } catch (err) {
      setGreska(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <UserPlus size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Unos radnika
        </h2>
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Naziv radnika *">
            <input
              type="text"
              value={forma.naziv}
              onChange={(e) => setPolje("naziv", e.target.value)}
              placeholder="Ime i prezime"
              className={inputClass}
            />
            {nazivDuplikat && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertTriangle size={11} />
                Već postoji (#{nazivDuplikat.radnik_id})
              </p>
            )}
          </Field>

          <Field label="Lozinka *">
            <input
              type="text"
              value={forma.lozinka}
              onChange={(e) => setPolje("lozinka", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Oznaka (125kHz kartica)">
            <input
              type="text"
              value={forma.oznaka}
              onChange={(e) => setPolje("oznaka", e.target.value)}
              placeholder="Prislonite karticu na čitač ili ostavite prazno"
              className={inputClass}
            />
            {oznakaDuplikat && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertTriangle size={11} />
                Već dodijeljena: {oznakaDuplikat.naziv_radnika}
              </p>
            )}
          </Field>

          <Field label="Vrsta radnika *">
            <select
              value={forma.vrstaRadnika}
              onChange={(e) => setPolje("vrstaRadnika", e.target.value)}
              className={inputClass}
            >
              <option value="">Izaberite vrstu</option>
              {VRSTA_RADNIKA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={forma.statusRadnika}
              onChange={(e) => setPolje("statusRadnika", e.target.value)}
              className={inputClass}
            >
              {STATUS_RADNIKA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <button
        onClick={() => void handleSacuvaj()}
        disabled={cuvanje}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: PRIMARY }}
      >
        {cuvanje ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <UserPlus size={15} />
        )}
        Sačuvaj radnika
      </button>

      {uspjeh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={40} style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {uspjeh}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setUspjeh(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {greska && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-red-300 p-6">
            <div className="flex justify-center mb-3">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <p className="text-base font-semibold text-red-700 dark:text-red-400 text-center">
              {greska}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setGreska(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
