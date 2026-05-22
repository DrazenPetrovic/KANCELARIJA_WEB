import ReactDOM from "react-dom";
import { FixedSizeList } from "react-window";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  Calendar,
  ShoppingCart,
  Truck,
  Plus,
  Trash2,
  Package,
  User,
  Star,
  PenLine,
  MapPin,
  X,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
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

const isoToDisplay = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

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
  adresa_lokacije?: string;
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

interface HistorijaStavka {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm?: string;
  kolicina?: number | string;
  vpc?: number | string;
  mpc?: number | string;
  [key: string]: unknown;
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
  vpc: number;
  cijena: number; // mpc — za prikaz
  naziv_grupe?: string;
}

interface ActiveOrder {
  id: number;
  order_number: string;
  referent_number: string | null;
  partner_id: number;
  partner_name: string;
  branch_id: number | null;
  branch_name: string | null;
  order_type: string;
  radnik_id: number;
  vrsta_placanja: number;
  created_by: number;
  order_date: string;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  status_id: number;
  priority: number;
  notes: string | null;
  partner_order_number: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  line_number: number;
  product_id: number;
  product_name: string;
  product_uom: string;
  product_group: string | null;
  quantity: number;
  vpc: number;
  mpc: number;
  created_at: string;
  updated_at: string;
}

const priorityLabel: Record<number, { label: string; cls: string }> = {
  1: {
    label: "Normalan",
    cls: "bg-gray-100 dark:bg-[#2d2648] text-gray-500 dark:text-[#7d7498]",
  },
  2: {
    label: "Dogovorena",
    cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  3: {
    label: "Hitno",
    cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-400 dark:border-red-500",
  },
};

const paymentLabel: Record<number, string> = {
  1: "Žirano",
  2: "Gotovinsko",
};

const fmtKolicina = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const ArtikalKartica = memo(
  ({ artikal, onKlik }: { artikal: Artikal; onKlik: (a: Artikal) => void }) => {
    const handleClick = useCallback(() => onKlik(artikal), [onKlik, artikal]);
    return (
    <div
      className={`bg-white dark:bg-[#1e1a2d] rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow${artikal.kolicinaNaStanju > 0 ? " border-2" : ""}`}
      style={artikal.kolicinaNaStanju > 0 ? { borderColor: PRIMARY } : undefined}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-semibold" style={{ color: PRIMARY }}>
          {artikal.sifra_proizvoda}
        </span>
        <span className="text-[11px] font-bold" style={{ color: PRIMARY }}>
          {fmtKolicina(artikal.kolicinaNaStanju)} ({artikal.jm})
        </span>
      </div>
      <div className="text-xs font-semibold text-gray-800 dark:text-[#ede9f6] leading-tight mb-2 line-clamp-2">
        {artikal.naziv_proizvoda}
      </div>
      <div className="space-y-1">
        <div className="rounded px-2 py-1 flex items-center justify-between bg-[#f0f4ff] dark:bg-[#1a1f35]">
          <span className="text-[10px] font-semibold" style={{ color: PRIMARY }}>VPC</span>
          <span className="text-[11px] font-bold" style={{ color: ACCENT }}>
            {parseCijena(artikal.vpc).toFixed(2)} KM
          </span>
        </div>
        <div className="rounded px-2 py-1 flex items-center justify-between bg-[#f0fff4] dark:bg-[#0f2d1a]">
          <span className="text-[10px] font-semibold" style={{ color: PRIMARY }}>MPC</span>
          <span className="text-[11px] font-bold" style={{ color: ACCENT }}>
            {parseCijena(artikal.mpc).toFixed(2)} KM
          </span>
        </div>
      </div>
    </div>
    );
  },
);

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

  // ── vrsta plaćanja (1 = žirano, 2 = gotovinsko) ─────────────
  const [vrstaPlacan, setVrstaPlacan] = useState<1 | 2>(1);

  // ── ostali podaci o narudžbi ─────────────────────────────────
  const [datumIsporuke, setDatumIsporuke] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const [prioritet, setPrioritet] = useState<1 | 2 | 3>(1);
  const [napomena, setNapomena] = useState("");
  const [partnerOrderNumber, setPartnerOrderNumber] = useState("");
  const [partnerOrderDate, setPartnerOrderDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── artikli + modal ──────────────────────────────────────────
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [artikliLoading, setArtikliLoading] = useState(false);
  const [artikliDohvaceni, setArtikliDohvaceni] = useState(false);
  const [pokaziModalArtikli, setPokazuiModalArtikli] = useState(false);
  const [modalPretraga, setModalPretraga] = useState("");
  const [pregledArtikla, setPregledArtikla] = useState<Artikal | null>(null);
  const [unosKolicina, setUnosKolicina] = useState("");
  const unosInputRef = useRef<HTMLInputElement>(null);
  const [upozorenjeNulaStanje, setUpozorenjeNulaStanje] = useState<Artikal | null>(null);
  const [pokaziUpozorenjePrekStanja, setPokazuiUpozorenjePrekStanja] = useState(false);
  const handleArtikalKlik = useCallback((a: Artikal) => {
    if (a.kolicinaNaStanju === 0) {
      setUpozorenjeNulaStanje(a);
    } else {
      setPregledArtikla(a);
    }
  }, []);
  const centerPanelRef = useRef<HTMLDivElement>(null);
  const [centerPanelHeight, setCenterPanelHeight] = useState(500);
  useEffect(() => {
    const el = centerPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCenterPanelHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pokaziModalArtikli]);

  const [historijaArtikala, setHistorijaArtikala] = useState<HistorijaStavka[]>([]);
  const [historijaLoading, setHistorijaLoading] = useState(false);
  const [historijaPartnerId, setHistorijaPartnerId] = useState<number | null>(null);
  const artikalListRef = useRef<HTMLDivElement>(null);
  const [artikalListHeight, setArtikalListHeight] = useState(500);
  useEffect(() => {
    const el = artikalListRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArtikalListHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pokaziModalArtikli]);
  // Map: sifra_proizvoda → string količina ("" = odabran ali bez unosa)
  const [modalOdabrani, setModalOdabrani] = useState<Map<number, string>>(
    new Map(),
  );
  // Upozorenje za narudžbu
  const [upozorenjeNarudzbe, setUpozorenjeNarudzbe] = useState<string | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── aktivne narudžbe (desna strana) ─────────────────────────
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(true);
  const [activeOrdersError, setActiveOrdersError] = useState<string | null>(
    null,
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Record<number, OrderItem[]>>({});
  const [orderItemsLoading, setOrderItemsLoading] = useState<
    Record<number, boolean>
  >({});
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

  // ── aktivne narudžbe: dohvat i polling svakih 30s ───────────
  const fetchActiveOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trade-orders/active`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        startTransition(() => {
          setActiveOrders(json.data);
          setActiveOrdersError(null);
          setLastRefreshed(new Date());
        });
      } else {
        setActiveOrdersError(json.error || "Greška pri dohvatu narudžbi");
      }
    } catch {
      setActiveOrdersError("Nema veze sa serverom");
    } finally {
      setActiveOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 90000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOrder = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (orderItems[orderId]) return;
    setOrderItemsLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(
        `${API_URL}/api/trade-orders/active/${orderId}/items`,
        { credentials: "include" },
      );
      const json = await res.json();
      if (json.success) {
        setOrderItems((prev) => ({ ...prev, [orderId]: json.data }));
      }
    } catch {
      // greška — items ostaju prazni
    } finally {
      setOrderItemsLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pokaziModalArtikli) zatvoriModal();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [pokaziModalArtikli]);


  // ── Fokus na search input kada se otvori modal ──────────────
  useEffect(() => {
    if (pokaziModalArtikli && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [pokaziModalArtikli]);

  // ── Kad se odabere artikal: prefill količine i fokus na input ─
  useEffect(() => {
    if (!pregledArtikla) return;
    const postojeca = modalOdabrani.get(Number(pregledArtikla.sifra_proizvoda));
    setUnosKolicina(postojeca ?? "");
    setTimeout(() => unosInputRef.current?.focus(), 50);
  }, [pregledArtikla]);
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

  const handleSacuvaj = async () => {
    if (!odabraniKupac) {
      setUpozorenjeNarudzbe("Molimo odaberite kupca");
      return;
    }
    if (stavke.length === 0) {
      setUpozorenjeNarudzbe("Molimo dodajte najmanje jedan artikal");
      return;
    }

    const referentNumber = Array.from(
      crypto.getRandomValues(new Uint8Array(10)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/api/trade-orders/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: odabraniKupac.sifra_kup,
          partnerName: odabraniKupac.Naziv_partnera,
          vrstaPlacanja: vrstaPlacan,
          datumIsporuke,
          prioritet,
          napomena,
          referentNumber,
          partnerOrderNumber: partnerOrderNumber || null,
          partnerOrderDate: partnerOrderDate || null,
          stavke: stavke.map((s) => ({
            sifraProizvoda: s.sifra_proizvoda,
            nazivProizvoda: s.naziv_proizvoda,
            jm: s.jm,
            kolicina: s.kolicina,
            vpc: s.vpc,
            mpc: s.cijena,
            grupaProizvoda: s.naziv_grupe ?? null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Greška pri snimanju");
      setOdabraniKupac(null);
      setPretraga("");
      setStavke([]);
      setNapomena("");
      setDatumIsporuke(new Date().toISOString().slice(0, 10));
      setPrioritet(1);
      setPartnerOrderNumber("");
      setPartnerOrderDate("");
      fetchActiveOrders();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Greška pri snimanju");
    } finally {
      setSaving(false);
    }
  };

  // ── modal artikli ────────────────────────────────────────────
  const otvoriModalArtikli = async () => {
    const init = new Map<number, string>();
    stavke.forEach((s) => init.set(s.sifra_proizvoda, Number(s.kolicina).toFixed(3)));
    setModalOdabrani(init);
    setPokazuiModalArtikli(true);

    if (!artikliDohvaceni) {
      setArtikliLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/artikli`, {
          credentials: "include",
        });
        const json = await res.json();
        if (json.success) {
          setArtikli(
            (json.data as Artikal[]).map((a) => ({
              ...a,
              kolicinaNaStanju:
                a.kolicina_proizvoda != null
                  ? Number(String(a.kolicina_proizvoda).replace(",", "."))
                  : 0,
            })),
          );
          setArtikliDohvaceni(true);
        }
      } catch {
        /* tiho */
      } finally {
        setArtikliLoading(false);
      }
    }

    if (odabraniKupac && historijaPartnerId !== odabraniKupac.sifra_kup) {
      setHistorijaLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/narudzbe/ranije-uzimano?sifraPartnera=${odabraniKupac.sifra_kup}&nazivPartnera=${encodeURIComponent(odabraniKupac.Naziv_partnera)}`,
          { credentials: "include" },
        );
        const json = await res.json();
        if (json.success) {
          setHistorijaArtikala(json.data);
          setHistorijaPartnerId(odabraniKupac.sifra_kup);
        }
      } catch {
        /* tiho */
      } finally {
        setHistorijaLoading(false);
      }
    }
  };

  const zatvoriModal = () => {
    setPokazuiModalArtikli(false);
    setModalPretraga("");
    setPregledArtikla(null);
  };

  const potvrdiOdabirArtikala = () => {
    const bySifra = new Map(artikli.map((a) => [Number(a.sifra_proizvoda), a]));
    const novaStavke: StavkaNarudzbe[] = [];
    modalOdabrani.forEach((kolicinaStr, sifra) => {
      const kolicina = parseFloat(kolicinaStr);
      if (!kolicinaStr || isNaN(kolicina) || kolicina <= 0) return;
      const a = bySifra.get(sifra);
      if (a) {
        novaStavke.push({
          sifra_proizvoda: Number(a.sifra_proizvoda),
          naziv_proizvoda: a.naziv_proizvoda,
          jm: a.jm,
          kolicina,
          vpc: parseCijena(a.vpc),
          cijena: parseCijena(a.mpc),
          naziv_grupe: a.naziv_grupe,
        });
      }
    });
    setStavke((prev) => {
      const updated = [...prev];
      novaStavke.forEach((nova) => {
        const idx = updated.findIndex(
          (s) => s.sifra_proizvoda === nova.sifra_proizvoda,
        );
        if (idx >= 0) updated[idx] = nova;
        else updated.push(nova);
      });
      return updated;
    });
    zatvoriModal();
  };

  // ── stavke u listi narudžbe ──────────────────────────────────
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

  const ukupnoIznos = stavke.reduce((s, x) => s + x.kolicina * x.cijena, 0);

  // Filtrirani artikli za modal
  const artikliFiltrirani = useMemo(() => {
    if (!modalPretraga.trim()) return artikli;
    const q = modalPretraga.toLowerCase();
    return artikli.filter(
      (a) =>
        a.naziv_proizvoda.toLowerCase().includes(q) ||
        String(a.sifra_proizvoda).includes(q),
    );
  }, [artikli, modalPretraga]);

  // Broj stavki u modalu koje imaju validnu količinu
  const ukupnoModal = useMemo(() => {
    let suma = 0;
    modalOdabrani.forEach((kolStr, sifra) => {
      const kol = parseFloat(kolStr);
      if (isNaN(kol) || kol <= 0) return;
      const a = artikli.find((x) => Number(x.sifra_proizvoda) === sifra);
      if (a) suma += kol * parseCijena(a.mpc);
    });
    return suma;
  }, [modalOdabrani, artikli]);

  const odabraniCardHeight = useMemo(() => {
    const count = modalOdabrani.size;
    if (count === 0) return 168;
    const stickyH = 48;
    const padV = 16;
    const gap = 8;
    const available = centerPanelHeight - stickyH - padV * 2;
    const ideal = Math.floor((available - gap * (count - 1)) / count);
    return Math.min(168, Math.max(82, ideal));
  }, [modalOdabrani.size, centerPanelHeight]);

  const validniOdabraniCount = useMemo(
    () =>
      Array.from(modalOdabrani.values()).filter(
        (v) => v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      ).length,
    [modalOdabrani],
  );

  return (
    <div className="space-y-6">
      {/* Zaglavlje */}
      <div className="relative flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <PenLine size={20} style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Unos narudžbe lokalno
          </h2>
        </div>

        {/* Pillovi — apsolutno centrirani */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] text-xs font-semibold whitespace-nowrap">
            <ShoppingCart size={13} style={{ color: PRIMARY }} />
            <span className="text-gray-500 dark:text-[#7d7498]">Uneseno</span>
            <span className="font-bold text-gray-800 dark:text-[#ede9f6]">
              {activeOrders.length}
            </span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] text-xs font-semibold whitespace-nowrap">
            <Truck size={13} className="text-green-500" />
            <span className="text-gray-500 dark:text-[#7d7498]">Isporuka</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {
                activeOrders.filter(
                  (o) =>
                    o.requested_delivery_date?.slice(0, 10) ===
                    new Date().toISOString().slice(0, 10),
                ).length
              }
            </span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-xs font-semibold whitespace-nowrap">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-red-500 dark:text-red-400">Hitno</span>
            <span className="font-bold text-red-600 dark:text-red-400">
              {activeOrders.filter((o) => o.priority === 3).length}
            </span>
          </span>
        </div>

        {/* Pretraga — desno */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pretraži kupca, narudžbu, artikal..."
            className="w-80 pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878]"
          />
        </div>
      </div>

      {/* Glavni grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr]">
        {/* Forma za unos */}
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
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
            <button
              className="px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all whitespace-nowrap hover:brightness-110"
              style={{ background: PRIMARY }}
            >
              + Novi kupac
            </button>
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
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] text-gray-600 dark:text-[#c5bfd8] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] hover:border-[#785E9E] dark:hover:border-[#785E9E] transition-all whitespace-nowrap text-xs font-semibold"
              >
                <User className="h-4 w-4 flex-shrink-0" style={{ color: PRIMARY }} />
                <span>Pregled partnera</span>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider mb-1 text-center">
                Datum isporuke <span className="text-red-400 ml-0.5">*</span>
              </label>
              <div className="relative">
                <div
                  className={`${inputClass} flex items-center justify-between pointer-events-none`}
                >
                  <span>{isoToDisplay(datumIsporuke)}</span>
                  <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                </div>
                <input
                  type="date"
                  value={datumIsporuke}
                  onChange={(e) => setDatumIsporuke(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider mb-1 text-center">
                Prioritet
              </label>
              <select
                value={prioritet}
                onChange={(e) =>
                  setPrioritet(Number(e.target.value) as 1 | 2 | 3)
                }
                className={inputClass}
              >
                <option value={1}>Normalan</option>
                <option value={2}>Dogovorena isporuka</option>
                <option value={3}>Hitno</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider mb-1 text-center">
                Način plaćanja
              </label>
              <div className="flex rounded-xl border border-gray-200 dark:border-[#3a3158] overflow-hidden h-[42px]">
                <button
                  type="button"
                  onClick={() => setVrstaPlacan(1)}
                  className={`flex-1 text-sm font-semibold transition-all ${vrstaPlacan === 1 ? "text-white" : "text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"}`}
                  style={
                    vrstaPlacan === 1 ? { background: PRIMARY } : undefined
                  }
                >
                  Žirano
                </button>
                <div className="w-px bg-gray-200 dark:bg-[#3a3158]" />
                <button
                  type="button"
                  onClick={() => setVrstaPlacan(2)}
                  className={`flex-1 text-sm font-semibold transition-all ${vrstaPlacan === 2 ? "text-white" : "text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"}`}
                  style={
                    vrstaPlacan === 2 ? { background: PRIMARY } : undefined
                  }
                >
                  Gotovinsko
                </button>
              </div>
            </div>
          </div>

          {/* Broj i datum narudžbe od partnera */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label optional>Broj narudžbe partnera</Label>
              <input
                type="text"
                value={partnerOrderNumber}
                onChange={(e) => setPartnerOrderNumber(e.target.value)}
                placeholder="npr. PN-2025-001"
                className={inputClass}
                maxLength={50}
              />
            </div>
            <div>
              <Label optional>Datum narudžbe partnera</Label>
              <div className="relative">
                <div
                  className={`${inputClass} flex items-center justify-between pointer-events-none`}
                >
                  <span
                    className={
                      partnerOrderDate
                        ? ""
                        : "text-gray-300 dark:text-[#5f5878]"
                    }
                  >
                    {partnerOrderDate
                      ? isoToDisplay(partnerOrderDate)
                      : "dd.mm.yyyy"}
                  </span>
                  <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                </div>
                <input
                  type="date"
                  value={partnerOrderDate}
                  onChange={(e) => setPartnerOrderDate(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={s.kolicina}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+\.?\d{0,3}$/.test(val)) {
                              const novaKolicina =
                                val === "" ? 0 : parseFloat(val);
                              promijeniKolicinu(
                                s.sifra_proizvoda,
                                novaKolicina - s.kolicina,
                              );
                            }
                          }}
                          className="w-full text-center text-sm font-semibold bg-transparent text-gray-800 dark:text-[#ede9f6] outline-none"
                        />
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
              value={napomena}
              onChange={(e) => setNapomena(e.target.value)}
              placeholder="Unesite napomenu..."
              className={`${inputClass} h-24 resize-none`}
            />
          </div>

          {/* Akcije */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePoništi}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
              >
                Poništi
              </button>
              <button
                onClick={handleSacuvaj}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all disabled:opacity-70"
                style={{ background: PRIMARY }}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Snimanje...
                  </>
                ) : (
                  <>
                    <Check size={15} /> Sačuvaj narudžbu
                  </>
                )}
              </button>
            </div>
            {saveError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                <AlertTriangle size={14} />
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Aktivne narudžbe */}
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: PRIMARY }}
              >
                <ShoppingCart size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                  Aktivne narudžbe
                </h3>
                <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                  {lastRefreshed
                    ? `Osvježeno u ${lastRefreshed.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                    : "Učitavanje..."}
                  {" · auto 90s"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveOrdersLoading(true);
                fetchActiveOrders();
              }}
              title="Osvježi"
              className="p-2 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
            >
              <Loader2
                size={16}
                className={`text-gray-500 dark:text-[#7d7498] ${activeOrdersLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Sadržaj */}
          {activeOrdersError ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle size={15} />
              {activeOrdersError}
            </div>
          ) : activeOrdersLoading && activeOrders.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-[#5f5878]">
              <Loader2 size={18} className="animate-spin mr-2" />
              Učitavanje narudžbi...
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-[#5f5878]">
              <ShoppingCart
                size={28}
                className="text-gray-300 dark:text-[#3a3158]"
              />
              Nema aktivnih narudžbi
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {activeOrders.map((order, index) => {
                const isExpanded = expandedOrderId === order.id;
                const items = orderItems[order.id] ?? [];
                const itemsLoading = orderItemsLoading[order.id] ?? false;
                const prio = priorityLabel[order.priority] ?? priorityLabel[1];
                const createdDate = new Date(order.created_at);
                const createdTime = createdDate.toLocaleTimeString("bs-BA", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const createdDay = isoToDisplay(order.created_at.slice(0, 10));
                const deliveryDate = order.requested_delivery_date
                  ? isoToDisplay(order.requested_delivery_date.slice(0, 10))
                  : "—";

                return (
                  <div
                    key={order.id}
                    className={`relative rounded-xl overflow-hidden ${
                      order.priority === 3
                        ? "border-2 border-red-400 dark:border-red-500"
                        : index === 0
                          ? "border border-[#785E9E]/50 dark:border-[#785E9E]/40"
                          : "border border-gray-200 dark:border-[#3a3158]"
                    }`}
                  >
                    {/* Akcentna linija za zadnji unos */}
                    {index === 0 && (
                      <>
                        <div
                          className="absolute left-0 inset-y-0 w-[3px] pointer-events-none z-10"
                          style={{ background: PRIMARY }}
                        />
                        <div
                          className="absolute top-0 left-0 h-[5px] w-2/3 pointer-events-none z-10"
                          style={{
                            background: `linear-gradient(to right, ${PRIMARY}, transparent)`,
                          }}
                        />
                      </>
                    )}
                    {/* Red narudžbe */}
                    <button
                      onClick={() => handleToggleOrder(order.id)}
                      className={`w-full text-left px-4 py-3 transition-all ${
                        index === 0
                          ? "bg-[#f9f7fd] dark:bg-[#221c35] hover:bg-[#f4f0fb] dark:hover:bg-[#2a2242]"
                          : "bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          {/* Red 1: vrijeme + datum */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-400 dark:text-[#5f5878]">
                              {createdTime}
                            </span>
                            <span className="text-[10px] text-gray-300 dark:text-[#3a3158]">
                              {createdDay}
                            </span>
                          </div>
                          {/* Redovi 2-4: uvučeni do desne ivice vremena */}
                          <div className="flex flex-col gap-0.5 min-w-0 pl-9">
                            {/* Red 2: naziv partnera */}
                            <div className="font-bold text-gray-800 dark:text-[#ede9f6] truncate">
                              {order.partner_name}
                            </div>
                            {/* Red 3: broj narudžbe + isporuka */}
                            <div className="text-xs text-gray-500 dark:text-[#7d7498] flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono">
                                {order.partner_order_number ??
                                  order.order_number}
                              </span>
                              {order.referent_number && (
                                <span className="text-gray-400 dark:text-[#5f5878]">
                                  ({order.referent_number.slice(0, 8)})
                                </span>
                              )}
                              <span>·</span>
                              <span>Isporuka: {deliveryDate}</span>
                            </div>
                            {/* Red 4: napomena */}
                            {order.notes && (
                              <div className="text-xs text-gray-400 dark:text-[#5f5878] italic truncate">
                                {order.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Vrsta plaćanja + prioritet + expand ikona */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: PRIMARY }}
                          >
                            {paymentLabel[order.vrsta_placanja] ?? "—"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prio.cls}`}
                          >
                            {prio.label}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-gray-400 dark:text-[#5f5878] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Stavke narudžbe */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-[#2d2648] bg-[#f8f6fc] dark:bg-[#16122a]">
                        {itemsLoading ? (
                          <div className="flex items-center justify-center py-4 text-sm text-gray-400 dark:text-[#5f5878]">
                            <Loader2 size={14} className="animate-spin mr-2" />
                            Učitavanje stavki...
                          </div>
                        ) : items.length === 0 ? (
                          <div className="py-4 text-center text-xs text-gray-400 dark:text-[#5f5878]">
                            Nema stavki
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-[#2d2648]">
                                  <th className="text-left px-4 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    #
                                  </th>
                                  <th className="text-left px-2 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    Artikal
                                  </th>
                                  <th className="text-right px-2 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    Kol.
                                  </th>
                                  <th className="text-left px-2 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    JM
                                  </th>
                                  <th className="text-right px-2 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    VPC
                                  </th>
                                  <th className="text-right px-4 py-2 font-bold text-gray-400 dark:text-[#5f5878] uppercase tracking-wider">
                                    MPC
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="border-b border-gray-100 dark:border-[#1e1a2d] last:border-b-0"
                                  >
                                    <td className="px-4 py-2 text-gray-400 dark:text-[#5f5878]">
                                      {item.line_number}
                                    </td>
                                    <td className="px-2 py-2 font-medium text-gray-800 dark:text-[#ede9f6]">
                                      {item.product_name}
                                    </td>
                                    <td className="px-2 py-2 text-right font-semibold text-gray-700 dark:text-[#c5bfd8]">
                                      {Number(item.quantity) % 1 === 0
                                        ? Number(item.quantity).toFixed(0)
                                        : Number(item.quantity).toFixed(3)}
                                    </td>
                                    <td className="px-2 py-2 text-gray-500 dark:text-[#7d7498]">
                                      {item.product_uom}
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-500 dark:text-[#7d7498]">
                                      {Number(item.vpc).toFixed(2)}
                                    </td>
                                    <td
                                      className="px-4 py-2 text-right font-semibold"
                                      style={{ color: PRIMARY }}
                                    >
                                      {Number(item.mpc).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
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
          )}

          {/* Footer sa brojem */}
          {activeOrders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2d2648] flex items-center justify-between text-xs text-gray-400 dark:text-[#5f5878]">
              <span>
                Ukupno aktivnih:{" "}
                <strong className="text-gray-700 dark:text-[#c5bfd8]">
                  {activeOrders.length}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal za odabir artikala ── */}
      {pokaziModalArtikli &&
        ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.55)" }}
            >
              <div
                className="relative bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] flex flex-col"
                style={{
                  width: "calc(100vw - 20px)",
                  height: "calc(100vh - 20px)",
                  margin: "10px",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: PRIMARY }}
                    >
                      <Package size={16} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 dark:text-[#ede9f6]">
                        Odabir artikala
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-[#7d7498]">
                        {modalOdabrani.size > 0
                          ? `${modalOdabrani.size} odabrano`
                          : "Odaberite artikle iz liste"}
                      </p>
                    </div>
                  </div>

                  {odabraniKupac && (
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl flex-1 min-w-0" style={{ background: "#f4f1f9" }}>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: PRIMARY }}
                      >
                        <User size={14} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-gray-800 dark:text-[#ede9f6]">
                          {odabraniKupac.Naziv_partnera}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-[#7d7498] truncate">
                          {odabraniKupac.Naziv_grada}
                          {odabraniKupac.dodatna_lokacija?.naziv_lokacije
                            ? ` · ${odabraniKupac.dodatna_lokacija.naziv_lokacije}`
                            : ""}
                          <span className="ml-2 font-mono opacity-60">#{odabraniKupac.sifra_kup}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={zatvoriModal}
                    className="p-2 rounded-xl text-gray-500 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all flex-shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tijelo — lijevo 260px | centar prazan | desno 260px */}
                <div className="flex-1 overflow-hidden flex">
                  {/* Lijeva kolona — lista artikala */}
                  <div className="w-[260px] border-r border-gray-100 dark:border-[#2d2648] flex flex-col flex-shrink-0">
                    {/* Pretraga */}
                    <div className="p-3 border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Pretraži artikle..."
                          value={modalPretraga}
                          onChange={(e) => setModalPretraga(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                      {!artikliLoading && (
                        <p className="text-[10px] text-gray-400 dark:text-[#5f5878] mt-1 px-1">
                          {modalPretraga
                            ? `${artikliFiltrirani.length} rezultata`
                            : `${artikli.length} artikala`}
                        </p>
                      )}
                    </div>
                    {/* Lista — virtualizovana */}
                    <div ref={artikalListRef} className="flex-1">
                      {artikliLoading ? (
                        <div className="flex items-center justify-center h-40 gap-3 text-gray-400 dark:text-[#5f5878]">
                          <Loader2 size={20} className="animate-spin" />
                          <span className="text-sm">Učitavanje...</span>
                        </div>
                      ) : (
                        <FixedSizeList
                          height={artikalListHeight}
                          width="100%"
                          itemCount={artikliFiltrirani.length}
                          itemSize={138}
                          overscanCount={5}
                        >
                          {({ index, style }) => (
                            <div style={{ ...style, paddingLeft: 8, paddingRight: 8, paddingBottom: 4 }}>
                              <ArtikalKartica
                                artikal={artikliFiltrirani[index]}
                                onKlik={handleArtikalKlik}
                              />
                            </div>
                          )}
                        </FixedSizeList>
                      )}
                    </div>
                  </div>
                  {/* Centralni dio — odabrane stavke / unos količine */}
                  <div ref={centerPanelRef} className="flex-1 overflow-y-auto min-h-0">
                    {!pregledArtikla ? (
                      /* ── Lista odabranih stavki ── */
                      modalOdabrani.size === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-gray-300 dark:text-[#3a3158] select-none p-8">
                          <div>
                            <Package size={40} className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Odaberite artikal iz liste</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2d2648] flex items-center justify-between sticky top-0 bg-white dark:bg-[#261f38] z-10">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#7d7498]">
                              Odabrani artikli
                            </h4>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: PRIMARY }}>
                              {modalOdabrani.size}
                            </span>
                          </div>
                          <div className="px-4 pb-4 pt-2 flex flex-col" style={{ gap: odabraniCardHeight < 110 ? 4 : 8 }}>
                            {Array.from(modalOdabrani.entries()).reverse().map(([sifra, kolStr], index) => {
                              const a = artikli.find((x) => Number(x.sifra_proizvoda) === sifra);
                              const vpc = a ? parseCijena(a.vpc) : 0;
                              const mpc = a ? parseCijena(a.mpc) : 0;
                              const kol = parseFloat(kolStr);
                              const ukupno = !isNaN(kol) && kol > 0 ? kol * mpc : null;
                              const isLatest = index === 0;

                              const cardBody = (
                                <>
                                  {/* Gornji dio — kompresuje se kad nema mjesta */}
                                  <div className="px-4 pt-2 pb-1 flex items-start justify-between gap-3 flex-1 min-h-0 overflow-hidden" style={{ background: PRIMARY + "0d" }}>
                                    <div className="min-w-0 overflow-hidden flex-1">
                                      <span className="text-[10px] font-bold font-mono block truncate" style={{ color: PRIMARY }}>{sifra}</span>
                                      <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: isLatest ? "#111827" : PRIMARY }}>{a?.naziv_proizvoda ?? "—"}</p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        setModalOdabrani((prev) => {
                                          const m = new Map(prev);
                                          m.delete(sifra);
                                          return m;
                                        })
                                      }
                                      className="flex-shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>

                                  {/* Donji dio — uvijek vidljiv */}
                                  <div className="px-4 py-2 flex items-center gap-3 flex-shrink-0 relative">
                                    <div className="flex gap-2 text-[11px]">
                                      <div className="rounded-lg px-2 py-1 bg-[#f0f4ff] dark:bg-[#1a1f35]">
                                        <span className="text-gray-400 dark:text-[#5f5878]">VPC </span>
                                        <span className="font-bold" style={{ color: PRIMARY }}>{vpc.toFixed(2)}</span>
                                      </div>
                                      <div className="rounded-lg px-2 py-1 bg-[#f0fff4] dark:bg-[#0f2d1a]">
                                        <span className="text-gray-400 dark:text-[#5f5878]">MPC </span>
                                        <span className="font-bold" style={{ color: ACCENT }}>{mpc.toFixed(2)}</span>
                                      </div>
                                    </div>
                                    {ukupno !== null && odabraniCardHeight < 130 && (
                                      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#5f5878] leading-none mb-0.5">Ukupno</span>
                                        <span className="text-[11px] font-bold" style={{ color: ACCENT }}>{ukupno.toFixed(2)} KM</span>
                                      </div>
                                    )}
                                    <div className="flex-1 flex items-center gap-2 justify-end">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.000"
                                        value={kolStr}
                                        onChange={(e) =>
                                          setModalOdabrani((prev) => {
                                            const m = new Map(prev);
                                            m.set(sifra, e.target.value);
                                            return m;
                                          })
                                        }
                                        onBlur={() => {
                                          const n = parseFloat(kolStr.replace(",", "."));
                                          if (!isNaN(n) && n > 0)
                                            setModalOdabrani((prev) => {
                                              const m = new Map(prev);
                                              m.set(sifra, n.toFixed(3));
                                              return m;
                                            });
                                        }}
                                        className="w-24 px-3 py-1.5 text-right text-sm font-bold border-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#785E9E]/20 bg-white dark:bg-[#261f38] text-gray-800 dark:text-[#ede9f6] transition-colors"
                                        style={{ borderColor: PRIMARY + "55" }}
                                      />
                                      <span className="text-xs font-bold w-10 text-center" style={{ color: PRIMARY }}>
                                        ({a?.jm ?? ""})
                                      </span>
                                    </div>
                                  </div>

                                  {ukupno !== null && odabraniCardHeight >= 130 && (
                                    <div className="px-4 pb-2 flex justify-center flex-shrink-0">
                                      <span className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                                        Ukupno: <span className="font-bold text-sm" style={{ color: ACCENT }}>{ukupno.toFixed(2)} KM</span>
                                      </span>
                                    </div>
                                  )}
                                </>
                              );

                              return isLatest ? (
                                <div
                                  key={sifra}
                                  className="relative flex-shrink-0 rounded-2xl overflow-hidden p-[2px]"
                                  style={{ height: odabraniCardHeight, background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})` }}
                                >
                                  <div className="relative rounded-[14px] bg-white dark:bg-[#1e1a2d] overflow-hidden flex flex-col w-full h-full">
                                    {cardBody}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  key={sifra}
                                  className="rounded-2xl border-2 bg-white dark:bg-[#1e1a2d] overflow-hidden flex-shrink-0 flex flex-col"
                                  style={{ borderColor: PRIMARY + "33", height: odabraniCardHeight }}
                                >
                                  {cardBody}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )
                    ) : (
                      <div className="flex items-center justify-center p-8">
                      <div className="w-full max-w-sm">
                        {/* Info o artiklu */}
                        <div className="mb-5">
                          <p className="text-[11px] font-semibold mb-1" style={{ color: PRIMARY }}>
                            {pregledArtikla.sifra_proizvoda}
                          </p>
                          <h3 className="text-base font-bold text-gray-800 dark:text-[#ede9f6] leading-snug mb-3">
                            {pregledArtikla.naziv_proizvoda}
                          </h3>
                          <div className="flex gap-2">
                            <div className="flex-1 rounded-xl px-3 py-2 bg-[#f0fff4] dark:bg-[#0f2d1a] flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] mb-0.5">Na stanju</span>
                              <span className="text-sm font-bold" style={{ color: pregledArtikla.kolicinaNaStanju > 0 ? ACCENT : "#f87171" }}>
                                {fmtKolicina(pregledArtikla.kolicinaNaStanju)}
                              </span>
                              <span className="text-[10px] text-gray-400">({pregledArtikla.jm})</span>
                            </div>
                            <div className="flex-1 rounded-xl px-3 py-2 bg-[#f0f4ff] dark:bg-[#1a1f35] flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] mb-0.5">VPC</span>
                              <span className="text-sm font-bold" style={{ color: PRIMARY }}>
                                {parseCijena(pregledArtikla.vpc).toFixed(2)} KM
                              </span>
                            </div>
                            <div className="flex-1 rounded-xl px-3 py-2 bg-[#f0f4ff] dark:bg-[#1a1f35] flex flex-col items-center">
                              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] mb-0.5">MPC</span>
                              <span className="text-sm font-bold" style={{ color: PRIMARY }}>
                                {parseCijena(pregledArtikla.mpc).toFixed(2)} KM
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Unos količine */}
                        <div className="mb-4">
                          <label className="block text-xs font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wider mb-2">
                            Količina ({pregledArtikla.jm})
                          </label>
                          <input
                            ref={unosInputRef}
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="0.000"
                            value={unosKolicina}
                            onChange={(e) => setUnosKolicina(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const k = parseFloat(unosKolicina);
                                if (!isNaN(k) && k > 0) {
                                  if (pregledArtikla.kolicinaNaStanju > 0 && k > pregledArtikla.kolicinaNaStanju) {
                                    setPokazuiUpozorenjePrekStanja(true);
                                  } else {
                                    setModalOdabrani((prev) => {
                                      const m = new Map(prev);
                                      m.set(Number(pregledArtikla.sifra_proizvoda), k.toFixed(3));
                                      return m;
                                    });
                                    setPregledArtikla(null);
                                  }
                                }
                              }
                              if (e.key === "Escape") setPregledArtikla(null);
                            }}
                            className={`${inputClass} text-center text-lg font-bold`}
                          />
                        </div>

                        {/* Dugmad */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => setPregledArtikla(null)}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                          >
                            Odustani
                          </button>
                          <button
                            onClick={() => {
                              const k = parseFloat(unosKolicina);
                              if (!isNaN(k) && k > 0) {
                                if (pregledArtikla.kolicinaNaStanju > 0 && k > pregledArtikla.kolicinaNaStanju) {
                                  setPokazuiUpozorenjePrekStanja(true);
                                } else {
                                  setModalOdabrani((prev) => {
                                    const m = new Map(prev);
                                    m.set(Number(pregledArtikla.sifra_proizvoda), k.toFixed(3));
                                    return m;
                                  });
                                  setPregledArtikla(null);
                                }
                              } else {
                                setPregledArtikla(null);
                              }
                            }}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all"
                            style={{ background: PRIMARY }}
                          >
                            Dodaj u narudžbu
                          </button>
                        </div>
                      </div>
                      </div>
                    )}
                  </div>

                  {/* Desna kolona — historija partnera, ista širina kao lijevo */}
                  <div className="w-[260px] border-l border-gray-100 dark:border-[#2d2648] flex flex-col flex-shrink-0">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#7d7498]">
                        Ranije uzimano
                      </h4>
                    </div>

                    {!odabraniKupac ? (
                      <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-[#3a3158] px-4 text-center">
                        <span className="text-xs">Odaberite partnera</span>
                      </div>
                    ) : historijaLoading ? (
                      <div className="flex-1 flex items-center justify-center gap-2 text-gray-400 dark:text-[#5f5878]">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">Učitavanje...</span>
                      </div>
                    ) : historijaArtikala.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-[#3a3158] px-4 text-center">
                        <span className="text-xs">Nema historije narudžbi</span>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto">
                        {historijaArtikala.map((s, i) => {
                          const matching = artikli.find(
                            (a) => String(a.sifra_proizvoda) === String(s.sifra_proizvoda),
                          );
                          const nemaStanja = matching !== undefined && matching.kolicinaNaStanju === 0;
                          return (
                          <div
                            key={`${s.sifra_proizvoda}-${i}`}
                            className={`px-4 py-2 border-b border-gray-50 dark:border-[#2d2648] cursor-pointer transition-colors ${
                              nemaStanja
                                ? "bg-gray-50 dark:bg-[#1a1730] hover:bg-gray-100 dark:hover:bg-[#211d35] opacity-60"
                                : "hover:bg-[#f9f7fd] dark:hover:bg-[#2d2648]"
                            }`}
                            onClick={() => {
                              if (!matching) return;
                              if (matching.kolicinaNaStanju === 0) {
                                setUpozorenjeNulaStanje(matching);
                              } else {
                                setPregledArtikla(matching);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span
                                className={`text-[10px] font-semibold font-mono ${nemaStanja ? "text-gray-400 dark:text-[#5f5878]" : ""}`}
                                style={nemaStanja ? undefined : { color: PRIMARY }}
                              >
                                {s.sifra_proizvoda}
                              </span>
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: nemaStanja ? "#f87171" : PRIMARY }}
                              >
                                {matching
                                  ? `${fmtKolicina(matching.kolicinaNaStanju)} (${matching.jm})`
                                  : (s.jm ?? "")}
                              </span>
                            </div>
                            <p className={`text-[11px] font-medium leading-snug line-clamp-2 ${nemaStanja ? "text-gray-400 dark:text-[#5f5878]" : "text-gray-800 dark:text-[#ede9f6]"}`}>
                              {s.naziv_proizvoda}
                            </p>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0" style={{ borderTop: `2px solid ${PRIMARY}` }}>
                  <button
                    onClick={zatvoriModal}
                    className="px-6 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                  >
                    Odbaci
                  </button>

                  {/* Ukupno */}
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">Ukupno</span>
                    <span className="text-xl font-bold" style={{ color: ukupnoModal > 0 ? ACCENT : "inherit" }}>
                      {ukupnoModal > 0
                        ? ukupnoModal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KM"
                        : "—"}
                    </span>
                  </div>

                  <button
                    onClick={potvrdiOdabirArtikala}
                    disabled={validniOdabraniCount === 0}
                    className="px-8 py-2.5 text-sm font-semibold rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: PRIMARY }}
                  >
                    Dodaj
                    {validniOdabraniCount > 0 ? ` (${validniOdabraniCount})` : ""}
                  </button>
                </div>

                {/* Upozorenje — artikal bez stanja */}
                {upozorenjeNulaStanje && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center z-20"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] p-6 w-full max-w-sm mx-4">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/30">
                          <AlertTriangle size={24} className="text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-[#ede9f6] mb-1">
                            Artikal nije na stanju
                          </h4>
                          <p className="text-[11px] font-semibold mb-1" style={{ color: PRIMARY }}>
                            {upozorenjeNulaStanje.sifra_proizvoda}
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8] leading-snug">
                            {upozorenjeNulaStanje.naziv_proizvoda}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-2">
                            Trenutno stanje: <span className="font-bold text-red-500">0.000 ({upozorenjeNulaStanje.jm})</span>
                          </p>
                          <p className="text-xs text-gray-400 dark:text-[#5f5878] mt-1">
                            Možete svejedno unijeti ovaj artikal u narudžbu.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setUpozorenjeNulaStanje(null)}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                        >
                          Odustani
                        </button>
                        <button
                          onClick={() => {
                            setPregledArtikla(upozorenjeNulaStanje);
                            setUpozorenjeNulaStanje(null);
                          }}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:brightness-110"
                          style={{ background: PRIMARY }}
                        >
                          Ipak unesi
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upozorenje — količina veća od stanja */}
                {pokaziUpozorenjePrekStanja && pregledArtikla && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center z-20"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] p-6 w-full max-w-sm mx-4">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/30">
                          <AlertTriangle size={24} className="text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-[#ede9f6] mb-1">
                            Količina premašuje stanje
                          </h4>
                          <p className="text-[11px] font-semibold mb-1" style={{ color: PRIMARY }}>
                            {pregledArtikla.sifra_proizvoda}
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-[#c5bfd8] leading-snug">
                            {pregledArtikla.naziv_proizvoda}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-2">
                            Na stanju:{" "}
                            <span className="font-bold" style={{ color: PRIMARY }}>
                              {fmtKolicina(pregledArtikla.kolicinaNaStanju)} ({pregledArtikla.jm})
                            </span>
                            , unosite:{" "}
                            <span className="font-bold text-orange-500">
                              {parseFloat(unosKolicina) > 0 ? parseFloat(unosKolicina).toFixed(3) : unosKolicina} ({pregledArtikla.jm})
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 dark:text-[#5f5878] mt-1">
                            Možete svejedno nastaviti sa unosom.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setPokazuiUpozorenjePrekStanja(false)}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                        >
                          Odustani
                        </button>
                        <button
                          onClick={() => {
                            const k = parseFloat(unosKolicina);
                            if (!isNaN(k) && k > 0) {
                              setModalOdabrani((prev) => {
                                const m = new Map(prev);
                                m.set(Number(pregledArtikla.sifra_proizvoda), k.toFixed(3));
                                return m;
                              });
                            }
                            setPregledArtikla(null);
                            setPokazuiUpozorenjePrekStanja(false);
                          }}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:brightness-110"
                          style={{ background: PRIMARY }}
                        >
                          Ipak unesi
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </>,
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
              style={{ width: "min(864px, 92vw)", height: "min(780px, 92vh)" }}
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
                      Odabir partnera
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-[#7d7498]">
                      Odaberite partnera iz liste
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
                      .sort((a, b) =>
                        a.Naziv_partnera.localeCompare(b.Naziv_partnera, "bs"),
                      )
                      .map((k) => (
                        <div
                          key={k.sifra_kup}
                          className={`rounded-xl border-2 p-1 ${
                            k.sifra_kup >= 10000
                              ? "border-[#785E9E] dark:border-[#785E9E]"
                              : k.dodatna_lokacija
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
                                {k.sifra_kup >= 10000 ? (
                                  <Star
                                    size={13}
                                    fill="#8FC74A"
                                    color="#8FC74A"
                                  />
                                ) : (
                                  <User size={13} style={{ color: PRIMARY }} />
                                )}
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
                                    {k.dodatna_lokacija.naziv_lokacije ??
                                      k.dodatna_lokacija.Naziv_grada ??
                                      `Lokacija ${k.dodatna_lokacija.sifra_partnera}`}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-[#7d7498] truncate">
                                    {k.dodatna_lokacija.adresa_lokacije ??
                                      "Dodatna lokacija"}
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

      {/* Modal upozorenja za narudžbu */}
      {upozorenjeNarudzbe &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setUpozorenjeNarudzbe(null);
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] p-6 max-w-sm w-full">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle size={22} className="text-orange-500" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-[#ede9f6]">
                    Nepotpuna narudžba
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-[#c5bfd8] mt-1">
                    {upozorenjeNarudzbe}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setUpozorenjeNarudzbe(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                >
                  Razumijem
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
