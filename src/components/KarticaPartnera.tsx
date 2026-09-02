import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  Loader2,
  MapPin,
  Receipt,
  RefreshCcw,
  Search,
  Truck,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Partner koji se ne prikazuje u izboru — za njega se ne vodi stanje (kartica).
const IZOSTAVLJENI_PARTNER_ID = 300;

interface Partner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
}

// Jedna stavka (red prometa) u kartici — vidi erp.kartica_partnera_pregled.
// izvor_id je šifra reda u izvornoj tabeli (račun, uplata...) na koju se
// stavka odnosi — prikazuje se kao referenca.
interface KarticaStavka {
  rb: number;
  datum: string;
  opis: string | null;
  duguje: number;
  potrazuje: number;
  saldo: number;
  izvor_id: number | null;
  vrsta_prometa: number;
  vrsta_prometa_opis: string;
  vrsta_uplate: number | null;
  vrsta_uplate_opis: string | null;
}

// Jedna kartica (kupac ILI dobavljač) — partner može imati obje odjednom.
interface KarticaVrsta {
  vrsta_kartice: number;
  vrsta_kartice_opis: string;
  saldo: number;
  ukupno_duguje: number;
  ukupno_potrazuje: number;
  stavke: KarticaStavka[];
}

interface KarticaOdgovor {
  kupac: KarticaVrsta | null;
  dobavljac: KarticaVrsta | null;
}

// Detalji jednog računa za modal (klik na stavku vrste "RAČUN") — vidi
// erp.racuni_gl_pregled_pojedinacnog. Ne koriste se sva polja koja procedura
// vraća, samo ona bitna za operatera (partner, broj računa, fiskalni, ukupno).
interface RacunDetalji {
  sifra_tabele: number;
  broj_racuna: number;
  vrsta_racuna: string;
  datum_racuna: string;
  naziv_partnera: string | null;
  adresa_partnera: string | null;
  Naziv_grada: string | null;
  JIB: string | null;
  PIB: string | null;
  ukupno: number | string;
  Naziv_radnika: string | null;
  br_fiskalnog: string | null;
  racun_placen: string | null;
  storniran_racun: number | null;
}

// Detalji jedne uplate za modal (klik na stavku vrste "UPLATA") — vidi
// erp.uplate_pregled_pojedninacnog.
interface UplataDetalji {
  sifra_uplate: number;
  naziv_partnera: string | null;
  datum_uplate: string;
  uplaceno: number | string;
  opis: string | null;
  napomena: string | null;
  Naziv_radnika: string | null;
  gotovinska_uplata: number | null;
}

// Detalji jedne KUF stavke za modal (klik na stavku vrste "KUF") — vidi
// erp.uplate_kuf_pregled_pojedninacno.
interface KufDetalji {
  sifra_tabele: number;
  naziv_partnera: string | null;
  adresa_partnera: string | null;
  Naziv_grada: string | null;
  jib: string | null;
  pib: string | null;
  broj_racuna: string | null;
  datum_racuna: string;
  opis: string | null;
  ukupno: number | string;
  racun_placen: string | null;
}

// Detalji jedne kalkulacije za modal (klik na stavku vrste "KALKULACIJA") —
// vidi erp.kalkulacija_pojedinacna_pregled.
interface KalkulacijaDetalji {
  sifra_kalkulacije: number;
  naziv_partnera: string | null;
  adresa_partnera: string | null;
  Naziv_grada: string | null;
  jib: string | null;
  pib: string | null;
  broj_racuna: string | null;
  datum_kalkulacije: string;
  ukupno_km: number | string;
  vrsta_kalkulacije: string | null;
  racun_placen: string | null;
}

// Stavke sa referencom na izvornu tabelu koje trenutno imaju svoju proceduru
// za detalje — ostalo (npr. početno stanje) još nema modal.
type TipReferenceStavke = "racun" | "uplata" | "kuf" | "kalkulacija";

// Genitivni oblik za "Detalji ___" / "Prikaži detalje ___" / "Greška pri
// učitavanju ___".
const NASLOV_REFERENCE: Record<TipReferenceStavke, string> = {
  racun: "računa",
  uplata: "uplate",
  kuf: "KUF stavke",
  kalkulacija: "kalkulacije",
};

function formatIznos(v: number | null | undefined) {
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

// Boje po vrsti uplate (šifarnik 0-12, vidi VRSTA_UPLATE u BlagajnaPregled.tsx)
// — fiksan redoslijed kategorijalnih boja, svaka šifra svoju boju radi lakšeg
// vizuelnog razlikovanja u kartici partnera.
const VRSTA_UPLATE_BOJE: Record<number, string> = {
  0: "#e34948", // Dugovanja kupcu
  1: "#1baf7a", // Uplate kupaca
  2: "#eb6834", // Uplata dobavljačima (kalk)
  3: "#eda100", // Uplata (KUF)
  4: "#e87ba4", // Dugovanja (dobavljaču)
  5: "#4a3aa7", // Davanje pozajmice
  6: "#2a78d6", // Vraćanje date pozajmice
  7: "#008300", // Primanje pozajmice
  8: "#e34948", // Vraćanje primljene pozajmice
  9: "#eb6834", // Povrat pretplate dobavljaču
  10: "#1baf7a", // Prijem pretplate (povrat od kupca)
  11: "#4a3aa7", // Prijem pretplate dobavljača
  12: "#eda100", // Povrat pretplate kupcu
};

function bojaVrsteUplate(v: number | null): string {
  if (v === null) return "#9ca3af";
  return VRSTA_UPLATE_BOJE[v] ?? "#9ca3af";
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

  const [kartica, setKartica] = useState<KarticaOdgovor | null>(null);
  const [aktivnaVrsta, setAktivnaVrsta] = useState<"kupac" | "dobavljac">(
    "kupac",
  );
  const [loading, setLoading] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  const [otvorenaStavka, setOtvorenaStavka] = useState<{
    tip: TipReferenceStavke;
    izvorId: number;
    loading: boolean;
    greska: string | null;
    racun: RacunDetalji | null;
    uplata: UplataDetalji | null;
    kuf: KufDetalji | null;
    kalkulacija: KalkulacijaDetalji | null;
  } | null>(null);

  useEffect(() => {
    setPartneriLoading(true);
    fetch(`${API_URL}/api/partneri/lista-sve`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju partnera");
        return res.json();
      })
      .then((json) =>
        setPartneri(
          (json.data ?? json ?? []).filter(
            (p: Partner) => p.partner_id !== IZOSTAVLJENI_PARTNER_ID,
          ),
        ),
      )
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
    const spisak = !q
      ? partneri
      : partneri.filter(
          (p) =>
            p.naziv?.toLowerCase().includes(q) ||
            p.skraceni_naziv?.toLowerCase().includes(q) ||
            String(p.partner_id).includes(q),
        );
    return spisak.slice(0, 30);
  }, [partneri, pretraga]);

  const odaberiPartnera = (p: Partner) => {
    setOdabraniPartner(p);
    setPretraga("");
    setPokaziDropdown(false);
  };

  const ocistiPartnera = () => {
    setOdabraniPartner(null);
    setKartica(null);
    setGreska(null);
  };

  const ucitajKarticu = () => {
    if (!odabraniPartner) return;
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/kartice/partner/${odabraniPartner.partner_id}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju kartice partnera");
        return res.json();
      })
      .then((json) => {
        const data: KarticaOdgovor = json.data ?? {
          kupac: null,
          dobavljac: null,
        };
        setKartica(data);
        setAktivnaVrsta(data.kupac ? "kupac" : "dobavljac");
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (odabraniPartner) ucitajKarticu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odabraniPartner]);

  // Klik je moguć samo za stavke koje imaju referencu (izvor_id) I vrstu
  // prometa za koju već postoji procedura za detalje. Ostalo (početno
  // stanje...) čeka svoju proceduru, pa nema modal.
  const referencaZaStavku = (s: KarticaStavka): TipReferenceStavke | null => {
    if (s.izvor_id == null) return null;
    if (s.vrsta_prometa_opis === "RAČUN") return "racun";
    if (s.vrsta_prometa_opis === "UPLATA") return "uplata";
    if (s.vrsta_prometa_opis === "KUF") return "kuf";
    if (s.vrsta_prometa_opis === "KALKULACIJA") return "kalkulacija";
    return null;
  };

  const URL_REFERENCE: Record<TipReferenceStavke, (izvorId: number) => string> = {
    racun: (izvorId) => `${API_URL}/api/racuni/pojedinacni?sifraTabele=${izvorId}`,
    uplata: (izvorId) =>
      `${API_URL}/api/izvodi/uplata-pojedinacna?sifraUplate=${izvorId}`,
    kuf: (izvorId) => `${API_URL}/api/izvodi/kuf-pojedinacni?sifraTabele=${izvorId}`,
    kalkulacija: (izvorId) =>
      `${API_URL}/api/kalkulacije/pojedinacna?sifraKalkulacije=${izvorId}`,
  };

  const otvoriStavku = (tip: TipReferenceStavke, izvorId: number) => {
    setOtvorenaStavka({
      tip,
      izvorId,
      loading: true,
      greska: null,
      racun: null,
      uplata: null,
      kuf: null,
      kalkulacija: null,
    });
    fetch(URL_REFERENCE[tip](izvorId), { credentials: "include" })
      .then((res) => {
        if (!res.ok)
          throw new Error(`Greška pri učitavanju ${NASLOV_REFERENCE[tip]}`);
        return res.json();
      })
      .then((json) => {
        setOtvorenaStavka((prev) => {
          if (!prev || prev.izvorId !== izvorId || prev.tip !== tip) return prev;
          return { ...prev, loading: false, [tip]: json.data ?? null };
        });
      })
      .catch((err) => {
        setOtvorenaStavka((prev) =>
          prev && prev.izvorId === izvorId && prev.tip === tip
            ? {
                ...prev,
                loading: false,
                greska:
                  err instanceof Error ? err.message : "Nepoznata greška",
              }
            : prev,
        );
      });
  };

  const imaKupca = !!kartica?.kupac;
  const imaDobavljaca = !!kartica?.dobavljac;
  const aktivnaKartica = kartica ? kartica[aktivnaVrsta] : null;
  // Procedura vraća stavke hronološki (početno stanje prvo) — u prikazu ide
  // obrnuto, najnovije prvo, sa početnim stanjem na dnu liste.
  const stavke = useMemo(
    () => [...(aktivnaKartica?.stavke ?? [])].reverse(),
    [aktivnaKartica],
  );

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
            Pregled stanja duguje/potražuje po partneru od početka godine
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Lijevi stub (30%) — izbor partnera */}
      <div className="w-full lg:w-[30%] flex-shrink-0">
      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-col items-stretch gap-3">
          <div className="flex-1 min-w-0">
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
                  setPokaziDropdown(true);
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
                filtrirani.length === 0 &&
                !partneriLoading && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500 dark:text-[#7d7498]">
                    {pretraga.trim()
                      ? `Nema rezultata za „${pretraga}"`
                      : "Nema dostupnih partnera."}
                  </div>
                )}
            </div>
          </div>

          <button
            type="button"
            onClick={ucitajKarticu}
            disabled={!odabraniPartner || loading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Prikaži
          </button>
        </div>
      </div>
      </div>

      {/* Desni stub (70%) — prekidač kupac/dobavljač */}
      <div className="w-full lg:w-[70%] flex-1 min-w-0">
      {odabraniPartner && !loading && !greska && imaKupca && imaDobavljaca && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 flex justify-center">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAktivnaVrsta("kupac")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-gray-200 dark:border-[#3a3158]"
                style={
                  aktivnaVrsta === "kupac"
                    ? { background: PRIMARY, color: "white" }
                    : { color: PRIMARY }
                }
              >
                <Users size={14} />
                Kupac
              </button>
              <div className="text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                  Trenutno stanje
                </div>
                <div className="text-sm font-bold" style={{ color: PRIMARY }}>
                  {formatIznos(kartica?.kupac?.saldo ?? null)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAktivnaVrsta("dobavljac")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-gray-200 dark:border-[#3a3158]"
                style={
                  aktivnaVrsta === "dobavljac"
                    ? { background: PRIMARY, color: "white" }
                    : { color: PRIMARY }
                }
              >
                <Truck size={14} />
                Dobavljač
              </button>
              <div className="text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                  Trenutno stanje
                </div>
                <div className="text-sm font-bold" style={{ color: PRIMARY }}>
                  {formatIznos(kartica?.dobavljac?.saldo ?? null)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

      {odabraniPartner && loading && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
          <span className="text-sm text-gray-500 dark:text-[#7d7498]">
            Učitavanje...
          </span>
        </div>
      )}

      {odabraniPartner && !loading && greska && (
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

      {odabraniPartner && !loading && !greska && kartica && (
        <>
          {!imaKupca && !imaDobavljaca && (
            <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
              <CreditCard size={28} />
              <p className="text-sm text-gray-400 dark:text-[#5f5878]">
                Partner nema karticu (nije evidentiran ni kao kupac ni kao
                dobavljač).
              </p>
            </div>
          )}

          {(imaKupca || imaDobavljaca) && (
            <>
              {/* Statistika */}
              {aktivnaKartica && (
                <div className="flex flex-wrap gap-3">
                  <StatTile
                    icon={<CreditCard size={16} />}
                    vrijednost={formatIznos(aktivnaKartica.ukupno_duguje)}
                    naziv="Ukupno duguje"
                    boja="#ef4444"
                  />
                  <StatTile
                    icon={<CreditCard size={16} />}
                    vrijednost={formatIznos(aktivnaKartica.ukupno_potrazuje)}
                    naziv="Ukupno potražuje"
                    boja={ACCENT}
                  />
                  <StatTile
                    icon={<Wallet size={16} />}
                    vrijednost={formatIznos(aktivnaKartica.saldo)}
                    naziv="Trenutno stanje"
                    boja={PRIMARY}
                  />
                </div>
              )}

              {/* Tabela */}
              <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
                {stavke.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
                    <CreditCard size={28} />
                    <p className="text-sm text-gray-400 dark:text-[#5f5878]">
                      Nema stavki od početka godine.
                    </p>
                  </div>
                )}

                {stavke.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
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
                            className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                            style={{ color: PRIMARY }}
                          >
                            Vrsta prometa
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
                            Ref.
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
                        {stavke.map((s) => {
                          const referenca = referencaZaStavku(s);
                          return (
                          <tr
                            key={s.rb}
                            onClick={() =>
                              referenca &&
                              otvoriStavku(referenca, s.izvor_id as number)
                            }
                            title={
                              referenca
                                ? `Prikaži detalje ${NASLOV_REFERENCE[referenca]}`
                                : undefined
                            }
                            className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                              referenca ? "cursor-pointer" : ""
                            } ${
                              s.rb % 2 === 0
                                ? "bg-[#faf9fc] dark:bg-[#221c34]"
                                : "bg-white dark:bg-[#261f38]"
                            }`}
                          >
                            <td className="px-4 py-2 text-sm text-right text-gray-400 dark:text-[#5f5878] border-t border-gray-50 dark:border-[#2d2648]">
                              {s.rb}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                              {formatDatum(s.datum)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                              {s.vrsta_prometa_opis}
                              {s.vrsta_uplate_opis && (
                                <div
                                  className="text-xs font-medium"
                                  style={{ color: bojaVrsteUplate(s.vrsta_uplate) }}
                                >
                                  {s.vrsta_uplate_opis}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648]">
                              {s.opis ?? "–"}
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-gray-400 dark:text-[#5f5878] border-t border-gray-50 dark:border-[#2d2648]">
                              {s.izvor_id ?? "–"}
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {otvorenaStavka && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOtvorenaStavka(null);
          }}
        >
          <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[480px] max-w-[92vw] max-h-[85vh] overflow-hidden flex flex-col">
            <div
              className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
              style={{ background: PRIMARY }}
            >
              <div className="flex items-center gap-2 text-white">
                <Receipt size={18} />
                <span className="font-bold text-base">
                  Detalji {NASLOV_REFERENCE[otvorenaStavka.tip]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOtvorenaStavka(null)}
                className="text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
              {otvorenaStavka.loading && (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2
                    size={20}
                    className="animate-spin"
                    style={{ color: PRIMARY }}
                  />
                  <span className="text-sm text-gray-500 dark:text-[#7d7498]">
                    Učitavanje...
                  </span>
                </div>
              )}

              {!otvorenaStavka.loading && otvorenaStavka.greska && (
                <p className="text-sm text-red-500 dark:text-red-400 text-center py-6">
                  {otvorenaStavka.greska}
                </p>
              )}

              {!otvorenaStavka.loading &&
                !otvorenaStavka.greska &&
                otvorenaStavka.tip === "racun" &&
                otvorenaStavka.racun && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                          {otvorenaStavka.racun.vrsta_racuna?.toUpperCase()}-
                          {otvorenaStavka.racun.broj_racuna}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                          {formatDatum(otvorenaStavka.racun.datum_racuna)}
                        </div>
                      </div>
                      {Number(otvorenaStavka.racun.storniran_racun) === 1 && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                          STORNIRAN
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-1">
                      <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.racun.naziv_partnera ?? "–"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                        {otvorenaStavka.racun.adresa_partnera ?? ""}
                        {otvorenaStavka.racun.Naziv_grada
                          ? `, ${otvorenaStavka.racun.Naziv_grada}`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        JIB: {otvorenaStavka.racun.JIB ?? "–"} · PIB:{" "}
                        {otvorenaStavka.racun.PIB ?? "–"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Broj fiskalnog
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.racun.br_fiskalnog ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Radnik
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.racun.Naziv_radnika ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Plaćen
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.racun.racun_placen ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Ukupno
                        </div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: PRIMARY }}
                        >
                          {formatIznos(Number(otvorenaStavka.racun.ukupno))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {!otvorenaStavka.loading &&
                !otvorenaStavka.greska &&
                otvorenaStavka.tip === "uplata" &&
                otvorenaStavka.uplata && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                        Uplata #{otvorenaStavka.uplata.sifra_uplate}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        {formatDatum(otvorenaStavka.uplata.datum_uplate)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-1">
                      <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.uplata.naziv_partnera ?? "–"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                        {otvorenaStavka.uplata.opis ?? "–"}
                      </div>
                      {otvorenaStavka.uplata.napomena && (
                        <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                          {otvorenaStavka.uplata.napomena}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Radnik
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.uplata.Naziv_radnika ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Način
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {Number(otvorenaStavka.uplata.gotovinska_uplata) === 1
                            ? "Gotovinska"
                            : "Žiralna"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Uplaćeno
                        </div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: PRIMARY }}
                        >
                          {formatIznos(Number(otvorenaStavka.uplata.uplaceno))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {!otvorenaStavka.loading &&
                !otvorenaStavka.greska &&
                otvorenaStavka.tip === "kuf" &&
                otvorenaStavka.kuf && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.kuf.broj_racuna ?? "–"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        {formatDatum(otvorenaStavka.kuf.datum_racuna)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-1">
                      <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.kuf.naziv_partnera ?? "–"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                        {otvorenaStavka.kuf.adresa_partnera ?? ""}
                        {otvorenaStavka.kuf.Naziv_grada
                          ? `, ${otvorenaStavka.kuf.Naziv_grada}`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        JIB: {otvorenaStavka.kuf.jib ?? "–"} · PIB:{" "}
                        {otvorenaStavka.kuf.pib ?? "–"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Opis
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.kuf.opis ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Plaćen
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.kuf.racun_placen ?? "–"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Ukupno
                        </div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: PRIMARY }}
                        >
                          {formatIznos(Number(otvorenaStavka.kuf.ukupno))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {!otvorenaStavka.loading &&
                !otvorenaStavka.greska &&
                otvorenaStavka.tip === "kalkulacija" &&
                otvorenaStavka.kalkulacija && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.kalkulacija.broj_racuna ?? "–"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        {formatDatum(otvorenaStavka.kalkulacija.datum_kalkulacije)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-1">
                      <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {otvorenaStavka.kalkulacija.naziv_partnera ?? "–"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                        {otvorenaStavka.kalkulacija.adresa_partnera ?? ""}
                        {otvorenaStavka.kalkulacija.Naziv_grada
                          ? `, ${otvorenaStavka.kalkulacija.Naziv_grada}`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        JIB: {otvorenaStavka.kalkulacija.jib ?? "–"} · PIB:{" "}
                        {otvorenaStavka.kalkulacija.pib ?? "–"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Vrsta
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.kalkulacija.vrsta_kalkulacije ?? "–"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Plaćen
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">
                          {otvorenaStavka.kalkulacija.racun_placen ?? "–"}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 dark:text-[#5f5878] mb-0.5">
                          Ukupno
                        </div>
                        <div
                          className="text-lg font-bold"
                          style={{ color: PRIMARY }}
                        >
                          {formatIznos(Number(otvorenaStavka.kalkulacija.ukupno_km))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
