import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface Partner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
}

// Red kartice partnera (izvod stanja duguje/potražuje po dokumentima).
interface KarticaStavka {
  datum: string;
  vrsta_dokumenta: string;
  broj_dokumenta: string | null;
  opis: string | null;
  duguje: number | null;
  potrazuje: number | null;
  saldo: number | null;
}

function formatIznos(v: number | null | undefined) {
  if (v === null || v === undefined) return "–";
  return `${Number(v).toFixed(2)} KM`;
}

function formatDatum(v: string) {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
}

function prijeMjesecDana() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function danas() {
  return new Date().toISOString().slice(0, 10);
}

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

export function KarticaPartnera() {
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [partneriLoading, setPartneriLoading] = useState(true);

  const [pretraga, setPretraga] = useState("");
  const [pokaziDropdown, setPokaziDropdown] = useState(false);
  const [odabraniPartner, setOdabraniPartner] = useState<Partner | null>(
    null,
  );
  const searchRef = useRef<HTMLDivElement>(null);

  const [od, setOd] = useState(prijeMjesecDana());
  const [do_, setDo] = useState(danas());

  const [stavke, setStavke] = useState<KarticaStavka[]>([]);
  const [pocetnoStanje, setPocetnoStanje] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [ucitanoBar1x, setUcitanoBar1x] = useState(false);

  useEffect(() => {
    setPartneriLoading(true);
    fetch(`${API_URL}/api/partneri/lista-sve`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju partnera");
        return res.json();
      })
      .then((json) => setPartneri(json.data ?? json ?? []))
      .catch(() => setPartneri([]))
      .finally(() => setPartneriLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setPokaziDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return [];
    return partneri
      .filter(
        (p) =>
          p.naziv?.toLowerCase().includes(q) ||
          p.skraceni_naziv?.toLowerCase().includes(q) ||
          String(p.partner_id).includes(q),
      )
      .slice(0, 30);
  }, [partneri, pretraga]);

  const odaberiPartnera = (p: Partner) => {
    setOdabraniPartner(p);
    setPretraga("");
    setPokaziDropdown(false);
  };

  const ocistiPartnera = () => {
    setOdabraniPartner(null);
    setStavke([]);
    setPocetnoStanje(null);
    setGreska(null);
    setUcitanoBar1x(false);
  };

  const ucitajKarticu = () => {
    if (!odabraniPartner) return;
    setLoading(true);
    setGreska(null);
    fetch(
      `${API_URL}/api/partneri/${odabraniPartner.partner_id}/kartica?od=${od}&do=${do_}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju kartice partnera");
        return res.json();
      })
      .then((json) => {
        setStavke(json.data ?? []);
        setPocetnoStanje(
          typeof json.pocetno_stanje === "number" ? json.pocetno_stanje : null,
        );
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => {
        setLoading(false);
        setUcitanoBar1x(true);
      });
  };

  useEffect(() => {
    if (odabraniPartner) ucitajKarticu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odabraniPartner]);

  const ukupnoDuguje = useMemo(
    () => stavke.reduce((zbir, s) => zbir + (s.duguje ?? 0), 0),
    [stavke],
  );
  const ukupnoPotrazuje = useMemo(
    () => stavke.reduce((zbir, s) => zbir + (s.potrazuje ?? 0), 0),
    [stavke],
  );
  const konacnoStanje =
    stavke.length > 0
      ? stavke[stavke.length - 1].saldo
      : pocetnoStanje;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <CreditCard size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Kartica partnera
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Pregled stanja duguje/potražuje po partneru
          </p>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
              Partner
            </label>
            <div ref={searchRef} className="relative">
              {partneriLoading ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              )}
              <input
                value={
                  odabraniPartner
                    ? (odabraniPartner.skraceni_naziv ?? odabraniPartner.naziv)
                    : pretraga
                }
                onChange={(e) => {
                  setOdabraniPartner(null);
                  setPretraga(e.target.value);
                  setPokaziDropdown(true);
                }}
                onFocus={() => {
                  if (odabraniPartner) return;
                  if (pretraga.length >= 1) setPokaziDropdown(true);
                }}
                placeholder={
                  partneriLoading ? "Učitavanje..." : "Pretraži partnera..."
                }
                disabled={partneriLoading}
                className="pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
              />
              {odabraniPartner && (
                <button
                  type="button"
                  onClick={ocistiPartnera}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#c5bfd8]"
                >
                  <X size={14} />
                </button>
              )}

              {pokaziDropdown && filtrirani.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {filtrirani.map((p) => (
                    <button
                      key={p.partner_id}
                      type="button"
                      onMouseDown={() => odaberiPartnera(p)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
                    >
                      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                        <User size={13} style={{ color: PRIMARY }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                          {p.naziv}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-[#7d7498] flex items-center gap-1">
                          <MapPin size={10} /> ID: {p.partner_id}
                          {p.skraceni_naziv ? ` · ${p.skraceni_naziv}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {pokaziDropdown &&
                pretraga.length >= 1 &&
                filtrirani.length === 0 &&
                !partneriLoading && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500 dark:text-[#7d7498]">
                    Nema rezultata za „{pretraga}"
                  </div>
                )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
              Od
            </label>
            <input
              type="date"
              value={od}
              onChange={(e) => setOd(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
              Do
            </label>
            <input
              type="date"
              value={do_}
              onChange={(e) => setDo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
            />
          </div>

          <button
            type="button"
            onClick={ucitajKarticu}
            disabled={!odabraniPartner || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
          </button>
        </div>
      </div>

      {!odabraniPartner && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
          <Users size={28} />
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Odaberite partnera da biste prikazali karticu.
          </p>
        </div>
      )}

      {odabraniPartner && (
        <>
          {/* Statistika */}
          {!loading && !greska && ucitanoBar1x && (
            <div className="flex flex-wrap gap-3">
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatIznos(pocetnoStanje)}
                naziv="Preneseno stanje"
                boja={PRIMARY}
              />
              <StatTile
                icon={<CreditCard size={16} />}
                vrijednost={formatIznos(ukupnoDuguje)}
                naziv="Ukupno duguje"
                boja="#ef4444"
              />
              <StatTile
                icon={<CreditCard size={16} />}
                vrijednost={formatIznos(ukupnoPotrazuje)}
                naziv="Ukupno potražuje"
                boja={ACCENT}
              />
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatIznos(konacnoStanje)}
                naziv="Trenutno stanje"
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

            {!loading && greska && (
              <div className="flex flex-col items-center justify-center gap-2 py-20">
                <p className="text-sm text-red-500 dark:text-red-400">
                  {greska}
                </p>
                <button
                  type="button"
                  onClick={ucitajKarticu}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
                >
                  Pokušaj ponovo
                </button>
              </div>
            )}

            {!loading && !greska && stavke.length === 0 && ucitanoBar1x && (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
                <CreditCard size={28} />
                <p className="text-sm text-gray-400 dark:text-[#5f5878]">
                  Nema stavki u odabranom periodu.
                </p>
              </div>
            )}

            {!loading && !greska && stavke.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: `${PRIMARY}1f` }}>
                      <th
                        className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Datum
                      </th>
                      <th
                        className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Dokument
                      </th>
                      <th
                        className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Opis
                      </th>
                      <th
                        className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Duguje
                      </th>
                      <th
                        className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Potražuje
                      </th>
                      <th
                        className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: PRIMARY }}
                      >
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stavke.map((s, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                          idx % 2 === 1
                            ? "bg-[#faf9fc] dark:bg-[#221c34]"
                            : "bg-white dark:bg-[#261f38]"
                        }`}
                      >
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                          {formatDatum(s.datum)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                          {s.vrsta_dokumenta}
                          {s.broj_dokumenta ? ` #${s.broj_dokumenta}` : ""}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648]">
                          {s.opis ?? "–"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-red-500 dark:text-red-400 border-t border-gray-50 dark:border-[#2d2648]">
                          {s.duguje ? formatIznos(s.duguje) : "–"}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-right font-semibold border-t border-gray-50 dark:border-[#2d2648]"
                          style={{ color: ACCENT }}
                        >
                          {s.potrazuje ? formatIznos(s.potrazuje) : "–"}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-right font-bold border-t border-gray-50 dark:border-[#2d2648]"
                          style={{ color: PRIMARY }}
                        >
                          {formatIznos(s.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
