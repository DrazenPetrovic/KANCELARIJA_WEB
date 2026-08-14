import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Landmark,
  Loader2,
  Receipt,
  RefreshCcw,
  Search,
  Wallet,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red iz erp.izvodi_pregled.
interface IzvodRed {
  redni_broj: number;
  sifra_izvoda: number | string;
  sifra_banke: number | string;
  ukupno_uplata: number | string | null;
  ukupno_isplata: number | string | null;
  izvod_zatvoren: number | string | null;
  datum_izvoda: string | null;
  pocetno_stanje: number | string | null;
  krajnje_stanje: number | string | null;
  sifra_knjizenja: number | string | null;
  naziv_banke: string | null;
  vrsta_racuna: string | number | null;
  izvod_unos_otvoren: string | number | null;
  izvod_unos_zatvoren: string | number | null;
}

// Red iz erp.izvodi_uplate_pregled — sifra_blagajne se poklapa sa
// redni_broj iz izvodi_pregled.
interface UplataRed {
  sifra_uplate: number;
  vrsta_uplate: string | number | null;
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
  datum_uplate: string | null;
  vreme_uplate: string | null;
  uplaceno: number | string | null;
  opis: string | null;
  napomena: string | null;
  sifra_radnika: number | string | null;
  Naziv_radnika: string | null;
  gotovinska_uplata: number | string | null;
  sifra_blagajne: number | string;
}

// Red iz erp.banke_pregled.
interface BankaRed {
  sifra_banke: number;
  naziv_banke: string;
  broj_racuna: string | null;
  vrsta_racuna: string | null;
}

// 1000 -> "1 000.00", 1000000 -> "1 000 000.00" — razmak kao separator hiljada.
function formatBroj(n: number) {
  const [cijeliDio, decimalniDio] = n.toFixed(2).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const saSeparatorom = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negativan ? "-" : ""}${saSeparatorom}.${decimalniDio}`;
}

// Šifarnik vrsta_uplate — "uplata" = novac ulazi (zeleno), "isplata" = novac
// izlazi (crveno).
const VRSTA_UPLATE: Record<number, { naziv: string; tip: "uplata" | "isplata" }> = {
  0: { naziv: "Dugovanja kupcu", tip: "isplata" },
  1: { naziv: "Uplate kupaca", tip: "uplata" },
  2: { naziv: "Uplata dobavljačima (kalk)", tip: "isplata" },
  3: { naziv: "Uplata (KUF)", tip: "isplata" },
  4: { naziv: "Dugovanja (dobavljaču)", tip: "isplata" },
  5: { naziv: "Davanje pozajmice", tip: "isplata" },
  6: { naziv: "Vraćanje date pozajmice", tip: "uplata" },
  7: { naziv: "Primanje pozajmice", tip: "uplata" },
  8: { naziv: "Vraćanje primljene pozajmice", tip: "isplata" },
  9: { naziv: "Povrat pretplate dobavljaču", tip: "isplata" },
  10: { naziv: "Prijem pretplate (povrat od kupca)", tip: "uplata" },
  11: { naziv: "Prijem pretplate dobavljača", tip: "uplata" },
  12: { naziv: "Povrat pretplate kupcu", tip: "isplata" },
};

function vrstaUplateInfo(v: string | number | null | undefined) {
  const kod = Number(v);
  return (
    VRSTA_UPLATE[kod] ?? {
      naziv: v === null || v === undefined || v === "" ? "–" : String(v),
      tip: "uplata" as const,
    }
  );
}

function formatKM(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return "–";
  return `${formatBroj(n)} KM`;
}

function formatDatum(v: string | null | undefined) {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
}

// izvod_unos_otvoren / izvod_unos_zatvoren — datum i vrijeme otvaranja/zatvaranja unosa.
function formatDatumVrijeme(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}:${ss}`;
}

function IzvodStatusBadge({ v }: { v: number | string | null }) {
  const zatvoren = Number(v) === 1;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={
        zatvoren
          ? { background: "#9ca3af26", color: "#6b7280" }
          : { background: `${ACCENT}26`, color: ACCENT }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: zatvoren ? "#6b7280" : ACCENT }}
      />
      {zatvoren ? "Zatvoren" : "Otvoren"}
    </span>
  );
}

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string | number;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3 flex-1 min-w-[150px]">
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

export function IzvodiPregled() {
  const [izvodi, setIzvodi] = useState<IzvodRed[]>([]);
  const [uplate, setUplate] = useState<UplataRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const [pretraga, setPretraga] = useState("");
  const [prosireno, setProsireno] = useState<Set<number>>(new Set());
  const [banke, setBanke] = useState<BankaRed[]>([]);
  const [filterBanka, setFilterBanka] = useState<string>("");

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/izvodi/pregled-sa-uplatama`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju izvoda");
        return res.json();
      })
      .then((json) => {
        setIzvodi(json.izvodi ?? []);
        setUplate(json.uplate ?? []);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  useEffect(() => {
    fetch(`${API_URL}/api/banke/pregled`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setBanke(json.data ?? []))
      .catch(() => setBanke([]));
  }, []);

  // Uplate grupisane po sifra_blagajne — poklapa se sa redni_broj izvoda.
  const uplatePoIzvodu = useMemo(() => {
    const map = new Map<string, UplataRed[]>();
    uplate.forEach((u) => {
      const kljuc = String(u.sifra_blagajne);
      const niz = map.get(kljuc) ?? [];
      niz.push(u);
      map.set(kljuc, niz);
    });
    return map;
  }, [uplate]);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    return izvodi.filter((i) => {
      const odgovaraBanci =
        !filterBanka || String(i.sifra_banke) === filterBanka;
      if (!odgovaraBanci) return false;
      if (!q) return true;
      return (
        String(i.sifra_izvoda).includes(q) ||
        String(i.redni_broj).includes(q) ||
        (i.naziv_banke ?? "").toLowerCase().includes(q)
      );
    });
  }, [izvodi, pretraga, filterBanka]);

  const sortirani = useMemo(
    () => [...filtrirani].sort((a, b) => b.redni_broj - a.redni_broj),
    [filtrirani],
  );

  const brojOtvorenih = useMemo(
    () => izvodi.filter((i) => Number(i.izvod_zatvoren) !== 1).length,
    [izvodi],
  );
  const sumaUplata = useMemo(
    () => izvodi.reduce((acc, i) => acc + (Number(i.ukupno_uplata) || 0), 0),
    [izvodi],
  );
  const sumaIsplata = useMemo(
    () => izvodi.reduce((acc, i) => acc + (Number(i.ukupno_isplata) || 0), 0),
    [izvodi],
  );

  const prekidacProsirenja = (redniBroj: number) => {
    setProsireno((prev) => {
      const novi = new Set(prev);
      if (novi.has(redniBroj)) novi.delete(redniBroj);
      else novi.add(redniBroj);
      return novi;
    });
  };

  const prosiriSve = () =>
    setProsireno(new Set(sortirani.map((i) => i.redni_broj)));
  const skupiSve = () => setProsireno(new Set());
  const sveProsireno =
    sortirani.length > 0 && prosireno.size >= sortirani.length;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Landmark size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Pregled izvoda
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Bankovni izvodi i uplate po izvodu
          </p>
        </div>
        <button
          type="button"
          onClick={ucitaj}
          disabled={loading}
          title="Osvježi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<Receipt size={16} />}
            vrijednost={izvodi.length}
            naziv="Izvoda ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Landmark size={16} />}
            vrijednost={brojOtvorenih}
            naziv="Otvorenih izvoda"
            boja={brojOtvorenih > 0 ? "#f59e0b" : "#9ca3af"}
          />
          <StatTile
            icon={<Wallet size={16} />}
            vrijednost={formatKM(sumaUplata)}
            naziv="Ukupno uplata"
            boja={ACCENT}
          />
          <StatTile
            icon={<Wallet size={16} />}
            vrijednost={formatKM(sumaIsplata)}
            naziv="Ukupno isplata"
            boja="#ef4444"
          />
        </div>
      )}

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraga po šifri izvoda ili banci..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={filterBanka}
            onChange={(e) => setFilterBanka(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
          >
            <option value="">Sve banke</option>
            {banke.map((b) => (
              <option key={b.sifra_banke} value={String(b.sifra_banke)}>
                {b.naziv_banke}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={sveProsireno ? skupiSve : prosiriSve}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
          >
            {sveProsireno ? (
              <ChevronsDownUp size={14} />
            ) : (
              <ChevronsUpDown size={14} />
            )}
            {sveProsireno ? "Skupi sve" : "Proširi sve"}
          </button>
        </div>

        {!loading && !greska && (
          <p className="mt-3 text-xs text-gray-400 dark:text-[#5f5878]">
            Prikazano {sortirani.length} / {izvodi.length} izvoda
          </p>
        )}
      </div>

      {/* Lista izvoda */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: PRIMARY }}
            />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">
              Učitavanje...
            </span>
          </div>
        )}

        {greska && (
          <div className="flex flex-col items-center justify-center gap-2 py-20">
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

        {!loading && !greska && sortirani.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
            <Landmark size={28} />
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              {pretraga.trim()
                ? "Nema rezultata za tu pretragu."
                : "Nema izvoda za prikaz."}
            </p>
          </div>
        )}

        {!loading &&
          !greska &&
          sortirani.map((izvod, i) => {
            const otvoreno = prosireno.has(izvod.redni_broj);
            const uplateIzvoda =
              uplatePoIzvodu.get(String(izvod.redni_broj)) ?? [];
            return (
              <div
                key={izvod.redni_broj}
                className={`border-b last:border-b-0 ${
                  otvoreno
                    ? "border-l-4 border-gray-100 dark:border-[#2d2648]"
                    : `border-gray-100 dark:border-[#2d2648] ${i % 2 === 1 ? "bg-[#faf9fc] dark:bg-[#221c34]" : ""}`
                }`}
                style={otvoreno ? { borderLeftColor: PRIMARY } : undefined}
              >
                <button
                  type="button"
                  onClick={() => prekidacProsirenja(izvod.redni_broj)}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    otvoreno
                      ? "bg-[#e3d9f7] dark:bg-[#3d3163] hover:bg-[#dbcdf3] dark:hover:bg-[#463a70]"
                      : "hover:bg-purple-50/60 dark:hover:bg-[#271f40]/60"
                  }`}
                >
                  <ChevronRight
                    size={14}
                    className="transition-transform duration-200 flex-shrink-0"
                    style={{
                      color: PRIMARY,
                      transform: otvoreno ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                    <Landmark size={14} style={{ color: PRIMARY }} />
                  </div>
                  <div className="min-w-0 w-48 flex-shrink-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      {izvod.naziv_banke ?? `Banka #${izvod.sifra_banke}`}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                      {izvod.redni_broj}
                    </div>
                  </div>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none whitespace-nowrap">
                    <div className="text-base font-bold text-gray-800 dark:text-[#ede9f6]">
                      Izvod #{izvod.sifra_izvoda}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                      {formatDatum(izvod.datum_izvoda)}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 dark:text-[#9e96b8] flex-shrink-0">
                    <div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        Početno
                      </div>
                      <div className="font-semibold">
                        {formatKM(izvod.pocetno_stanje)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        Uplata
                      </div>
                      <div className="font-semibold" style={{ color: ACCENT }}>
                        {formatKM(izvod.ukupno_uplata)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        Isplata
                      </div>
                      <div className="font-semibold text-red-500">
                        {formatKM(izvod.ukupno_isplata)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                        Krajnje
                      </div>
                      <div className="font-semibold" style={{ color: PRIMARY }}>
                        {formatKM(izvod.krajnje_stanje)}
                      </div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <div className="hidden lg:flex flex-col items-end leading-tight text-[10px]">
                      <span className="text-green-600 dark:text-green-400">
                        Otvoren: {formatDatumVrijeme(izvod.izvod_unos_otvoren)}
                      </span>
                      <span className="text-red-500 dark:text-red-400">
                        Zatvoren: {formatDatumVrijeme(izvod.izvod_unos_zatvoren)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ede8f5] dark:bg-[#312a50]" style={{ color: PRIMARY }}>
                      {uplateIzvoda.length} uplata
                    </span>
                    <IzvodStatusBadge v={izvod.izvod_zatvoren} />
                  </div>
                </button>

                {otvoreno && (
                  <div className="px-4 pb-3">
                    {uplateIzvoda.length === 0 ? (
                      <div className="flex items-center justify-center gap-1.5 py-6 text-gray-400 dark:text-[#5f5878]">
                        <Wallet size={16} className="text-gray-300 dark:text-[#3a3158]" />
                        <span className="text-xs">Nema uplata za ovaj izvod</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-[#2d2648]">
                        <table className="w-full">
                          <thead>
                            <tr style={{ background: `${PRIMARY}1f` }}>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Partner
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Datum
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: ACCENT }}>
                                Uplate
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-red-500">
                                Isplate
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Opis / napomena
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Vrsta
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {uplateIzvoda.map((u, idx) => {
                              const vrsta = vrstaUplateInfo(u.vrsta_uplate);
                              const boja = vrsta.tip === "isplata" ? "#ef4444" : ACCENT;
                              return (
                              <tr
                                key={u.sifra_uplate}
                                className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                                  idx % 2 === 1
                                    ? "bg-[#f4f1f9]/60 dark:bg-[#241d3a]/40"
                                    : ""
                                }`}
                              >
                                <td className="px-3 py-2 text-sm text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                  {u.naziv_partnera ?? `Partner #${u.sifra_partnera}`}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                                  {formatDatum(u.datum_uplate)}
                                </td>
                                <td className="px-3 py-2 text-sm text-right font-semibold border-t border-gray-50 dark:border-[#2d2648]" style={{ color: ACCENT }}>
                                  {vrsta.tip === "uplata" ? formatKM(u.uplaceno) : ""}
                                </td>
                                <td className="px-3 py-2 text-sm text-right font-semibold text-red-500 border-t border-gray-50 dark:border-[#2d2648]">
                                  {vrsta.tip === "isplata" ? formatKM(u.uplaceno) : ""}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                  {[u.opis, u.napomena].filter(Boolean).join(" · ") || "–"}
                                </td>
                                <td className="px-3 py-2 text-sm text-right font-medium border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap" style={{ color: boja }}>
                                  {vrsta.naziv} ({u.vrsta_uplate})
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
