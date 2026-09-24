import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  CreditCard,
  Loader2,
  Package,
  Receipt,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface Proizvod {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  // erp.artikli_pregled_sve — 1 ako je artikal sirovina, 1 ako se koristi za
  // ponudu (kupcu); koriste se samo vizuelno za razlikovanje u pretrazi.
  sirovina?: number | null;
  koristiti_za_ponudu?: number | null;
}

// Jedna stavka (red prometa) u kartici proizvoda — vidi
// erp.kartica_proizvoda_pregled. Ulaz/izlaz/saldo su količine (u jedinici
// mjere proizvoda), cijena je novčani iznos.
interface KarticaStavka {
  rb: number;
  broj_racuna: number | null;
  izlaz: number | string | null;
  ulaz: number | string | null;
  datum: string;
  korisnik: string | null;
  cijena: number | string | null;
  naziv_proizvoda: string;
  jedinica_m: string | null;
  saldo: number | string;
  vreme: string;
}

function formatKolicina(v: number | string | null | undefined, jm?: string | null) {
  if (v === null || v === undefined) return "–";
  const [cijeliDio, decimalniDio] = Number(v).toFixed(3).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const grupisano = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const jedinica = jm ? ` ${jm}` : "";
  return `${negativan ? "-" : ""}${grupisano}.${decimalniDio}${jedinica}`;
}

function formatIznos(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "–";
  const [cijeliDio, decimalniDio] = Number(v).toFixed(2).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const grupisano = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negativan ? "-" : ""}${grupisano}.${decimalniDio} KM`;
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

function RekapStavka({
  icon,
  broj,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  broj: number;
  naziv: string;
  boja: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-1 min-w-[110px]"
      style={{ background: `${boja}14` }}
    >
      <div style={{ color: boja }}>{icon}</div>
      <div className="leading-tight min-w-0">
        <div className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
          {broj}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-[#5f5878] whitespace-nowrap">
          {naziv}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
  prazno,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
  prazno?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl shadow-sm px-4 py-3 flex-1 min-w-[150px] ${
        prazno
          ? "bg-gray-100 dark:bg-[#1a1626] border-2 border-red-300 dark:border-red-900/70"
          : "bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648]"
      }`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div
          className={`text-lg font-bold leading-tight ${
            prazno
              ? "text-gray-400 dark:text-[#7d7498]"
              : "text-gray-800 dark:text-[#ede9f6]"
          }`}
        >
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

export function KarticaProizvoda() {
  const [proizvodi, setProizvodi] = useState<Proizvod[]>([]);
  const [proizvodiLoading, setProizvodiLoading] = useState(true);

  const [pretraga, setPretraga] = useState("");
  const [pokaziDropdown, setPokaziDropdown] = useState(false);
  const [odabraniProizvod, setOdabraniProizvod] = useState<Proizvod | null>(
    null,
  );
  const searchRef = useRef<HTMLDivElement>(null);

  const [stavke, setStavke] = useState<KarticaStavka[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  useEffect(() => {
    setProizvodiLoading(true);
    fetch(`${API_URL}/api/artikli/pregled-sve`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju artikala");
        return res.json();
      })
      .then((json) => setProizvodi(json.data ?? []))
      .catch(() => setProizvodi([]))
      .finally(() => setProizvodiLoading(false));
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
    const spisak = !q
      ? proizvodi
      : proizvodi.filter(
          (p) =>
            p.naziv_proizvoda?.toLowerCase().includes(q) ||
            String(p.sifra_proizvoda).includes(q),
        );
    return spisak.slice(0, 30);
  }, [proizvodi, pretraga]);

  const odaberiProizvod = (p: Proizvod) => {
    setOdabraniProizvod(p);
    setPretraga("");
    setPokaziDropdown(false);
  };

  const ocistiProizvod = () => {
    setOdabraniProizvod(null);
    setStavke(null);
    setGreska(null);
  };

  const ucitajKarticu = () => {
    if (!odabraniProizvod) return;
    setLoading(true);
    setGreska(null);
    fetch(
      `${API_URL}/api/kartice/proizvod/${odabraniProizvod.sifra_proizvoda}`,
      { credentials: "include" },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju kartice proizvoda");
        return res.json();
      })
      .then((json) => {
        const lista: KarticaStavka[] = (json.data ?? []).map(
          (red: Omit<KarticaStavka, "rb">, i: number) => ({
            ...red,
            rb: i + 1,
          }),
        );
        setStavke(lista);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (odabraniProizvod) ucitajKarticu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odabraniProizvod]);

  // Procedura vraća stavke hronološki (od najstarije) — u prikazu ide
  // obrnuto, najnovije prvo.
  const stavkeZaPrikaz = useMemo(
    () => [...(stavke ?? [])].reverse(),
    [stavke],
  );

  const ukupnoUlaz = useMemo(
    () => (stavke ?? []).reduce((acc, s) => acc + Number(s.ulaz ?? 0), 0),
    [stavke],
  );
  // Procedura vraća stavke hronološki, prva stavka je početno stanje (isto
  // kao kod erp.kartica_partnera_pregled) — od ukupnog ulaza se izdvaja
  // njegova količina, a ostatak je stvarni ulaz robe (prijemi tokom perioda).
  const pocetnoStanje =
    stavke && stavke.length > 0 ? Number(stavke[0].ulaz ?? 0) : 0;
  const stvarniUlaz = ukupnoUlaz - pocetnoStanje;
  const ukupnoIzlaz = useMemo(
    () => (stavke ?? []).reduce((acc, s) => acc + Number(s.izlaz ?? 0), 0),
    [stavke],
  );
  const trenutnoStanje =
    stavke && stavke.length > 0 ? stavke[stavke.length - 1].saldo : 0;
  const jedinicaMjere = odabraniProizvod?.jm ?? stavke?.[0]?.jedinica_m ?? "";
  // Trenutna cijena — cijena sa posljednje (najnovije) stavke u kartici.
  const trenutnaCijena =
    stavke && stavke.length > 0 ? stavke[stavke.length - 1].cijena : 0;
  const financijskaVrijednost = Number(trenutnoStanje) * Number(trenutnaCijena ?? 0);

  // Rekapitulacija po broju stavki (ne po količini): koliko je izlaza
  // evidentirano kao redovan račun, koliko kao storno (izlaz u minusu — vidi
  // jeKoPovrat niže) i koliko ulaza robe je primljeno.
  const brojUlaza = useMemo(
    () => (stavke ?? []).filter((s) => Number(s.ulaz ?? 0) !== 0).length,
    [stavke],
  );
  const brojStorno = useMemo(
    () =>
      (stavke ?? []).filter(
        (s) => Number(s.ulaz ?? 0) === 0 && Number(s.izlaz ?? 0) < 0,
      ).length,
    [stavke],
  );
  const brojRacuna = useMemo(
    () =>
      (stavke ?? []).filter(
        (s) => Number(s.ulaz ?? 0) === 0 && Number(s.izlaz ?? 0) > 0,
      ).length,
    [stavke],
  );

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50] flex-shrink-0">
          <Package size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Kartica proizvoda
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Pregled ulaza, izlaza i stanja zaliha po proizvodu
          </p>
        </div>

        {/* Naziv/šifra/JM odabranog proizvoda — centrirano na sredini ekrana, u ravnini naslova */}
        {odabraniProizvod && (
          <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 text-center max-w-[45%] pointer-events-none">
            <div className="text-base font-bold text-gray-800 dark:text-[#ede9f6] truncate">
              {odabraniProizvod.naziv_proizvoda}
            </div>
            <div className="text-xs text-gray-400 dark:text-[#5f5878]">
              Šifra: {odabraniProizvod.sifra_proizvoda}
              {odabraniProizvod.jm ? ` · ${odabraniProizvod.jm}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* Filteri + rekapitulacija */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch">
        {/* Pretraga proizvoda — kompaktno, jedan red */}
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-2.5 w-full lg:w-[40%] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div ref={searchRef} className="relative flex-1 min-w-0">
              {proizvodiLoading ? (
                <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />
              ) : (
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              )}
              <input
                value={
                  odabraniProizvod ? odabraniProizvod.naziv_proizvoda : pretraga
                }
                onChange={(e) => {
                  setOdabraniProizvod(null);
                  setPretraga(e.target.value);
                  setPokaziDropdown(true);
                }}
                onFocus={() => {
                  if (odabraniProizvod) return;
                  setPokaziDropdown(true);
                }}
                placeholder={
                  proizvodiLoading ? "Učitavanje..." : "Pretraži proizvod..."
                }
                disabled={proizvodiLoading}
                className="pl-8 pr-7 py-1.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-lg w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
              />
              {odabraniProizvod && (
                <button
                  type="button"
                  onClick={ocistiProizvod}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#c5bfd8]"
                >
                  <X size={13} />
                </button>
              )}

              {pokaziDropdown && filtrirani.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {filtrirani.map((p) => {
                    const jeSirovina = Number(p.sirovina) === 1;
                    const vanPonude =
                      p.koristiti_za_ponudu !== undefined &&
                      p.koristiti_za_ponudu !== null &&
                      Number(p.koristiti_za_ponudu) === 0;
                    return (
                      <button
                        key={p.sifra_proizvoda}
                        type="button"
                        onMouseDown={() => odaberiProizvod(p)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0 ${
                          jeSirovina
                            ? "bg-amber-50/60 dark:bg-[#2e2410] hover:bg-amber-100/70 dark:hover:bg-[#3a2d14]"
                            : "hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                            jeSirovina
                              ? "bg-amber-100 dark:bg-amber-500/15"
                              : "bg-[#ede8f5] dark:bg-[#312a50]"
                          }`}
                        >
                          <Package
                            size={13}
                            style={{ color: jeSirovina ? "#b45309" : PRIMARY }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                              {p.naziv_proizvoda}
                            </div>
                            {jeSirovina && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                Sirovina
                              </span>
                            )}
                            {vanPonude && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400">
                                Van ponude
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                            Šifra: {p.sifra_proizvoda}
                            {p.jm ? ` · ${p.jm}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {pokaziDropdown &&
                filtrirani.length === 0 &&
                !proizvodiLoading && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500 dark:text-[#7d7498]">
                    {pretraga.trim()
                      ? `Nema rezultata za „${pretraga}"`
                      : "Nema dostupnih proizvoda."}
                  </div>
                )}
            </div>

            <button
              type="button"
              onClick={ucitajKarticu}
              disabled={!odabraniProizvod || loading}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 flex-shrink-0"
              style={{ background: PRIMARY }}
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Prikaži
            </button>
          </div>
        </div>

        {/* Rekapitulacija */}
        {stavke && stavke.length > 0 && (
          <div className="flex-1 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-2.5 flex items-center gap-2 flex-wrap">
            <RekapStavka
              icon={<Receipt size={15} />}
              broj={brojRacuna}
              naziv="Računa"
              boja={PRIMARY}
            />
            <RekapStavka
              icon={<Undo2 size={15} />}
              broj={brojStorno}
              naziv="Storno"
              boja="#ef4444"
            />
            <RekapStavka
              icon={<TrendingUp size={15} />}
              broj={brojUlaza}
              naziv="Ulaza robe"
              boja={ACCENT}
            />
          </div>
        )}
      </div>

      {!odabraniProizvod && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
          <Package size={28} />
          <p className="text-sm text-gray-400 dark:text-[#5f5878]">
            Odaberite proizvod da biste prikazali karticu.
          </p>
        </div>
      )}

      {odabraniProizvod && loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {odabraniProizvod && !loading && greska && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
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

      {odabraniProizvod && !loading && !greska && stavke && (
        <>
          {stavke.length === 0 && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
              <CreditCard size={28} />
              <p className="text-sm text-gray-400 dark:text-[#5f5878]">
                Nema evidentiranog prometa za odabrani proizvod.
              </p>
            </div>
          )}

          {stavke.length > 0 && (
            <>
              {/* Statistika */}
              <div className="flex flex-wrap gap-3">
                <StatTile
                  icon={<Package size={16} />}
                  vrijednost={formatKolicina(pocetnoStanje, jedinicaMjere)}
                  naziv="Početno stanje"
                  boja={PRIMARY}
                />
                <StatTile
                  icon={<TrendingUp size={16} />}
                  vrijednost={formatKolicina(stvarniUlaz, jedinicaMjere)}
                  naziv="Stvarni ulaz"
                  boja={ACCENT}
                />
                <StatTile
                  icon={<TrendingDown size={16} />}
                  vrijednost={formatKolicina(ukupnoIzlaz, jedinicaMjere)}
                  naziv="Ukupno izlaz"
                  boja="#ef4444"
                />
                <StatTile
                  icon={<Boxes size={16} />}
                  vrijednost={formatKolicina(trenutnoStanje, jedinicaMjere)}
                  naziv="Trenutno stanje"
                  boja={Number(trenutnoStanje) === 0 ? "#9ca3af" : PRIMARY}
                  prazno={Number(trenutnoStanje) === 0}
                />
                <StatTile
                  icon={<Wallet size={16} />}
                  vrijednost={formatIznos(financijskaVrijednost)}
                  naziv="Financijska vrijednost"
                  boja={financijskaVrijednost === 0 ? "#9ca3af" : PRIMARY}
                  prazno={financijskaVrijednost === 0}
                />
              </div>

              {/* Tabela — širina prati sadržaj (bez razvlačenja kolona), centrirano */}
              <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden w-fit max-w-full mx-auto origin-top scale-105">
                <div className="overflow-x-auto">
                  <table className="table-auto">
                    <thead>
                      <tr style={{ background: `${PRIMARY}1f` }}>
                        <th
                          className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Rb
                        </th>
                        <th
                          className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Datum
                        </th>
                        <th
                          className="text-left px-1 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Broj računa
                        </th>
                        <th
                          className="text-left px-1 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Korisnik
                        </th>
                        <th
                          className="text-left px-1 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Jm
                        </th>
                        <th
                          className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Ulaz
                        </th>
                        <th
                          className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Izlaz
                        </th>
                        <th
                          className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Cijena
                        </th>
                        <th
                          className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                          style={{ color: PRIMARY }}
                        >
                          Stanje
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stavkeZaPrikaz.map((s) => {
                        // Ulaz robe (normalan prijem) — zelenkasta pozadina.
                        const jeUlaz = !!s.ulaz && Number(s.ulaz) !== 0;
                        // Izlaz koji ide u minus (npr. KO — knjižno odobrenje/povrat)
                        // suštinski povećava zalihe iako je evidentiran kao izlaz —
                        // vizuelno se izdvaja od običnog izlaza (koji ostaje bijeli).
                        const jeKoPovrat =
                          !jeUlaz && Number(s.izlaz ?? 0) < 0;
                        const rowBg = jeUlaz
                          ? "bg-[#eaf7db] dark:bg-[#1c3016]"
                          : jeKoPovrat
                            ? "bg-[#fdf0d8] dark:bg-[#3a2c12]"
                            : "bg-white dark:bg-[#261f38]";
                        const border = "border-t border-gray-300 dark:border-gray-700";
                        return (
                          <tr key={s.rb} className={rowBg}>
                            <td className={`px-4 py-2 text-sm text-right text-gray-400 dark:text-[#5f5878] ${border}`}>
                              {s.rb}
                            </td>
                            <td className={`px-4 py-2 text-sm text-gray-600 dark:text-[#c5bfd8] ${border}`}>
                              {formatDatum(s.datum)}
                            </td>
                            <td className={`px-1 py-2 text-sm text-gray-500 dark:text-[#a99fc2] ${border}`}>
                              {s.broj_racuna ?? "–"}
                            </td>
                            <td className={`px-1 py-2 text-sm text-gray-500 dark:text-[#a99fc2] ${border}`}>
                              {s.korisnik ?? "–"}
                            </td>
                            <td className={`px-1 py-2 text-sm text-gray-500 dark:text-[#a99fc2] ${border}`}>
                              {s.jedinica_m ?? "–"}
                            </td>
                            <td
                              className={`px-4 py-2 text-sm text-right font-semibold ${border}`}
                              style={{ color: ACCENT }}
                            >
                              {s.ulaz ? formatKolicina(s.ulaz) : "–"}
                            </td>
                            <td
                              className={`px-4 py-2 text-sm text-right font-semibold ${border} ${
                                jeKoPovrat
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-500 dark:text-red-400"
                              }`}
                            >
                              {s.izlaz ? formatKolicina(s.izlaz) : "–"}
                            </td>
                            <td className={`px-4 py-2 text-sm text-right text-gray-600 dark:text-[#c5bfd8] ${border}`}>
                              {formatIznos(s.cijena)}
                            </td>
                            <td
                              className={`px-4 py-2 text-sm text-right font-bold ${border}`}
                              style={{ color: PRIMARY }}
                            >
                              {formatKolicina(s.saldo)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
