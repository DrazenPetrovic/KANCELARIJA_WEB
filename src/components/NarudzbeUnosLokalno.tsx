import ReactDOM from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Calendar,
  ShoppingCart,
  Truck,
  Clock,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  Pencil,
  Package,
  User,
  PenLine,
  MapPin,
  X,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 transition-all text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878] bg-white dark:bg-[#1e1a2d]";

const Label = ({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) => (
  <label className="block text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider mb-1">
    {children}
    {required && <span className="text-red-400 ml-0.5">*</span>}
    {optional && (
      <span className="text-gray-400 dark:text-[#5f5878] ml-1 normal-case font-normal">
        (opcionalno)
      </span>
    )}
  </label>
);

const parseCijena = (v: number | string | undefined | null): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=.*,)/g, "")
    .replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

interface DodatnaLokacija {
  sifra_partnera: number;
  Naziv_grada?: string;
  sifra_grada?: number;
  naziv_lokacije?: string;
  [key: string]: unknown;
}

interface Kupac {
  sifra_kup: number;
  Naziv_partnera: string;
  sifra_grada: number;
  Naziv_grada: string;
  vrsta: number;
  pripada_radniku: number;
  dodatna_lokacija?: DodatnaLokacija;
}

interface Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  kolicina_proizvoda: number | string;
  kolicinaNaStanju: number;
  grupa_proizvoda: string;
  naziv_grupe: string;
  [key: string]: unknown;
}

interface StavkaNarudzbe {
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  cijena: number;
}

// Validacija: dozvoljava prazan string, cijele brojeve i decimale do 3 mjesta
const isValidKolicinaInput = (v: string): boolean =>
  v === "" || /^\d+\.?\d{0,3}$/.test(v) || /^\d*\.$/.test(v);

const narudzbe = [
  {
    vrijeme: "08:32",
    kupac: "Trgovina Marko d.o.o.",
    artikli: "3 artikla",
    iznos: "45,00 KM",
    isporuka: "Danas",
    status: "Za isporuku",
    boja: "orange",
  },
  {
    vrijeme: "08:15",
    kupac: "Kafić Central",
    artikli: "5 artikala",
    iznos: "32,50 KM",
    isporuka: "Danas",
    status: "U pripremi",
    boja: "green",
  },
  {
    vrijeme: "07:45",
    kupac: "Restoran Bella",
    artikli: "8 artikala",
    iznos: "120,00 KM",
    isporuka: "18.03.2025",
    status: "Za 2 dana",
    boja: "purple",
  },
  {
    vrijeme: "09:10",
    kupac: "Market Plus",
    artikli: "2 artikla",
    iznos: "18,90 KM",
    isporuka: "Danas",
    status: "Za isporuku",
    boja: "orange",
  },
  {
    vrijeme: "10:05",
    kupac: "Pekara Ana",
    artikli: "6 artikala",
    iznos: "55,20 KM",
    isporuka: "Danas",
    status: "Isporučeno",
    boja: "green",
  },
];

const statusCardClass: Record<string, string> = {
  orange:
    "bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border-orange-400",
  green:
    "bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 border-green-400",
  purple:
    "bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 border-purple-400",
};

const statusBadgeClass: Record<string, string> = {
  orange:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  purple:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
};

const readGrupaNaziv = (g: Record<string, unknown>): string => {
  // Prioritet: naziv_grupe, naziv, name, title
  const keys = ["naziv_grupe", "naziv", "name", "title"];
  for (const key of keys) {
    if (g[key] && typeof g[key] === "string") return g[key] as string;
  }
  return "Grupa";
};

export function NarudzbeUnosLokalno() {
  // ── kupac ────────────────────────────────────────────────────
  const [kupci, setKupci] = useState<Kupac[]>([]);
  const [kupciLoading, setKupciLoading] = useState(true);
  const [pretraga, setPretraga] = useState("");
  const [odabraniKupac, setOdabraniKupac] = useState<Kupac | null>(null);
  const [pokaziDropdown, setPokazuiDropdown] = useState(false);
  const [pokaziModalKupci, setPokazuiModalKupci] = useState(false);
  const [pretragaKupci, setPretragaKupci] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // ── stavke narudžbe ──────────────────────────────────────────
  const [stavke, setStavke] = useState<StavkaNarudzbe[]>([]);

  // ── artikli + modal ──────────────────────────────────────────
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [artikliGrupe, setArtikliGrupe] = useState<Record<string, unknown>[]>(
    [],
  );
  const [artikliLoading, setArtikliLoading] = useState(false);
  const [artikliDohvaceni, setArtikliDohvaceni] = useState(false);
  // Auto-detektovani nazivi polja (ovise o tome šta procedura vraća)
  const [grupaIdKey, setGrupaIdKey] = useState<string | null>(null);
  const [artikalGrupaKey, setArtikalGrupaKey] = useState<string | null>(null);
  const [pokaziModalArtikli, setPokazuiModalArtikli] = useState(false);
  const [modalPretraga, setModalPretraga] = useState("");
  const [odabranaGrupa, setOdabranaGrupa] = useState<number | null>(null);
  // Map: sifra_proizvoda → string količina ("" = odabran ali bez unosa)
  const [modalOdabrani, setModalOdabrani] = useState<Map<number, string>>(
    new Map(),
  );
  // Upozorenje za artikal bez stanja
  const [upozorenjeArtikalSifra, setUpozorenjeArtikalSifra] = useState<
    number | null
  >(null);
  // Refs za input polja količine u modalu
  const inputRefsModal = useRef<Record<number, HTMLInputElement | null>>({});
  useEffect(() => {
    const fetchKupci = async () => {
      try {
        const res = await fetch(`${API_URL}/api/partneri/lokalna-dostava`, {
          credentials: "include",
        });
        const json = await res.json();
        if (json.success) setKupci(json.data);
      } catch {
        /* tiho */
      } finally {
        setKupciLoading(false);
      }
    };
    fetchKupci();
  }, []);

  // ── click outside kupac dropdown ────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setPokazuiDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── ESC zatvara modal ────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (upozorenjeArtikalSifra !== null) {
          setUpozorenjeArtikalSifra(null);
          return;
        }
        if (pokaziModalArtikli) zatvoriModal();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [pokaziModalArtikli, upozorenjeArtikalSifra]);

  // ── Autofokus na input polje kada se odabere artikal ──────────
  useEffect(() => {
    if (!pokaziModalArtikli) return;
    // Pronađi poslednjeg dodanog artikla
    const keys = Array.from(modalOdabrani.keys());
    if (keys.length === 0) return;
    const lastAdded = keys[keys.length - 1];

    if (inputRefsModal.current[lastAdded]) {
      setTimeout(() => {
        const input = inputRefsModal.current[lastAdded];
        if (input) {
          input.focus();
        }
      }, 50);
    }
  }, [modalOdabrani, pokaziModalArtikli]);
  useEffect(() => {
    if (!artikliGrupe.length) return;
    const rec = artikliGrupe[0];
    // Preferiramo numerička polja čiji naziv sadrži 'sifra', 'id' ili 'kod'
    for (const key of Object.keys(rec)) {
      if (
        rec[key] != null &&
        typeof rec[key] === "number" &&
        /sifra|id|kod/i.test(key)
      ) {
        setGrupaIdKey(key);
        return;
      }
    }
    // Fallback: prvi numerički ključ
    for (const key of Object.keys(rec)) {
      if (typeof rec[key] === "number") {
        setGrupaIdKey(key);
        return;
      }
    }
  }, [artikliGrupe]);

  // ── auto-detekcija polja grupe na artiklima ──────────────────
  useEffect(() => {
    if (!artikli.length || !artikliGrupe.length || !grupaIdKey) return;
    const groupIds = new Set(
      artikliGrupe
        .map((g) => Number(g[grupaIdKey]))
        .filter((n) => !isNaN(n) && n !== 0),
    );
    if (!groupIds.size) return;
    const sample = artikli.slice(0, Math.min(50, artikli.length));
    const score: Record<string, number> = {};
    for (const a of sample) {
      const rec = a as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        const val = Number(rec[key]);
        if (!isNaN(val) && groupIds.has(val))
          score[key] = (score[key] ?? 0) + 1;
      }
    }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    if (best) setArtikalGrupaKey(best[0]);
  }, [artikli, artikliGrupe, grupaIdKey]);

  // ── kupac helpers ────────────────────────────────────────────
  const filtrirani =
    pretraga.length >= 1
      ? kupci
          .filter(
            (k) =>
              k.Naziv_partnera.toLowerCase().includes(pretraga.toLowerCase()) ||
              k.Naziv_grada.toLowerCase().includes(pretraga.toLowerCase()) ||
              String(k.sifra_kup).includes(pretraga),
          )
          .slice(0, 10)
      : [];

  const handleOdabir = (kupac: Kupac) => {
    setOdabraniKupac(kupac);
    setPretraga("");
    setPokazuiDropdown(false);
    setStavke([]);
  };

  const handleOcisti = () => {
    setPokazuiModalKupci(true);
  };

  const handlePoništi = () => {
    setOdabraniKupac(null);
    setPretraga("");
    setStavke([]);
  };

  const handleSacuvaj = () => {
    setOdabraniKupac(null);
    setPretraga("");
    setStavke([]);
  };

  // ── modal artikli ────────────────────────────────────────────
  const otvoriModalArtikli = async () => {
    setPokazuiModalArtikli(true);
    setModalPretraga("");
    setOdabranaGrupa(null);

    const init = new Map<number, string>();
    stavke.forEach((s) => init.set(s.sifra_proizvoda, String(s.kolicina)));
    setModalOdabrani(init);

    if (!artikliDohvaceni) {
      setArtikliLoading(true);
      try {
        const [resA, resG] = await Promise.all([
          fetch(`${API_URL}/api/artikli`, { credentials: "include" }),
          fetch(`${API_URL}/api/artikli/grupe`, { credentials: "include" }),
        ]);
        const [jsonA, jsonG] = await Promise.all([resA.json(), resG.json()]);
        if (jsonA.success) {
          const mappedArtikli = jsonA.data.map((a: Artikal) => ({
            ...a,
            kolicinaNaStanju:
              a.kolicina_proizvoda != null
                ? Number(String(a.kolicina_proizvoda).replace(",", "."))
                : 0,
          }));
          setArtikli(mappedArtikli);
        }
        if (jsonG.success) setArtikliGrupe(jsonG.data);
        setArtikliDohvaceni(true);
      } catch {
        /* tiho */
      } finally {
        setArtikliLoading(false);
      }
    }
  };

  const zatvoriModal = () => {
    setPokazuiModalArtikli(false);
    setModalPretraga("");
  };

  const potvrdiOdabirArtikala = () => {
    const novaStavke: StavkaNarudzbe[] = [];
    modalOdabrani.forEach((kolicinaStr, sifra) => {
      const kolicina = parseFloat(kolicinaStr);
      if (!kolicinaStr || isNaN(kolicina) || kolicina <= 0) return;
      const a = artikli.find((x) => Number(x.sifra_proizvoda) === sifra);
      if (a) {
        novaStavke.push({
          sifra_proizvoda: Number(a.sifra_proizvoda),
          naziv_proizvoda: a.naziv_proizvoda,
          jm: a.jm,
          kolicina,
          cijena: parseCijena(a.mpc),
        });
      }
    });
    setStavke(novaStavke);
    zatvoriModal();
  };

  // Klik na red artikla — provjeri stanje na lageru
  const toggleArtikalOdabir = (a: Artikal) => {
    const sifra = Number(a.sifra_proizvoda);
    // Deselect uvijek radi bez upozorenja
    if (modalOdabrani.has(sifra)) {
      setModalOdabrani((prev) => {
        const next = new Map(prev);
        next.delete(sifra);
        return next;
      });
      return;
    }
    // Odabir artikla bez stanja → upozorenje
    if (a.kolicinaNaStanju <= 0) {
      setUpozorenjeArtikalSifra(sifra);
      return;
    }
    setModalOdabrani((prev) => {
      const next = new Map(prev);
      next.set(sifra, "");
      return next;
    });
  };

  const handleUpozorenjeConfirm = () => {
    if (upozorenjeArtikalSifra !== null) {
      setModalOdabrani((prev) => {
        const next = new Map(prev);
        next.set(upozorenjeArtikalSifra, "");
        return next;
      });
      setUpozorenjeArtikalSifra(null);
    }
  };

  const setKolicinaUModalu = (sifra: number, val: string) => {
    if (!isValidKolicinaInput(val)) return;
    setModalOdabrani((prev) => {
      const next = new Map(prev);
      next.set(sifra, val);
      return next;
    });
  };

  // ── stavke u listi narudžbe ──────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const promijeniKolicinu = (sifra: number, delta: number) => {
    setStavke((prev) =>
      prev.map((s) =>
        s.sifra_proizvoda === sifra
          ? {
              ...s,
              kolicina: Math.max(
                0.001,
                parseFloat((s.kolicina + delta).toFixed(3)),
              ),
            }
          : s,
      ),
    );
  };

  const ukloniStavku = (sifra: number) =>
    setStavke((prev) => prev.filter((s) => s.sifra_proizvoda !== sifra));

  // ── filtriranje u modalu ──────────────────────────────────────
  const artikliFiltrirani = artikli.filter((a) => {
    const rec = a as Record<string, unknown>;
    const matchGrupa =
      odabranaGrupa === null ||
      (artikalGrupaKey !== null &&
        Number(rec[artikalGrupaKey]) === odabranaGrupa);
    const q = modalPretraga.toLowerCase();
    const matchPretraga =
      !q ||
      a.naziv_proizvoda.toLowerCase().includes(q) ||
      String(a.sifra_proizvoda).includes(q);
    return matchGrupa && matchPretraga;
  });

  const ukupnoIznos = stavke.reduce((s, x) => s + x.kolicina * x.cijena, 0);

  // Broj stavki u modalu koje imaju validnu količinu
  const validniOdabraniCount = Array.from(modalOdabrani.values()).filter(
    (v) => v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) > 0,
  ).length;

  return (
    <div className="space-y-6">
      {/* Zaglavlje */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <PenLine size={20} style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Unos narudžbe lokalno
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pretraži kupca, narudžbu, artikal..."
              className="w-80 pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878]"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-gray-200 dark:border-[#3a3158] rounded-xl bg-white dark:bg-[#261f38] text-gray-700 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all">
            <Calendar className="h-4 w-4" /> Danas
          </button>
        </div>
      </div>

      {/* Stat kartice */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<ShoppingCart size={20} />}
          broj="24"
          opis="Unesene danas"
          type="primary"
        />
        <StatCard
          icon={<Truck size={20} />}
          broj="18"
          opis="Za isporuku danas"
          type="green"
        />
        <StatCard
          icon={<Clock size={20} />}
          broj="6"
          opis="Za par dana"
          type="orange"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          broj="12"
          opis="Isporučeno danas"
          type="accent"
        />
      </div>

      {/* Glavni grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr]">
        {/* Forma za unos */}
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: PRIMARY }}
            >
              <Plus size={18} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
              Unos nove narudžbe
            </h3>
          </div>

          {/* Kupac */}
          <div>
            <Label required>Kupac</Label>
            <div className="flex gap-2">
              <div ref={searchRef} className="relative flex-1">
                {kupciLoading ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
                <input
                  value={pretraga}
                  onChange={(e) => {
                    setPretraga(e.target.value);
                    setPokazuiDropdown(true);
                  }}
                  onFocus={() =>
                    pretraga.length >= 1 && setPokazuiDropdown(true)
                  }
                  placeholder={
                    kupciLoading ? "Učitavanje..." : "Pretraži kupca..."
                  }
                  disabled={kupciLoading}
                  className={`${inputClass} pl-10`}
                />
                {pokaziDropdown && filtrirani.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden">
                    {filtrirani.map((kupac) => (
                      <button
                        key={kupac.sifra_kup}
                        onMouseDown={() => handleOdabir(kupac)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                            <User size={13} style={{ color: PRIMARY }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                              {kupac.Naziv_partnera}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-[#7d7498] flex items-center gap-1">
                              <MapPin size={10} /> {kupac.Naziv_grada} · ID:{" "}
                              {kupac.sifra_kup}
                            </div>
                          </div>
                        </div>
                        {kupac.dodatna_lokacija && (
                          <span
                            className="ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: "#ede8f5", color: PRIMARY }}
                          >
                            +lok
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {pokaziDropdown &&
                  pretraga.length >= 1 &&
                  filtrirani.length === 0 &&
                  !kupciLoading && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500 dark:text-[#7d7498]">
                      Nema rezultata za „{pretraga}"
                    </div>
                  )}
              </div>
              <button
                onClick={handleOcisti}
                title="Detaljan pregled partnera"
                className="px-3 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
              >
                {odabraniKupac ? (
                  <X className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </button>
              <button
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all whitespace-nowrap hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                + Novi kupac
              </button>
            </div>
          </div>

          {/* Odabrani kupac */}
          {odabraniKupac ? (
            <div className="rounded-xl border border-gray-200 dark:border-[#3a3158] bg-[#f4f1f9] dark:bg-[#1e1a2d] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                    <Package size={18} style={{ color: PRIMARY }} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                      {odabraniKupac.Naziv_partnera}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#7d7498] flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {odabraniKupac.Naziv_grada} · ID:{" "}
                      {odabraniKupac.sifra_kup}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#edf7e0", color: ACCENT }}
                  >
                    Aktivan
                  </span>
                  <button
                    onClick={() => {
                      setOdabraniKupac(null);
                      setPretraga("");
                      setStavke([]);
                    }}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                    title="Obriši kupca"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {odabraniKupac.dodatna_lokacija && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "#ede8f5", color: PRIMARY }}
                >
                  <MapPin size={12} />
                  Dodatna lokacija:{" "}
                  {odabraniKupac.dodatna_lokacija.Naziv_grada ??
                    `ID ${odabraniKupac.dodatna_lokacija.sifra_partnera}`}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] bg-[#f4f1f9] dark:bg-[#1e1a2d] p-4 text-sm text-gray-400 dark:text-[#5f5878]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-[#261f38]">
                <User size={16} className="text-gray-300 dark:text-[#3a3158]" />
              </div>
              Pretražite i odaberite kupca iz liste
            </div>
          )}

          {/* Datum i prioritet */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label required>Datum isporuke</Label>
              <input
                type="text"
                defaultValue={new Date().toLocaleDateString("hr-HR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
                className={inputClass}
              />
            </div>
            <div>
              <Label>Prioritet</Label>
              <select className={inputClass}>
                <option>Normalan</option>
                <option>Hitno</option>
                <option>Dogovorena isporuka</option>
              </select>
            </div>
          </div>

          {/* Artikli */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider">
                  Artikli
                </span>
                {stavke.length > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ background: PRIMARY }}
                  >
                    {stavke.length}
                  </span>
                )}
              </div>
              <button
                onClick={otvoriModalArtikli}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                <Plus size={13} /> Dodaj artikal
              </button>
            </div>

            {stavke.length > 0 ? (
              <>
                <div className="grid grid-cols-[1fr_90px_90px_90px_36px] gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                  <span>Artikal</span>
                  <span className="text-center">Količina</span>
                  <span>Cijena</span>
                  <span>Ukupno</span>
                  <span />
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#3a3158]">
                  {stavke.map((s) => (
                    <div
                      key={s.sifra_proizvoda}
                      className="grid grid-cols-[1fr_90px_90px_90px_36px] items-center gap-2 border-b border-gray-100 dark:border-[#2d2648] p-3 last:border-b-0 bg-white dark:bg-[#261f38]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center bg-[#f4f1f9] dark:bg-[#312a50]">
                          <Package
                            className="h-4 w-4"
                            style={{ color: PRIMARY }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                            {s.naziv_proizvoda}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                            ID: {s.sifra_proizvoda} · {s.jm}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-[#3a3158] px-1.5 py-1">
                        <span className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] min-w-[20px] text-center">
                          {s.kolicina}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">
                        {s.cijena.toFixed(2)} KM
                      </div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6]">
                        {(s.kolicina * s.cijena).toFixed(2)} KM
                      </div>
                      <button
                        onClick={() => ukloniStavku(s.sifra_proizvoda)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d]">
                    <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider">
                      Ukupno:
                    </span>
                    <span
                      className="text-base font-bold"
                      style={{ color: PRIMARY }}
                    >
                      {ukupnoIznos.toFixed(2)} KM
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] bg-[#f4f1f9] dark:bg-[#1e1a2d] py-6 text-sm text-gray-400 dark:text-[#5f5878]">
                <Package
                  size={24}
                  className="text-gray-300 dark:text-[#3a3158]"
                />
                Nema dodanih artikala
              </div>
            )}
          </div>

          {/* Napomena */}
          <div>
            <Label optional>Napomena</Label>
            <textarea
              placeholder="Unesite napomenu..."
              className={`${inputClass} h-24 resize-none`}
            />
          </div>

          {/* Akcije */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePoništi}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
            >
              Poništi
            </button>
            <button
              onClick={handleSacuvaj}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all"
              style={{ background: PRIMARY }}
            >
              ✓ Sačuvaj narudžbu
            </button>
          </div>
        </div>

        {/* Lista narudžbi */}
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6] mb-5">
            Današnje narudžbe
          </h3>
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              "Sve (24)",
              "Primljene (8)",
              "U pripremi (10)",
              "Za isporuku (18)",
              "Isporučene (12)",
            ].map((item, index) => (
              <button
                key={item}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${index === 0 ? "text-white" : "bg-[#f4f1f9] dark:bg-[#2d2648] text-gray-600 dark:text-[#c5bfd8] hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"}`}
                style={index === 0 ? { background: PRIMARY } : undefined}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {narudzbe.map((n, index) => (
              <div
                key={index}
                className={`rounded-xl border-l-4 p-4 ${statusCardClass[n.boja]}`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-4 items-start">
                    <div className="text-xs font-semibold text-gray-500 dark:text-[#7d7498] pt-0.5">
                      {n.vrijeme}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 dark:text-[#ede9f6]">
                        {n.kupac}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#7d7498] mt-0.5">
                        {n.artikli} · {n.iznos} · Isporuka: {n.isporuka}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadgeClass[n.boja]}`}
                    >
                      {n.status}
                    </span>
                    <button className="p-2 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all">
                      <Eye className="h-4 w-4 text-gray-600 dark:text-[#c5bfd8]" />
                    </button>
                    <button className="p-2 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all">
                      <Pencil className="h-4 w-4 text-gray-600 dark:text-[#c5bfd8]" />
                    </button>
                    <button
                      className="p-2 rounded-xl text-white transition-all hover:brightness-110"
                      style={{ background: PRIMARY }}
                    >
                      <Truck className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button
              className="text-sm font-semibold hover:underline transition-all"
              style={{ color: PRIMARY }}
            >
              Pogledaj sve narudžbe →
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal za odabir artikala ─────────────────────────── */}
      {pokaziModalArtikli &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) zatvoriModal();
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] flex flex-col"
              style={{ width: "min(1200px, 92vw)", height: "min(760px, 88vh)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d2648]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: PRIMARY }}
                  >
                    <Package size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-[#ede9f6]">
                      Odabir artikala
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-[#7d7498]">
                      Označite artikle i unesite količine, zatim kliknite OK
                    </p>
                  </div>
                </div>
                <button
                  onClick={zatvoriModal}
                  className="p-2 rounded-xl text-gray-500 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 min-h-0">
                {/* Grupe sidebar */}
                <div className="w-80 flex-shrink-0 border-r border-gray-100 dark:border-[#2d2648] overflow-y-auto">
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878] px-2 mb-2">
                      Grupe
                    </p>
                    <button
                      onClick={() => setOdabranaGrupa(null)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 ${odabranaGrupa === null ? "text-white" : "text-gray-700 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"}`}
                      style={
                        odabranaGrupa === null
                          ? { background: PRIMARY }
                          : undefined
                      }
                    >
                      <span className="flex-1 text-left">Sve grupe</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${odabranaGrupa === null ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-[#2d2648] text-gray-500 dark:text-[#7d7498]"}`}
                      >
                        {artikli.length}
                      </span>
                    </button>
                    {artikliGrupe.map((g, i) => {
                      const gId = grupaIdKey ? Number(g[grupaIdKey]) : 0;
                      const gNaziv = readGrupaNaziv(g);
                      const count = artikalGrupaKey
                        ? artikli.filter(
                            (a) =>
                              Number(
                                (a as Record<string, unknown>)[artikalGrupaKey],
                              ) === gId,
                          ).length
                        : 0;
                      const active = odabranaGrupa === gId;
                      return (
                        <button
                          key={i}
                          onClick={() => setOdabranaGrupa(gId)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 ${active ? "text-white" : "text-gray-700 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"}`}
                          style={active ? { background: PRIMARY } : undefined}
                        >
                          <span className="flex-1 text-left">{gNaziv}</span>
                          {count > 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-[#2d2648] text-gray-500 dark:text-[#7d7498]"}`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Artikli */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Search */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2d2648]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        autoFocus
                        value={modalPretraga}
                        onChange={(e) => setModalPretraga(e.target.value)}
                        placeholder="Pretraži po nazivu ili šifri..."
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  {/* Zaglavlje kolona */}
                  <div className="grid grid-cols-[32px_1fr_70px_100px_90px_120px] items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-[#2d2648] bg-[#f4f1f9] dark:bg-[#1e1a2d]">
                    <span />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                      Naziv artikla
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                      JM
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878] text-right">
                      Cijena (KM)
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878] text-right">
                      Na stanju
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878] text-center">
                      Količina
                    </span>
                  </div>

                  {/* Lista */}
                  <div className="flex-1 overflow-y-auto">
                    {artikliLoading ? (
                      <div className="flex items-center justify-center h-full gap-3 text-gray-400 dark:text-[#5f5878]">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">Učitavanje artikala...</span>
                      </div>
                    ) : artikliFiltrirani.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-[#5f5878]">
                        <Package
                          size={28}
                          className="text-gray-300 dark:text-[#3a3158]"
                        />
                        <span className="text-sm">
                          Nema artikala za prikazati
                        </span>
                      </div>
                    ) : (
                      artikliFiltrirani.map((a) => {
                        const sifraNum = Number(a.sifra_proizvoda);
                        const odabran = modalOdabrani.has(sifraNum);
                        const kolicinaStr = modalOdabrani.get(sifraNum) ?? "";
                        const bezStanja = a.kolicinaNaStanju <= 0;

                        return (
                          <div
                            key={a.sifra_proizvoda}
                            className={`grid grid-cols-[32px_1fr_70px_100px_90px_120px] items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-[#2a2043] transition-all cursor-pointer ${
                              bezStanja
                                ? odabran
                                  ? "bg-gray-200 dark:bg-gray-700"
                                  : "opacity-50 hover:opacity-60 hover:bg-gray-100 dark:hover:bg-gray-800"
                                : odabran
                                  ? "bg-[#ede8f5] dark:bg-[#2a2043]"
                                  : "bg-[#f2fae9] dark:bg-[#1c2d10] hover:bg-[#ede8f5] dark:hover:bg-[#2a2043]"
                            }`}
                            onClick={() => toggleArtikalOdabir(a)}
                          >
                            {/* Checkbox */}
                            <div
                              className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                              style={{
                                borderColor: odabran
                                  ? bezStanja
                                    ? "#9ca3af"
                                    : PRIMARY
                                  : bezStanja
                                    ? "#d1d5db"
                                    : ACCENT,
                                background: odabran
                                  ? bezStanja
                                    ? "#9ca3af"
                                    : PRIMARY
                                  : "transparent",
                              }}
                            >
                              {odabran && (
                                <Check
                                  size={11}
                                  className="text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </div>

                            {/* Naziv */}
                            <div className="min-w-0">
                              <div
                                className={`text-sm truncate ${odabran ? "font-semibold text-gray-900 dark:text-[#ede9f6]" : "font-medium text-gray-700 dark:text-[#c5bfd8]"}`}
                              >
                                {a.naziv_proizvoda}
                              </div>
                            </div>

                            {/* JM */}
                            <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                              {a.jm}
                            </div>

                            {/* Cijena */}
                            <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] text-right">
                              {parseCijena(a.mpc).toFixed(2)} KM
                            </div>

                            {/* Na stanju */}
                            <div
                              className={`text-sm text-right font-semibold ${bezStanja ? "text-gray-400 dark:text-gray-500" : "text-green-600 dark:text-green-400"}`}
                            >
                              {a.kolicinaNaStanju.toFixed(3)}
                            </div>

                            {/* Količina — samo unos putem tastature */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <input
                                ref={(el) => {
                                  if (el) inputRefsModal.current[sifraNum] = el;
                                }}
                                type="text"
                                inputMode="decimal"
                                value={kolicinaStr}
                                disabled={!odabran}
                                placeholder={odabran ? "0.000" : "—"}
                                onFocus={(e) => {
                                  setKolicinaUModalu(sifraNum, "");
                                  e.target.select();
                                }}
                                onChange={(e) =>
                                  setKolicinaUModalu(sifraNum, e.target.value)
                                }
                                className={`w-full text-center text-sm font-semibold px-2 py-1.5 rounded-lg border outline-none transition-all ${
                                  odabran
                                    ? bezStanja
                                      ? "border-red-300 dark:border-red-700 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:border-red-400"
                                      : "border-[#785E9E]/50 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:border-[#785E9E]"
                                    : "border-gray-200 dark:border-[#3a3158] bg-gray-50 dark:bg-[#1e1a2d] text-gray-300 dark:text-[#3a3158] cursor-not-allowed"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-[#2d2648] bg-[#f4f1f9] dark:bg-[#1e1a2d] rounded-b-2xl">
                <div className="flex items-center gap-2">
                  {validniOdabraniCount > 0 ? (
                    <>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: PRIMARY }}
                      >
                        {validniOdabraniCount}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                        {validniOdabraniCount === 1
                          ? "artikal spreman"
                          : validniOdabraniCount < 5
                            ? "artikla spremna"
                            : "artikala spremno"}
                      </span>
                    </>
                  ) : modalOdabrani.size > 0 ? (
                    <span className="text-sm text-amber-500 dark:text-amber-400">
                      Unesite količine za označene artikle
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-[#5f5878]">
                      Nije odabran nijedan artikal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={zatvoriModal}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={potvrdiOdabirArtikala}
                    disabled={validniOdabraniCount === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: PRIMARY }}
                  >
                    <Check size={15} /> OK — Dodaj u narudžbu
                  </button>
                </div>
              </div>
            </div>

            {/* ── Upozorenje: nema na stanju ──────────────────── */}
            {upozorenjeArtikalSifra !== null &&
              (() => {
                const a = artikli.find(
                  (x) => Number(x.sifra_proizvoda) === upozorenjeArtikalSifra,
                );
                return (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                  >
                    <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] p-7 max-w-sm w-full mx-4">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30">
                          <AlertTriangle size={22} className="text-red-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-[#ede9f6] mb-1">
                            Roba nije na stanju
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                            <span className="font-semibold">
                              {a?.naziv_proizvoda}
                            </span>{" "}
                            trenutno ima{" "}
                            <span className="font-bold text-red-500">0</span>{" "}
                            jedinica na stanju.
                          </p>
                          <p className="text-sm text-gray-500 dark:text-[#7d7498] mt-2">
                            Da li svejedno želite dodati ovaj artikal u
                            narudžbu?
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setUpozorenjeArtikalSifra(null)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                        >
                          Odustani
                        </button>
                        <button
                          onClick={handleUpozorenjeConfirm}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
                        >
                          Dodaj svejedno
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>,
          document.body,
        )}

      {/* Modal za izbor kupca */}
      {pokaziModalKupci &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPokazuiModalKupci(false);
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] flex flex-col"
              style={{ width: "min(720px, 90vw)", height: "min(600px, 90vh)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d2648]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: PRIMARY }}
                  >
                    <User size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-[#ede9f6]">
                      Odabir kupca
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-[#7d7498]">
                      Odaberite kupca iz liste
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPokazuiModalKupci(false)}
                  className="p-2 rounded-xl text-gray-500 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-gray-100 dark:border-[#2d2648]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pretraži po nazivu kupca..."
                    value={pretragaKupci}
                    onChange={(e) => setPretragaKupci(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {kupciLoading ? (
                  <div className="flex items-center justify-center h-full gap-3 text-gray-400 dark:text-[#5f5878]">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm">Učitavanje kupaca...</span>
                  </div>
                ) : kupci.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-[#5f5878]">
                    <User
                      size={28}
                      className="text-gray-300 dark:text-[#3a3158]"
                    />
                    <span className="text-sm">Nema dostupnih kupaca</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {kupci
                      .filter((k) =>
                        k.Naziv_partnera.toLowerCase().includes(
                          pretragaKupci.toLowerCase(),
                        ),
                      )
                      .map((k) => (
                        <div
                          key={k.sifra_kup}
                          className={`rounded-xl border-2 p-1 ${
                            k.dodatna_lokacija
                              ? "border-[#8FC74A] dark:border-[#8FC74A]"
                              : "border-transparent"
                          }`}
                        >
                          {/* Glavni kupac */}
                          <button
                            onClick={() => {
                              setOdabraniKupac(k);
                              setPokazuiModalKupci(false);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all text-left"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                                <User size={13} style={{ color: PRIMARY }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                                  {k.Naziv_partnera}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                                  {k.Naziv_grada} · ID: {k.sifra_kup}
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Dodatne lokacije */}
                          {k.dodatna_lokacija && (
                            <button
                              onClick={() => {
                                setOdabraniKupac({
                                  ...k,
                                  Naziv_grada:
                                    k.dodatna_lokacija?.Naziv_grada ??
                                    k.Naziv_grada,
                                });
                                setPokazuiModalKupci(false);
                              }}
                              className="w-full ml-2 mt-1 flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-[#f4f1f9] dark:bg-[#1a1529] hover:bg-[#ede8f5] dark:hover:bg-[#2a2043] transition-all text-left"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-white dark:bg-[#261f38]">
                                  <MapPin
                                    size={13}
                                    style={{ color: PRIMARY }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-gray-700 dark:text-[#c5bfd8] truncate">
                                    {k.dodatna_lokacija.Naziv_grada ??
                                      `Lokacija ${k.dodatna_lokacija.sifra_partnera}`}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                                    Dodatna lokacija
                                  </div>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-[#2d2648] bg-[#f4f1f9] dark:bg-[#1e1a2d] rounded-b-2xl">
                <button
                  onClick={() => setPokazuiModalKupci(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                >
                  Odustani
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function StatCard({
  icon,
  broj,
  opis,
  type,
}: {
  icon: React.ReactNode;
  broj: string;
  opis: string;
  type: "primary" | "green" | "orange" | "accent";
}) {
  const styles = {
    primary: { bg: "bg-[#ede8f5] dark:bg-[#312a50]", color: PRIMARY },
    green: { bg: "bg-green-100 dark:bg-green-900/30", color: "#16a34a" },
    orange: { bg: "bg-orange-100 dark:bg-orange-900/30", color: "#ea580c" },
    accent: { bg: "bg-[#edf7e0] dark:bg-[#1a2c12]", color: ACCENT },
  };
  const s = styles[type];
  return (
    <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg}`}
          style={{ color: s.color }}
        >
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-800 dark:text-[#ede9f6]">
            {broj}
          </div>
          <div className="text-xs text-gray-500 dark:text-[#7d7498]">
            {opis}
          </div>
        </div>
      </div>
    </div>
  );
}
