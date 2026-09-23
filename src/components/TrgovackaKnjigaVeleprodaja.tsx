import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Loader2,
  Receipt,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.trgovacka_knjiga_veleprodaja(p_start_datum, p_kraj_datum).
interface TrgovackaKnjigaRed {
  rb: number;
  datum: string;
  broj_racuna: string | number;
  podaci_o_partneru: string | null;
  zaduzenje: number | string | null;
  razduzenje: number | string | null;
  rabat: number | string | null;
}

const formatIznos = (v: number | string | null | undefined) =>
  `${Number(v ?? 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/,/g, " ")} KM`;

// Formatira lokalni datum kao yyyy-MM-dd (bez prolaska kroz UTC).
const formatDatumISO = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const prviDanMjeseca = () => {
  const d = new Date();
  return formatDatumISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => formatDatumISO(new Date());

const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

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

export function TrgovackaKnjigaVeleprodaja() {
  const [datumOd, setDatumOd] = useState(prviDanMjeseca());
  const [datumDo, setDatumDo] = useState(danas());
  const [redovi, setRedovi] = useState<TrgovackaKnjigaRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const datumOdRef = useRef<HTMLInputElement>(null);
  const datumDoRef = useRef<HTMLInputElement>(null);

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
    if (!datumOd || !datumDo) return;
    setLoading(true);
    setGreska(null);
    fetch(
      `${API_URL}/api/trgovacke-knjige/veleprodaja?datumOd=${datumOd}&datumDo=${datumDo}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju trgovačke knjige");
        return res.json();
      })
      .then((json) => setRedovi(json.data ?? []))
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return redovi;
    return redovi.filter(
      (r) =>
        String(r.broj_racuna).toLowerCase().includes(q) ||
        (r.podaci_o_partneru ?? "").toLowerCase().includes(q),
    );
  }, [redovi, pretraga]);

  const ukupnoZaduzenje = useMemo(
    () => redovi.reduce((s, r) => s + (Number(r.zaduzenje) || 0), 0),
    [redovi],
  );
  const ukupnoRazduzenje = useMemo(
    () => redovi.reduce((s, r) => s + (Number(r.razduzenje) || 0), 0),
    [redovi],
  );
  const ukupnoRabat = useMemo(
    () => redovi.reduce((s, r) => s + (Number(r.rabat) || 0), 0),
    [redovi],
  );

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <BookOpen size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Trgovačka knjiga — Veleprodaja
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Zaduženja, razduženja i rabat za izabrani period
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
            onClick={ucitaj}
            disabled={loading || !datumOd || !datumDo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
          </button>

          <div className="relative w-72 ml-auto">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraga po broju računa ili partneru..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
        </div>
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<TrendingUp size={16} />}
            vrijednost={formatIznos(ukupnoZaduzenje)}
            naziv="Ukupno zaduženje"
            boja={ACCENT}
          />
          <StatTile
            icon={<TrendingDown size={16} />}
            vrijednost={formatIznos(ukupnoRazduzenje)}
            naziv="Ukupno razduženje"
            boja="#ef4444"
          />
          <StatTile
            icon={<Receipt size={16} />}
            vrijednost={formatIznos(ukupnoRabat)}
            naziv="Ukupno rabat"
            boja={PRIMARY}
          />
        </div>
      )}

      {/* Tabela */}
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

        {!loading && !greska && filtrirani.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
            <BookOpen size={28} />
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              {pretraga.trim()
                ? "Nema rezultata za tu pretragu."
                : "Nema podataka za izabrani period."}
            </p>
          </div>
        )}

        {!loading && !greska && filtrirani.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: `${PRIMARY}1f` }}>
                  <th
                    className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: PRIMARY }}
                  >
                    Rb
                  </th>
                  <th
                    className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: PRIMARY }}
                  >
                    Datum
                  </th>
                  <th
                    className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: PRIMARY }}
                  >
                    Broj računa
                  </th>
                  <th
                    className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: PRIMARY }}
                  >
                    Partner
                  </th>
                  <th
                    className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: ACCENT }}
                  >
                    Zaduženje
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-red-500">
                    Razduženje
                  </th>
                  <th
                    className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: PRIMARY }}
                  >
                    Rabat
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r, idx) => (
                  <tr
                    key={r.rb}
                    className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                      idx % 2 === 1 ? "bg-[#faf9fc] dark:bg-[#221c34]" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648]">
                      {r.rb}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                      {formatDatumDMY(r.datum) ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                      {r.broj_racuna}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                      {r.podaci_o_partneru ?? "–"}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-semibold border-t border-gray-50 dark:border-[#2d2648]"
                      style={{ color: ACCENT }}
                    >
                      {Number(r.zaduzenje) ? formatIznos(r.zaduzenje) : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-red-500 border-t border-gray-50 dark:border-[#2d2648]">
                      {Number(r.razduzenje) ? formatIznos(r.razduzenje) : ""}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                      {Number(r.rabat) ? formatIznos(r.rabat) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !greska && filtrirani.length > 0 && (
          <p className="px-4 py-2.5 text-xs text-gray-400 dark:text-[#5f5878] border-t border-gray-100 dark:border-[#2d2648]">
            Prikazano {filtrirani.length} / {redovi.length} stavki
          </p>
        )}
      </div>
    </div>
  );
}
