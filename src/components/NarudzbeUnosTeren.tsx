import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Trash2, Loader, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

type RecentProduct = {
  sifra: string;
  naziv: string;
};

type ZadnjiDanNarudzbe = {
  sifra_partnera: number;
  zadnji_datum_dostave: string;
  broj_dana: number;
};

const CUSTOMER_CODE_THRESHOLD = 10000;

const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const startOfDay = (value: Date | string): Date => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const generateReferentniBroj = (): string => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 3 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join("");
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}_${rand}`;
};

interface Order {
  id: string;
  code: string;
  productName: string;
  unit: string;
  quantity: number;
  note?: string;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  orders: Order[];
}

interface City {
  id: string;
  name: string;
  customers: Customer[];
}

interface NarudzbaProizvod {
  sif: string;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  napomena?: string;
  sifra_kupca: number;
}

interface NarudzbaKupac {
  sifra_kupca: number;
  naziv_kupca: string;
  referentni_broj?: string;
  pripada_radniku?: string;
  proizvodi: NarudzbaProizvod[];
}

interface TerenoData {
  sifra_terena_dostava: number;
  sifra_terena: number;
  datum_dostave: string;
  zavrsena_dostava: number;
  naziv_dana: string;
}

interface TerenGrad {
  sifra_tabele: number;
  sifra_terena: number;
  naziv_terena: string;
  sifra_grada: number;
  naziv_grada: string;
  aktivan: number;
}

interface Kupac {
  sifra_kupca: number;
  naziv_kupca: string;
  sifra_grada: number;
  naziv_grada: string;
  vrsta_kupca: number;
  pripada_radniku?: number;
}

interface DodatnaLokacija {
  sifra_partnera: number;
  sifra_lokacije?: number | string;
  sifra_grada?: number | string;
  naziv_lokacije?: string;
  naziv_grada?: string;
  adresa?: string;
  grad?: string;
  mjesto?: string;
  [key: string]: unknown;
}

interface Artikal {
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  kolicinaNaStanju: number;
}

interface DaySchedule {
  sifraTerenaDostava: number;
  sifraTerena: number;
  date: string;
  day: string;
  cities: City[];
}

interface DayOption {
  sifraTerenaDostava: number;
  sifraTerena: number;
  day: string;
  date: string;
}

interface TerenDostaveInfo {
  sifraTerenaDostava: number;
  datum_dostave: string;
  dan_dostave: string;
}

const normalizeReferentniBroj = (value?: string | null): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "-") return "";
  return normalized;
};

const getKupacGroupingKey = (
  sifraKupca: number,
  referentniBroj?: string | null,
): string => {
  const normalizedReferentniBroj = normalizeReferentniBroj(referentniBroj);
  return normalizedReferentniBroj
    ? `${sifraKupca}::${normalizedReferentniBroj}`
    : String(sifraKupca);
};

const getLokacijaLabel = (lok: DodatnaLokacija, index: number): string => {
  const nazivLokacije = String(lok?.naziv_lokacije || "").trim();
  const grad =
    String(lok?.naziv_grada || "").trim() ||
    String(lok?.grad || "").trim() ||
    String(lok?.mjesto || "").trim();
  if (nazivLokacije && grad) return `${nazivLokacije} (${grad})`;
  const fallback = nazivLokacije || String(lok?.adresa || "").trim() || grad;
  return fallback || `Lokacija ${index + 1}`;
};

export function NarudzbeUnosTeren() {
  const [tereniData, setTereniData] = useState<TerenoData[]>([]);
  const [terenGradData, setTerenGradData] = useState<TerenGrad[]>([]);
  const [kupciData, setKupciData] = useState<Kupac[]>([]);
  const [loading, setLoading] = useState(true);
  const [terenGradLoading, setTerenGradLoading] = useState(true);
  const [kupciLoading, setKupciLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTerenaSifra, setSelectedTerenaSifra] = useState<number | null>(
    null,
  );
  const [selectedTerenInfo, setSelectedTerenInfo] =
    useState<TerenDostaveInfo | null>(null);
  const [selectedKupac, setSelectedKupac] = useState<Kupac | null>(null);
  const [showKupacModal, setShowKupacModal] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [narudzbePoKupcu, setNarudzbePoKupcu] = useState<NarudzbaKupac[]>([]);
  const [loadingNarudzbe, setLoadingNarudzbe] = useState(false);
  const [terenGradError, setTerenGradError] = useState<string | null>(null);
  const [kupciError, setKupciError] = useState<string | null>(null);
  const [expandedGrad, setExpandedGrad] = useState<number | null>(null);
  const [searchKupac, setSearchKupac] = useState<string>("");
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [searchArtikli, setSearchArtikli] = useState("");
  const [selectedArtiklModal, setSelectedArtiklModal] =
    useState<Artikal | null>(null);
  const [novaArtiklUNarudzbi, setNovaArtiklUNarudzbi] = useState<
    (Artikal & { kolicina: number; napomena: string; trazenaCijena: number })[]
  >([]);
  const [artiklKolicina, setArtiklKolicina] = useState<number>(1);
  const [artiklNapomena, setArtiklNapomena] = useState<string>("");
  const [artiklTrazenaCijena, setArtiklTrazenaCijena] = useState<number>(0);
  const [selectedVrstaPlacanja, setSelectedVrstaPlacanja] = useState<
    number | null
  >(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const RECENT_PREVIEW_COUNT = 4;
  const totalRecent = recentProducts.length;
  const visibleRecent = recentExpanded
    ? recentProducts
    : recentProducts.slice(0, RECENT_PREVIEW_COUNT);
  const canExpand = totalRecent > RECENT_PREVIEW_COUNT;
  const [seenRecent, setSeenRecent] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showOutOfStockConfirm, setShowOutOfStockConfirm] =
    useState<boolean>(false);
  const outOfStockConfirmActionRef = useRef<(() => void) | null>(null);
  const kolicinaInputRef = useRef<HTMLInputElement | null>(null);
  const [zadnjiDanMap, setZadnjiDanMap] = useState<Record<number, number>>({});
  const sifraRadnika = 0;

  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [showDeletePartnerConfirm, setShowDeletePartnerConfirm] =
    useState<boolean>(false);
  const deletePartnerConfirmActionRef = useRef<(() => void) | null>(null);
  const [showDeleteProizvodConfirm, setShowDeleteProizvodConfirm] =
    useState<boolean>(false);
  const deleteProizvodConfirmActionRef = useRef<(() => void) | null>(null);
  const [showNotif, setShowNotif] = useState<boolean>(false);
  const [notifMessage, setNotifMessage] = useState<string>("");
  const [dodatneLokacijeByPartner, setDodatneLokacijeByPartner] = useState<
    Record<number, DodatnaLokacija[]>
  >({});
  const [showDodatnaLokacijaModal, setShowDodatnaLokacijaModal] =
    useState(false);
  const [pendingKupacSelection, setPendingKupacSelection] = useState<{
    kupac: Kupac;
    terenInfo: TerenDostaveInfo;
  } | null>(null);
  const [selectedDodatnaLokacija, setSelectedDodatnaLokacija] =
    useState<DodatnaLokacija | null>(null);
  const [selectedOrderGradSifra, setSelectedOrderGradSifra] = useState<
    number | null
  >(null);
  const [headerCollapsed] = useState<boolean>(false);

  const parsePriceValue = (
    price: number | string | undefined | null,
  ): number => {
    if (price === null || price === undefined) return 0;
    if (typeof price === "number") return isNaN(price) ? 0 : price;
    const normalized = String(price).trim().replace(/\s+/g, "");
    if (!normalized) return 0;
    const withoutThousands = normalized
      .replace(/\.(?=.*[,])/g, "")
      .replace(/,/g, ".");
    const parsed = Number(withoutThousands);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatPrice = (price: number | string | undefined | null): string =>
    parsePriceValue(price).toFixed(2);

  const getPrice = (price: number | string | undefined | null): number =>
    parsePriceValue(price);

  const getDefaultTrazenaCijena = (artikal?: Artikal | null): number => {
    if (!artikal) return 0;
    return getPrice(artikal.mpc);
  };

  const getVrstePaymentaZaKupca = (
    sifraKupca: number,
  ): { kod: number; naziv: string }[] => {
    if (sifraKupca >= 10000) {
      return [{ kod: 4, naziv: "Gotovina RK" }];
    } else {
      return [
        { kod: 1, naziv: "Žiralni" },
        { kod: 2, naziv: "Gotovina knjiženje" },
      ];
    }
  };

  const mockSchedule: Record<number, DaySchedule> = {};

  const handleAddArtiklToModalOrder = () => {
    if (!selectedArtiklModal || artiklKolicina <= 0) return;

    const trazenaInput = getPrice(artiklTrazenaCijena);
    const trazenaToSave =
      trazenaInput > 0
        ? trazenaInput
        : getDefaultTrazenaCijena(selectedArtiklModal);

    const existingIndex = novaArtiklUNarudzbi.findIndex(
      (a) => a.sifra_proizvoda === selectedArtiklModal.sifra_proizvoda,
    );

    if (existingIndex >= 0) {
      const updatedList = [...novaArtiklUNarudzbi];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        kolicina: updatedList[existingIndex].kolicina + artiklKolicina,
        napomena: artiklNapomena || updatedList[existingIndex].napomena,
        trazenaCijena:
          trazenaToSave || updatedList[existingIndex].trazenaCijena,
      };
      setNovaArtiklUNarudzbi(updatedList);
    } else {
      setNovaArtiklUNarudzbi([
        ...novaArtiklUNarudzbi,
        {
          ...selectedArtiklModal,
          kolicina: artiklKolicina,
          napomena: artiklNapomena,
          trazenaCijena: trazenaToSave,
        },
      ]);
    }

    setSelectedArtiklModal(null);
    setArtiklKolicina(1);
    setArtiklNapomena("");
    setArtiklTrazenaCijena(0);
  };

  const handleRemoveArtiklFromModalOrder = (sifraProizvoda: number) => {
    setNovaArtiklUNarudzbi(
      novaArtiklUNarudzbi.filter((a) => a.sifra_proizvoda !== sifraProizvoda),
    );
  };

  const handleUpdateModalArtiklKolicina = (
    sifraProizvoda: number,
    novaKolicina: number,
  ) => {
    if (novaKolicina <= 0) {
      handleRemoveArtiklFromModalOrder(sifraProizvoda);
      return;
    }
    setNovaArtiklUNarudzbi(
      novaArtiklUNarudzbi.map((a) =>
        a.sifra_proizvoda === sifraProizvoda
          ? { ...a, kolicina: novaKolicina }
          : a,
      ),
    );
  };

  const calculateModalTotalPrice = () =>
    novaArtiklUNarudzbi.reduce(
      (total, a) => total + getPrice(a.mpc) * a.kolicina,
      0,
    );

  const handleSaveNewOrder = async () => {
    if (!selectedKupac || novaArtiklUNarudzbi.length === 0) {
      alert("Odaberi kupca i dodaj najmanje jedan proizvod!");
      return;
    }
    if (!selectedVrstaPlacanja) {
      alert("OBAVEZNO odaberi vrstu plaćanja!");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      const referentniBroj = generateReferentniBroj();
      const parsedLokacijaGrad = Number(selectedDodatnaLokacija?.sifra_grada);
      const parsedOrderGrad = Number(selectedOrderGradSifra);
      const parsedKupacGrad = Number(selectedKupac.sifra_grada);
      const targetGradSifra =
        Number.isFinite(parsedLokacijaGrad) && parsedLokacijaGrad > 0
          ? parsedLokacijaGrad
          : Number.isFinite(parsedOrderGrad) && parsedOrderGrad > 0
            ? parsedOrderGrad
            : parsedKupacGrad;

      const currentDayRecord = tereniData.find(
        (t) => Number(t.sifra_terena_dostava) === Number(selectedDay),
      );

      const tereniZaGrad = terenGradData
        .filter((tg) => Number(tg.sifra_grada) === Number(targetGradSifra))
        .map((tg) => Number(tg.sifra_terena))
        .filter(
          (value, index, arr) =>
            Number.isFinite(value) && arr.indexOf(value) === index,
        );

      if (tereniZaGrad.length === 0) {
        alert(
          "Za odabrani grad ne postoji mapiran teren. Narudžba nije spremljena.",
        );
        return;
      }

      let targetSifraTerenaDostava: number | undefined =
        selectedTerenInfo?.sifraTerenaDostava;

      const matchByDayAndGrad = tereniData.find(
        (t) =>
          tereniZaGrad.includes(Number(t.sifra_terena)) &&
          String(t.datum_dostave) === String(currentDayRecord?.datum_dostave),
      );
      const fallbackByGrad = tereniData.find((t) =>
        tereniZaGrad.includes(Number(t.sifra_terena)),
      );

      targetSifraTerenaDostava =
        matchByDayAndGrad?.sifra_terena_dostava ??
        fallbackByGrad?.sifra_terena_dostava ??
        targetSifraTerenaDostava;

      if (!targetSifraTerenaDostava) {
        alert("Nije pronađen teren za odabrani grad/lokaciju.");
        return;
      }

      const orderData = {
        referentniBroj,
        sifraKupca: selectedKupac.sifra_kupca,
        sifraTerenaDostava: targetSifraTerenaDostava,
        vrstaPlacanja: selectedVrstaPlacanja,
        dodatnaLokacija: selectedDodatnaLokacija
          ? { ...selectedDodatnaLokacija }
          : null,
        proizvodi: novaArtiklUNarudzbi.map((a) => {
          const mpc = getPrice(a.mpc);
          const trazena = getPrice(a.trazenaCijena);
          const cijenaDio =
            trazena > 0 && trazena !== mpc ? `TC:${trazena.toFixed(2)}` : "";
          const napomenaDio = (a.napomena || "").trim();
          const finalNapomena = [napomenaDio, cijenaDio]
            .filter(Boolean)
            .join(" ");
          return {
            sifraProizvoda: a.sifra_proizvoda,
            kolicina: a.kolicina,
            napomena: finalNapomena,
            trazenaCijena: trazena,
          };
        }),
      };

      const response = await fetch(`${API_URL}/api/narudzbe/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderData),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();

      if (result.success) {
        setNotifMessage(`Narudžba uspješno spremljena! Ref: ${referentniBroj}`);
        setShowNotif(true);
        setNovaArtiklUNarudzbi([]);
        setSelectedArtiklModal(null);
        setArtiklKolicina(1);
        setArtiklNapomena("");
        setArtiklTrazenaCijena(0);
        setShowKupacModal(false);
        setSelectedKupac(null);
        setSelectedDodatnaLokacija(null);
        setPendingKupacSelection(null);
        setShowDodatnaLokacijaModal(false);
        setSelectedOrderGradSifra(null);
        setSelectedVrstaPlacanja(null);
        setSelectedTerenInfo(null);
        setSearchArtikli("");
        if (selectedDay) fetchAktivneNarudzbe(selectedDay);
      } else {
        setNotifMessage(
          "Greška: " +
            (result.error || result.message || "Greška pri spremanju narudžbe"),
        );
        setShowNotif(true);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setNotifMessage("Greška pri spremanju narudžbe: " + errorMessage);
      setShowNotif(true);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchTerenPoDanima();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSeenRecent(new Set());
  }, [selectedKupac?.sifra_kupca]);

  useEffect(() => {
    const mapToArtikal = (row: Record<string, unknown>): Artikal => ({
      sifra_proizvoda: Number(row.sifra_proizvoda ?? 0),
      naziv_proizvoda: String(row.naziv_proizvoda ?? ""),
      jm: String(row.jm ?? ""),
      vpc: (row.vpc as number | string | undefined) ?? 0,
      mpc: (row.mpc as number | string | undefined) ?? 0,
      kolicinaNaStanju:
        row.kolicina_proizvoda != null
          ? Number(String(row.kolicina_proizvoda).replace(",", "."))
          : 0,
    });

    const fetchArtikli = async () => {
      try {
        const response = await fetch(`${API_URL}/api/artikli`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!response.ok) {
          setArtikli([]);
          return;
        }
        const data = await response.json();
        if (data.success && data.data) {
          setArtikli(
            (data.data as Record<string, unknown>[]).map(mapToArtikal),
          );
        } else if (Array.isArray(data)) {
          setArtikli((data as Record<string, unknown>[]).map(mapToArtikal));
        } else {
          setArtikli([]);
        }
      } catch {
        setArtikli([]);
      }
    };
    if (showKupacModal) fetchArtikli();
  }, [showKupacModal]);

  const fetchTerenPoDanima = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/teren/terena-po-danima`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const tereniResult = await response.json();
      if (tereniResult.success && tereniResult.data) {
        setTereniData(tereniResult.data);

        const todayStart = startOfDay(new Date()).getTime();
        const visibleDays = Array.from(
          new Map(
            (tereniResult.data as TerenoData[]).map((t) => [
              t.sifra_terena_dostava,
              {
                sifraTerenaDostava: t.sifra_terena_dostava,
                sifraTerena: t.sifra_terena,
                rawDate: t.datum_dostave,
              },
            ]),
          ).values(),
        )
          .filter((d) => {
            const dTime = startOfDay(d.rawDate).getTime();
            return !Number.isNaN(dTime) && dTime >= todayStart;
          })
          .sort(
            (a, b) =>
              startOfDay(a.rawDate).getTime() - startOfDay(b.rawDate).getTime(),
          );

        const todayOption = visibleDays.find(
          (d) => startOfDay(d.rawDate).getTime() === todayStart,
        );
        const initialDay = todayOption || visibleDays[0];

        if (initialDay) {
          setSelectedDay(initialDay.sifraTerenaDostava);
          setSelectedTerenaSifra(initialDay.sifraTerena);
          fetchAktivneNarudzbe(initialDay.sifraTerenaDostava);
        } else {
          setSelectedDay(null);
          setSelectedTerenaSifra(null);
          setNarudzbePoKupcu([]);
        }
      }
    } catch (error) {
      console.error("Greška pri učitavanju terena:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerenGrad();
  }, []);

  const fetchTerenGrad = async () => {
    try {
      setTerenGradLoading(true);
      setTerenGradError(null);
      const response = await fetch(`${API_URL}/api/teren/teren-grad`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        setTerenGradError("Gradovi se nisu mogli učitati");
        return;
      }
      const terenGradResult = await response.json();
      if (terenGradResult.success && terenGradResult.data)
        setTerenGradData(terenGradResult.data);
    } catch {
      setTerenGradError("Greška pri učitavanju gradova");
    } finally {
      setTerenGradLoading(false);
    }
  };

  useEffect(() => {
    fetchTerenKupci();
  }, []);

  const fetchTerenKupci = async () => {
    try {
      setKupciLoading(true);
      setKupciError(null);
      const response = await fetch(`${API_URL}/api/teren/teren-kupci`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        setKupciError("Kupci se nisu mogli učitati");
        return;
      }
      const kupciResult = await response.json();
      if (kupciResult.success && kupciResult.data)
        setKupciData(kupciResult.data);
    } catch {
      setKupciError("Greška pri učitavanju kupaca");
    } finally {
      setKupciLoading(false);
    }
  };

  const fetchPartnerDodatneLokacije = async () => {
    try {
      const response = await fetch(`${API_URL}/api/partneri/dodatne-lokacije`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        setDodatneLokacijeByPartner({});
        return;
      }
      const result = await response.json();
      const rows = Array.isArray(result?.data) ? result.data : [];
      const grouped: Record<number, DodatnaLokacija[]> = {};
      rows.forEach((row: DodatnaLokacija) => {
        const sifra = Number(row?.sifra_partnera);
        if (!Number.isFinite(sifra)) return;
        if (!grouped[sifra]) grouped[sifra] = [];
        grouped[sifra].push(row);
      });
      setDodatneLokacijeByPartner(grouped);
    } catch {
      setDodatneLokacijeByPartner({});
    }
  };

  const getPartnerDodatneLokacije = (sifraKupca: number): DodatnaLokacija[] =>
    dodatneLokacijeByPartner[Number(sifraKupca)] || [];

  const hasPartnerDodatneLokacije = (sifraKupca: number): boolean =>
    getPartnerDodatneLokacije(sifraKupca).length > 0;

  const getPartnerPjZaGrad = (
    sifraKupca: number,
    sifraGrada: number,
  ): DodatnaLokacija[] => {
    const sveLokacije = getPartnerDodatneLokacije(sifraKupca);
    if (sveLokacije.length === 0) return [];
    const lokacijePoSifriGrada = sveLokacije.filter((lok) => {
      const sifra = Number(lok?.sifra_grada);
      return Number.isFinite(sifra) && sifra === sifraGrada;
    });
    if (lokacijePoSifriGrada.length > 0) return lokacijePoSifriGrada;
    const nazivGrada = (
      terenGradData.find((grad) => grad.sifra_grada === sifraGrada)
        ?.naziv_grada || ""
    )
      .toString()
      .trim()
      .toLowerCase();
    if (!nazivGrada) return sveLokacije;
    const lokacijePoNazivuGrada = sveLokacije.filter((lok) => {
      const naziv =
        String(lok?.naziv_grada || "")
          .trim()
          .toLowerCase() ||
        String(lok?.grad || "")
          .trim()
          .toLowerCase() ||
        String(lok?.mjesto || "")
          .trim()
          .toLowerCase();
      return naziv === nazivGrada;
    });
    return lokacijePoNazivuGrada.length > 0
      ? lokacijePoNazivuGrada
      : sveLokacije;
  };

  useEffect(() => {
    fetchPartnerDodatneLokacije();
  }, []);

  useEffect(() => {
    if (showKupacModal && selectedKupac?.sifra_kupca) {
      fetchRanijeUzimano(selectedKupac.sifra_kupca, selectedKupac.naziv_kupca);
      setSearchArtikli("");
    } else {
      setRecentProducts([]);
      setRecentError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKupacModal, selectedKupac?.sifra_kupca]);

  useEffect(() => {
    if (selectedArtiklModal) {
      setTimeout(() => {
        if (kolicinaInputRef.current) {
          kolicinaInputRef.current.focus();
          kolicinaInputRef.current.select();
        }
      }, 0);
    }
  }, [selectedArtiklModal]);

  useEffect(() => {
    if (!selectedArtiklModal || !selectedVrstaPlacanja) return;
    setArtiklTrazenaCijena(getDefaultTrazenaCijena(selectedArtiklModal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtiklModal, selectedVrstaPlacanja]);

  useEffect(() => {
    const fetchZadnjiDan = async () => {
      try {
        const res = await fetch(`${API_URL}/api/narudzbe/zadnji-dan-narudzbe`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (!res.ok || !json?.success) return;
        const map: Record<number, number> = {};
        (json.data as ZadnjiDanNarudzbe[]).forEach((r) => {
          map[Number(r.sifra_partnera)] = Number(r.broj_dana);
        });
        setZadnjiDanMap(map);
      } catch {
        setZadnjiDanMap({});
      }
    };
    fetchZadnjiDan();
  }, []);

  const fetchAktivneNarudzbe = async (sifraTerena: number) => {
    try {
      setLoadingNarudzbe(true);
      setNarudzbePoKupcu([]);
      const [grupisaneResponse, aktivneResponse] = await Promise.all([
        fetch(
          `${API_URL}/api/narudzbe/narudzbe-grupisane?sifraTerena=${sifraTerena}`,
          {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        ),
        fetch(
          `${API_URL}/api/narudzbe/narudzbe-aktivne?sifraTerena=${sifraTerena}`,
          {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        ),
      ]);
      if (!grupisaneResponse.ok || !aktivneResponse.ok) return;
      const grupisaneResult = await grupisaneResponse.json();
      const aktivneResult = await aktivneResponse.json();
      if (grupisaneResult.success && aktivneResult.success) {
        const grupisaneData = grupisaneResult.data || [];
        const aktivneData = aktivneResult.data || [];
        const kupciMap = new Map<string, NarudzbaKupac>();
        grupisaneData.forEach(
          (item: {
            sifra_partnera: number;
            naziv_partnera: string;
            partnera: string;
            referentni_broj: string;
            pripada_radniku?: string;
          }) => {
            const referentniBroj = normalizeReferentniBroj(
              item.referentni_broj,
            );
            const kupacKey = getKupacGroupingKey(
              item.sifra_partnera,
              referentniBroj,
            );
            if (!kupciMap.has(kupacKey)) {
              kupciMap.set(kupacKey, {
                sifra_kupca: item.sifra_partnera,
                naziv_kupca:
                  item.naziv_partnera || item.partnera || "Nepoznat kupac",
                referentni_broj: referentniBroj,
                pripada_radniku: String(item.pripada_radniku || "").trim(),
                proizvodi: [],
              });
            }
          },
        );
        aktivneData.forEach(
          (item: {
            sifra_patnera: number;
            sifra_partnera: number;
            sifra_proizvoda: string;
            naziv_proizvoda: string;
            jm: string;
            kolicina_proizvoda: number;
            napomena: string;
            referentni_broj?: string;
            pripada_radniku?: string;
          }) => {
            const sifraKupca = item.sifra_patnera || item.sifra_partnera;
            const referentniBroj = normalizeReferentniBroj(
              item.referentni_broj,
            );
            const pripadaRadniku = String(item.pripada_radniku || "").trim();
            const kupacKey = getKupacGroupingKey(sifraKupca, referentniBroj);
            let kupac = kupciMap.get(kupacKey);
            if (!kupac) kupac = kupciMap.get(String(sifraKupca));
            if (kupac) {
              if (!kupac.referentni_broj && referentniBroj)
                kupac.referentni_broj = referentniBroj;
              if (!kupac.pripada_radniku && pripadaRadniku)
                kupac.pripada_radniku = pripadaRadniku;
              kupac.proizvodi.push({
                sif: item.sifra_proizvoda,
                naziv_proizvoda: item.naziv_proizvoda,
                jm: item.jm,
                kolicina: item.kolicina_proizvoda,
                napomena: item.napomena || " ",
                sifra_kupca: sifraKupca,
              });
            }
          },
        );
        setNarudzbePoKupcu(Array.from(kupciMap.values()));
      }
    } catch (error) {
      console.error("Error fetching aktivne narudžbe:", error);
    } finally {
      setLoadingNarudzbe(false);
    }
  };

  const fetchRanijeUzimano = async (
    sifraPartnera: number,
    nazivPartnera?: string,
  ) => {
    try {
      setRecentLoading(true);
      setRecentError(null);
      const params = new URLSearchParams();
      params.set("sifraPartnera", String(sifraPartnera));
      if (nazivPartnera) params.set("nazivPartnera", nazivPartnera);
      const res = await fetch(
        `${API_URL}/api/narudzbe/ranije-uzimano?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const json = await res.json();
      if (!res.ok || !json?.success)
        throw new Error(json?.error || `HTTP greška: ${res.status}`);
      const mapped: RecentProduct[] = (json.data || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => ({
          sifra: String(
            row?.sifra ??
              row?.sifra_proizvoda ??
              row?.sifra_artikla ??
              row?.sif ??
              "",
          ),
          naziv: String(
            row?.naziv ??
              row?.naziv_proizvoda ??
              row?.naziv_artikla ??
              row?.naziv_pro ??
              "",
          ),
        }))
        .filter((p: RecentProduct) => p.sifra || p.naziv);
      setRecentProducts(mapped);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setRecentError(
        e?.message || "Greška pri učitavanju ranije uzimanih proizvoda",
      );
      setRecentProducts([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const getGradesForSelectedTeren = (): TerenGrad[] => {
    if (!selectedTerenaSifra) return [];
    return terenGradData
      .filter((tg) => tg.sifra_terena === selectedTerenaSifra)
      .sort((a, b) =>
        String(a.naziv_grada || "").localeCompare(
          String(b.naziv_grada || ""),
          "sr-Latn",
          { sensitivity: "base" },
        ),
      );
  };

  const getKupciForGrad = (sifraGrada: number): Kupac[] => {
    const kupciZaGrad = kupciData.filter((k) => {
      const osnovniGradMatch =
        Number(k.sifra_grada) === Number(sifraGrada) ||
        Number(k.sifra_grada) === 0;
      const imaPoslovnicuUGradu = getPartnerDodatneLokacije(k.sifra_kupca).some(
        (lok) => Number(lok?.sifra_grada) === Number(sifraGrada),
      );
      if (!osnovniGradMatch && !imaPoslovnicuUGradu) return false;
      if (sifraRadnika > 0)
        return Number(k.pripada_radniku) === Number(sifraRadnika);
      return true;
    });
    if (!searchKupac.trim()) return kupciZaGrad;
    const searchLower = searchKupac.toLowerCase();
    return kupciZaGrad.filter(
      (kupac) =>
        kupac.naziv_kupca.toLowerCase().includes(searchLower) ||
        kupac.sifra_kupca.toString().includes(searchKupac),
    );
  };

  const uniqueDays = Array.from(
    new Map(
      tereniData.map((t) => [
        t.sifra_terena_dostava,
        {
          sifraTerenaDostava: t.sifra_terena_dostava,
          sifraTerena: t.sifra_terena,
          day: t.naziv_dana,
          date: formatDate(t.datum_dostave),
          rawDate: t.datum_dostave,
        },
      ]),
    ).values(),
  )
    .sort((a, b) => {
      const aTime = new Date(a.rawDate).getTime();
      const bTime = new Date(b.rawDate).getTime();
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
      return a.sifraTerenaDostava - b.sifraTerenaDostava;
    })
    .filter((d) => {
      const dTime = startOfDay(d.rawDate).getTime();
      const todayTime = startOfDay(new Date()).getTime();
      return !Number.isNaN(dTime) && dTime >= todayTime;
    });

  const currentSchedule = selectedDay ? mockSchedule[selectedDay] : undefined;

  const filteredArtikli = artikli.filter((artikal) => {
    const search = searchArtikli.toLowerCase();
    return (
      artikal.naziv_proizvoda?.toLowerCase().includes(search) ||
      artikal.sifra_proizvoda?.toString().includes(searchArtikli)
    );
  });

  const toggleCity = (cityId: string) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityId)) newExpanded.delete(cityId);
    else newExpanded.add(cityId);
    setExpandedCities(newExpanded);
  };

  const getSelectedTerenInfo = (): TerenDostaveInfo | null => {
    if (selectedDay === null) return null;
    const d = uniqueDays.find((x) => x.sifraTerenaDostava === selectedDay);
    if (!d) return null;
    return {
      sifraTerenaDostava: d.sifraTerenaDostava,
      datum_dostave: d.date,
      dan_dostave: d.day,
    };
  };

  const handleDayClick = (day: DayOption) => {
    setSelectedDay(day.sifraTerenaDostava);
    setSelectedTerenaSifra(day.sifraTerena);
    setExpandedGrad(null);
    setSelectedKupac(null);
    setSelectedDodatnaLokacija(null);
    setSelectedOrderGradSifra(null);
    setPendingKupacSelection(null);
    setShowDodatnaLokacijaModal(false);
    setShowKupacModal(false);
    setExpandedCities(new Set());
    setSearchKupac("");
    if (day.sifraTerena) fetchAktivneNarudzbe(day.sifraTerenaDostava);
  };

  const handleGradClick = (grad: TerenGrad) => {
    if (expandedGrad === grad.sifra_grada) {
      setExpandedGrad(null);
      setSelectedKupac(null);
      setSelectedDodatnaLokacija(null);
      setSelectedOrderGradSifra(null);
      setPendingKupacSelection(null);
      setShowDodatnaLokacijaModal(false);
      setShowKupacModal(false);
    } else {
      setExpandedGrad(grad.sifra_grada);
      setSelectedKupac(null);
      setSelectedDodatnaLokacija(null);
      setSelectedOrderGradSifra(null);
      setPendingKupacSelection(null);
      setShowDodatnaLokacijaModal(false);
      setShowKupacModal(false);
    }
  };

  const openKupacOrderModal = (
    kupac: Kupac,
    terenInfo: TerenDostaveInfo,
    lokacija: DodatnaLokacija | null,
    orderGradSifra: number,
  ) => {
    setSelectedKupac(kupac);
    setSelectedTerenInfo(terenInfo);
    setSelectedDodatnaLokacija(lokacija);
    setSelectedOrderGradSifra(orderGradSifra);
    setShowKupacModal(true);
    setShowDodatnaLokacijaModal(false);
    setPendingKupacSelection(null);
  };

  const completedKupciSet = new Set(
    narudzbePoKupcu.map((k) => Number(k.sifra_kupca)),
  );

  const handleDeletePartnerFromTeren = async (kupac: NarudzbaKupac) => {
    if (!selectedTerenaSifra) {
      alert("Nedostaje šifra terena.");
      return;
    }
    deletePartnerConfirmActionRef.current = async () => {
      try {
        const res = await fetch(`${API_URL}/api/narudzbe/obrisi-partnera`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sifraTerenaDostava: Number(selectedDay),
            sifraKupca: Number(kupac.sifra_kupca),
            referentniBroj: kupac.referentni_broj || "-",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.error || `HTTP greška: ${res.status}`);
        if (selectedDay) fetchAktivneNarudzbe(selectedDay);
      } catch (e) {
        setErrorModal(e instanceof Error ? e.message : String(e));
      }
    };
    setShowDeletePartnerConfirm(true);
  };

  const handleDeleteProductFromPartner = async (
    kupac: NarudzbaKupac,
    proizvod: NarudzbaProizvod,
  ) => {
    if (!selectedTerenaSifra) {
      alert("Nedostaje šifra terena.");
      return;
    }
    if (kupac.proizvodi.length <= 1) {
      await handleDeletePartnerFromTeren(kupac);
      return;
    }
    deleteProizvodConfirmActionRef.current = async () => {
      try {
        const res = await fetch(`${API_URL}/api/narudzbe/obrisi-stavku`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sifraTerenaDostava: Number(selectedDay),
            sifraKupca: Number(kupac.sifra_kupca),
            sifraProizvoda: parseInt(String(proizvod.sif).trim(), 10),
            referentniBroj: kupac.referentni_broj || "-",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.error || `HTTP greška: ${res.status}`);
        if (selectedDay) fetchAktivneNarudzbe(selectedDay);
      } catch (e) {
        setErrorModal(e instanceof Error ? e.message : String(e));
      }
    };
    setShowDeleteProizvodConfirm(true);
  };

  const handleRecentProductClick = (p: RecentProduct) => {
    if (!selectedVrstaPlacanja) {
      alert("Prvo odaberi vrstu plaćanja!");
      return;
    }
    setSeenRecent((prev) => {
      const next = new Set(prev);
      next.add(String(p.sifra));
      return next;
    });
    const sifraNum = Number(p.sifra);
    const found = artikli.find((a) => Number(a.sifra_proizvoda) === sifraNum);
    if (!found) {
      alert(`Artikal (${p.sifra}) nije pronađen u listi artikala.`);
      return;
    }
    setSelectedArtiklModal(found);
    setArtiklKolicina(1);
    setArtiklNapomena("");
    setArtiklTrazenaCijena(getDefaultTrazenaCijena(found));
    setTimeout(() => {
      if (kolicinaInputRef.current) {
        kolicinaInputRef.current.focus();
        kolicinaInputRef.current.select();
      }
    }, 0);
  };

  const handleSelectArtikl = (artikal: Artikal) => {
    setSelectedArtiklModal(artikal);
    setArtiklKolicina(1);
    setArtiklNapomena("");
    setArtiklTrazenaCijena(getDefaultTrazenaCijena(artikal));
    setTimeout(() => {
      if (kolicinaInputRef.current) {
        kolicinaInputRef.current.focus();
        kolicinaInputRef.current.select();
      }
    }, 0);
  };

  const openOutOfStockConfirm = (onConfirm: () => void) => {
    outOfStockConfirmActionRef.current = onConfirm;
    setShowOutOfStockConfirm(true);
  };

  const handleOutOfStockConfirmChoice = (shouldContinue: boolean) => {
    setShowOutOfStockConfirm(false);
    if (shouldContinue) outOfStockConfirmActionRef.current?.();
    outOfStockConfirmActionRef.current = null;
  };

  return (
    <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-xl overflow-hidden">
      {/* HEADER - KOLAPSIBILAN */}
      <div
        className={`border-b-2 border-gray-200 dark:border-[#2d2648] bg-white dark:bg-[#261f38] transition-all duration-300 relative ${
          headerCollapsed ? "max-h-8" : "max-h-24"
        }`}
      >
        <div className="flex items-center justify-center gap-3 px-6 md:px-8 py-2 md:py-4">
          {!headerCollapsed && (
            <h2
              className="text-2xl md:text-3xl font-bold text-center"
              style={{ color: "#785E9E" }}
            >
              UNOS NARUDŽBI — TEREN
            </h2>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-220px)]">
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LIJEVA STRANA - NAVIGACIJA */}
          <div className="w-full md:w-96 border-r-2 border-gray-200 dark:border-[#2d2648] overflow-y-auto bg-gray-50 dark:bg-[#1e1730]">
            {/* HEADER SA DANIMA */}
            <div className="sticky top-0 bg-white dark:bg-[#261f38] border-b-2 border-gray-200 dark:border-[#2d2648] z-10">
              <div className="flex overflow-x-auto gap-1 p-3">
                {loading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-[#9e96b8]">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Učitavanje...</span>
                  </div>
                ) : uniqueDays.length === 0 ? (
                  <div className="px-3 py-2 text-gray-600 dark:text-[#9e96b8] text-sm">
                    Nema dostupnih dana
                  </div>
                ) : (
                  uniqueDays.map((d) => (
                    <button
                      key={d.sifraTerenaDostava}
                      onClick={() => handleDayClick(d)}
                      className={`px-3 py-2 rounded-lg whitespace-nowrap text-xs md:text-sm font-medium transition-all ${
                        selectedDay === d.sifraTerenaDostava
                          ? "text-white shadow-lg"
                          : "text-gray-700 dark:text-[#c5bfd8] hover:bg-gray-200 dark:hover:bg-[#2d2648]"
                      }`}
                      style={{
                        backgroundColor:
                          selectedDay === d.sifraTerenaDostava
                            ? "#8FC74A"
                            : "transparent",
                      }}
                    >
                      <div>{d.day}</div>
                      <div className="text-xs">{d.date}</div>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t-2 border-gray-200 dark:border-[#2d2648] p-3">
                <input
                  type="text"
                  placeholder="Pretraži kupce po imenu ili šifri..."
                  value={searchKupac}
                  onChange={(e) => setSearchKupac(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-[#3a3158] rounded-lg focus:border-green-400 focus:outline-none transition-all bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
                />
                {searchKupac && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-[#9e96b8]">
                    Pretraga: "
                    <span className="font-semibold text-green-600">
                      {searchKupac}
                    </span>
                    "
                    <button
                      onClick={() => setSearchKupac("")}
                      className="ml-2 text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕ Obriši
                    </button>
                  </div>
                )}
              </div>

              {terenGradError && (
                <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-950/40 border-t border-yellow-200 text-yellow-700 dark:text-yellow-400 text-xs flex items-center gap-2">
                  <span>⚠️ {terenGradError}</span>
                </div>
              )}
              {terenGradLoading && (
                <div className="px-3 py-2 text-gray-500 dark:text-[#7d7498] text-xs flex items-center gap-2">
                  <Loader className="w-3 h-3 animate-spin" />
                  <span>Učitavanje gradova...</span>
                </div>
              )}
              {kupciError && (
                <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-950/40 border-t border-yellow-200 text-yellow-700 dark:text-yellow-400 text-xs flex items-center gap-2">
                  <span>⚠️ {kupciError}</span>
                </div>
              )}
              {kupciLoading && (
                <div className="px-3 py-2 text-gray-500 dark:text-[#7d7498] text-xs flex items-center gap-2">
                  <Loader className="w-3 h-3 animate-spin" />
                  <span>Učitavanje kupaca...</span>
                </div>
              )}
            </div>

            {/* SADRŽAJ */}
            <div className="p-4 space-y-4">
              {currentSchedule?.cities.map((city) => (
                <div
                  key={city.id}
                  className="bg-white dark:bg-[#261f38] rounded-lg shadow-sm"
                >
                  <button
                    onClick={() => toggleCity(city.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all font-semibold"
                    style={{ color: "#785E9E" }}
                  >
                    <span>{city.name}</span>
                    {expandedCities.has(city.id) ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))}

              {!terenGradError &&
                !terenGradLoading &&
                getGradesForSelectedTeren().length > 0 && (
                  <div className="bg-white dark:bg-[#261f38] rounded-lg shadow-sm mt-4 border-2 border-green-200 dark:border-green-900/50 p-4">
                    <div className="space-y-3">
                      {getGradesForSelectedTeren().map((grad) => (
                        <div key={grad.sifra_tabele} className="space-y-2">
                          <button
                            onClick={() => handleGradClick(grad)}
                            className={`w-full px-4 py-3 rounded-lg font-semibold transition-all text-left flex items-center justify-between ${
                              expandedGrad === grad.sifra_grada
                                ? "text-white shadow-lg"
                                : "text-[#2F4F77] dark:text-[#a0b8d8] bg-[#EAF2FF] dark:bg-[#1c2a40] hover:bg-[#DCEAFF] dark:hover:bg-[#243349] border border-[#C6DBFF] dark:border-[#2d4260]"
                            }`}
                            style={{
                              backgroundColor:
                                expandedGrad === grad.sifra_grada
                                  ? "#8FC74A"
                                  : undefined,
                            }}
                          >
                            <span>{grad.naziv_grada}</span>
                            {expandedGrad === grad.sifra_grada ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>

                          {expandedGrad === grad.sifra_grada && (
                            <div className="pl-4 space-y-2 border-l-4 border-green-300 animate-in fade-in duration-200">
                              {kupciLoading ? (
                                <div className="px-3 py-2 text-gray-500 dark:text-[#7d7498] text-xs flex items-center gap-2">
                                  <Loader className="w-3 h-3 animate-spin" />
                                  <span>Učitavanje kupaca...</span>
                                </div>
                              ) : getKupciForGrad(grad.sifra_grada).length ===
                                0 ? (
                                <div className="px-3 py-2 text-gray-600 dark:text-[#9e96b8] text-sm">
                                  {searchKupac ? (
                                    <>
                                      Nema kupaca za pretragu "
                                      <span className="font-semibold">
                                        {searchKupac}
                                      </span>
                                      "
                                    </>
                                  ) : (
                                    "Nema kupaca"
                                  )}
                                </div>
                              ) : (
                                getKupciForGrad(grad.sifra_grada).map(
                                  (kupac) => {
                                    const isCompleted = completedKupciSet.has(
                                      Number(kupac.sifra_kupca),
                                    );
                                    const hasDodatne =
                                      hasPartnerDodatneLokacije(
                                        kupac.sifra_kupca,
                                      );
                                    const pjZaGrad = hasDodatne
                                      ? getPartnerPjZaGrad(
                                          kupac.sifra_kupca,
                                          grad.sifra_grada,
                                        )
                                      : [];

                                    return (
                                      <div
                                        key={kupac.sifra_kupca}
                                        className="space-y-1"
                                      >
                                        <button
                                          onClick={() => {
                                            const terenInfo =
                                              getSelectedTerenInfo();
                                            if (!terenInfo) {
                                              alert(
                                                "Odaberi dan prije nego što odabereš kupca!",
                                              );
                                              return;
                                            }
                                            openKupacOrderModal(
                                              kupac,
                                              terenInfo,
                                              null,
                                              grad.sifra_grada,
                                            );
                                          }}
                                          className={`w-full px-3 py-2 rounded-lg text-sm transition-all text-left font-medium border-2 ${
                                            selectedKupac?.sifra_kupca ===
                                            kupac.sifra_kupca
                                              ? "text-white shadow-lg"
                                              : hasDodatne
                                                ? "text-[#5A3F86] dark:text-[#c5a8ff] bg-[#F3EDFF] dark:bg-[#312060] hover:bg-[#E8DBFF] dark:hover:bg-[#3d2870] font-bold"
                                                : "text-gray-700 dark:text-[#c5bfd8] bg-gray-100 dark:bg-[#2a2340] hover:bg-gray-200 dark:hover:bg-[#2d2648]"
                                          }`}
                                          style={{
                                            backgroundColor:
                                              selectedKupac?.sifra_kupca ===
                                              kupac.sifra_kupca
                                                ? "#8FC74A"
                                                : undefined,
                                            borderColor: isCompleted
                                              ? "#8FC74A"
                                              : "transparent",
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-2">
                                              <span>
                                                {kupac.naziv_kupca}
                                                {kupac.sifra_kupca >
                                                  CUSTOMER_CODE_THRESHOLD &&
                                                  " ⭐"}
                                              </span>
                                            </span>
                                            {zadnjiDanMap[kupac.sifra_kupca] !==
                                              undefined && (
                                              <span
                                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                style={{
                                                  backgroundColor: "#785E9E",
                                                  color: "#8FC74A",
                                                }}
                                                title="Broj dana od zadnje narudžbe"
                                              >
                                                {
                                                  zadnjiDanMap[
                                                    kupac.sifra_kupca
                                                  ]
                                                }
                                              </span>
                                            )}
                                          </div>
                                        </button>

                                        {hasDodatne && pjZaGrad.length > 0 && (
                                          <div className="ml-2 pl-2 border-l-2 border-[#D6C8F0] dark:border-[#4a3870] space-y-1">
                                            {pjZaGrad.map((lok, idx) => {
                                              const isLokacijaSelected =
                                                selectedKupac?.sifra_kupca ===
                                                  kupac.sifra_kupca &&
                                                selectedDodatnaLokacija !=
                                                  null &&
                                                String(
                                                  selectedDodatnaLokacija.sifra_lokacije ||
                                                    "",
                                                ) ===
                                                  String(
                                                    lok.sifra_lokacije || "",
                                                  );
                                              return (
                                                <button
                                                  key={`${kupac.sifra_kupca}-pj-${String(lok.sifra_lokacije || idx)}`}
                                                  onClick={() => {
                                                    const terenInfo =
                                                      getSelectedTerenInfo();
                                                    if (!terenInfo) {
                                                      alert(
                                                        "Odaberi dan prije nego što odabereš kupca!",
                                                      );
                                                      return;
                                                    }
                                                    openKupacOrderModal(
                                                      kupac,
                                                      terenInfo,
                                                      lok,
                                                      Number(
                                                        lok?.sifra_grada,
                                                      ) || grad.sifra_grada,
                                                    );
                                                  }}
                                                  className="w-full px-3 py-2 rounded-lg text-xs transition-all text-left font-semibold border"
                                                  style={{
                                                    borderColor:
                                                      isLokacijaSelected
                                                        ? "#8FC74A"
                                                        : "#D6C8F0",
                                                    backgroundColor:
                                                      isLokacijaSelected
                                                        ? "#F0FFF4"
                                                        : "#FAF7FF",
                                                    color: "#5A3F86",
                                                  }}
                                                >
                                                  PJ:{" "}
                                                  {getLokacijaLabel(lok, idx)}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  },
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* DESNA STRANA - SADRŽAJ */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {loadingNarudzbe ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-purple-600" />
                    <span className="ml-3 text-gray-600 dark:text-[#9e96b8]">
                      Učitavanje narudžbi...
                    </span>
                  </div>
                ) : narudzbePoKupcu.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-[#7d7498] text-lg">
                      Nema aktivnih narudžbi za odabrani dan
                    </p>
                    <p className="text-gray-400 dark:text-[#5f5878] text-sm mt-2">
                      Odaberite dan da vidite narudžbe
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {narudzbePoKupcu.map((kupac) => (
                      <div
                        key={getKupacGroupingKey(
                          kupac.sifra_kupca,
                          kupac.referentni_broj,
                        )}
                        className="bg-white dark:bg-[#261f38] rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 dark:border-[#2d2648]"
                      >
                        <div className="bg-gradient-to-r from-purple-100 to-green-100 dark:from-[#2a2340] dark:to-[#1a2c12] px-6 py-4 border-b-2 border-gray-200 dark:border-[#2d2648]">
                          <div className="flex items-center">
                            <div>
                              <h3
                                className="text-xl font-bold"
                                style={{ color: "#785E9E" }}
                              >
                                {kupac.naziv_kupca}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-[#9e96b8] mt-1">
                                Šifra kupca:{" "}
                                <span className="font-semibold">
                                  {kupac.sifra_kupca}
                                </span>
                                {kupac.sifra_kupca >
                                  CUSTOMER_CODE_THRESHOLD && (
                                  <span className="ml-2">⭐</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-[#7d7498] mt-1">
                                Referentni broj:{" "}
                                <span className="font-semibold text-gray-700 dark:text-[#c5bfd8]">
                                  {kupac.referentni_broj || "-"}
                                </span>
                              </p>
                            </div>
                            <div className="ml-auto mr-[10px] relative">
                              <div className="bg-white dark:bg-[#1e1730] px-4 py-2 rounded-lg shadow">
                                <span className="text-sm text-gray-600 dark:text-[#9e96b8]">
                                  Ukupno stavki:
                                </span>
                                <span
                                  className="ml-2 text-lg font-bold"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {kupac.proizvodi.length}
                                </span>
                              </div>
                              <span
                                className="absolute top-full left-1/2 -translate-x-1/2 text-xs mt-1 text-center whitespace-nowrap"
                                style={{ color: "#785E9E" }}
                              >
                                {kupac.pripada_radniku || "-"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeletePartnerFromTeren(kupac)
                              }
                              className="p-2 rounded-lg transition-all"
                              style={{ backgroundColor: "#FFE5E5" }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#FFD5D5")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#FFE5E5")
                              }
                              title="Obriši partnera (sve stavke za ovog partnera na terenu)"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2d2648]">
                            <thead className="bg-gray-50 dark:bg-[#2a2340]">
                              <tr>
                                {[
                                  "ŠIF",
                                  "NAZIV PROIZVODA",
                                  "JM",
                                  "KOLIČINA",
                                  "NAPOMENA",
                                  "",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7d7498] uppercase tracking-wider"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#261f38] divide-y divide-gray-200 dark:divide-[#2d2648]">
                              {kupac.proizvodi.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-6 py-8 text-center text-gray-500 dark:text-[#7d7498]"
                                  >
                                    Nema proizvoda
                                  </td>
                                </tr>
                              ) : (
                                kupac.proizvodi.map((proizvod, index) => (
                                  <tr
                                    key={`${kupac.sifra_kupca}-${proizvod.sif}-${index}`}
                                    className="hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-colors"
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-[#ede9f6]">
                                      {proizvod.sif}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-[#ede9f6]">
                                      {proizvod.naziv_proizvoda}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-[#ede9f6]">
                                      {proizvod.jm}
                                    </td>
                                    <td
                                      className="px-6 py-4 whitespace-nowrap text-sm font-semibold"
                                      style={{ color: "#8FC74A" }}
                                    >
                                      {proizvod.kolicina}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#9e96b8]">
                                      {proizvod.napomena || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteProductFromPartner(
                                            kupac,
                                            proizvod,
                                          )
                                        }
                                        className="p-1.5 rounded-lg transition-all inline-flex"
                                        style={{ backgroundColor: "#FFE5E5" }}
                                        onMouseEnter={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "#FFD5D5")
                                        }
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "#FFE5E5")
                                        }
                                        title={
                                          kupac.proizvodi.length <= 1
                                            ? "Kupac ima 1 stavku – briše se cijeli partner"
                                            : "Obriši ovaj proizvod"
                                        }
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ZA ODABIR DODATNE LOKACIJE */}
      {showDodatnaLokacijaModal && pendingKupacSelection && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-5">
            <h3 className="text-lg font-bold mb-2" style={{ color: "#785E9E" }}>
              Odabir dodatne lokacije
            </h3>
            <p className="text-sm text-gray-700 dark:text-[#c5bfd8] mb-4">
              Partner: {pendingKupacSelection.kupac.naziv_kupca}
            </p>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {getPartnerDodatneLokacije(
                pendingKupacSelection.kupac.sifra_kupca,
              ).map((lok, idx) => {
                const active =
                  selectedDodatnaLokacija === lok ||
                  (selectedDodatnaLokacija?.sifra_lokacije !== undefined &&
                    lok?.sifra_lokacije !== undefined &&
                    String(selectedDodatnaLokacija.sifra_lokacije) ===
                      String(lok.sifra_lokacije));
                return (
                  <button
                    key={`${pendingKupacSelection.kupac.sifra_kupca}-${idx}-${String(lok.sifra_lokacije || idx)}`}
                    type="button"
                    onClick={() => setSelectedDodatnaLokacija(lok)}
                    className="w-full text-left px-3 py-2 rounded-lg border-2 transition-all"
                    style={{
                      borderColor: active ? "#8FC74A" : "#E5E7EB",
                      backgroundColor: active ? "#F0FFF4" : "#FFFFFF",
                    }}
                  >
                    <div
                      className="font-semibold text-sm"
                      style={{ color: "#785E9E" }}
                    >
                      {getLokacijaLabel(lok, idx)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  openKupacOrderModal(
                    pendingKupacSelection.kupac,
                    pendingKupacSelection.terenInfo,
                    null,
                    selectedOrderGradSifra ||
                      pendingKupacSelection.kupac.sifra_grada,
                  )
                }
                className="px-4 py-2 rounded-lg border-2 font-semibold"
                style={{ color: "#785E9E", borderColor: "#785E9E" }}
              >
                Nastavi bez dodatne lokacije
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDodatnaLokacijaModal(false);
                    setPendingKupacSelection(null);
                    setSelectedDodatnaLokacija(null);
                  }}
                  className="px-4 py-2 rounded-lg border-2 font-semibold"
                  style={{ color: "#785E9E", borderColor: "#785E9E" }}
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  disabled={!selectedDodatnaLokacija}
                  onClick={() =>
                    openKupacOrderModal(
                      pendingKupacSelection.kupac,
                      pendingKupacSelection.terenInfo,
                      selectedDodatnaLokacija,
                      Number(selectedDodatnaLokacija?.sifra_grada) ||
                        selectedOrderGradSifra ||
                        pendingKupacSelection.kupac.sifra_grada,
                    )
                  }
                  className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#8FC74A" }}
                >
                  Nastavi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZA KUPCA - UNOS NARUDŽBE */}
      {showKupacModal && selectedKupac && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-[5px]">
          <div className="bg-white dark:bg-[#261f38] rounded-xl shadow-2xl w-full h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
            {/* HEADER */}
            <div
              className="border-b-2 p-3 md:p-4 flex items-start justify-between gap-4"
              style={{ backgroundColor: "#785E9E", borderColor: "#8FC74A" }}
            >
              <div className="flex items-stretch gap-4 flex-wrap w-full">
                {/* INFO KARTICA */}
                <div
                  className="bg-white rounded-md p-2 border-2 shadow-sm max-w-[240px]"
                  style={{ borderColor: "#8FC74A" }}
                >
                  <div className="space-y-1">
                    <div
                      className="rounded-md px-2 py-1"
                      style={{
                        backgroundColor: "#F5F3FF",
                        borderLeft: "3px solid #8FC74A",
                      }}
                    >
                      <div
                        className="text-sm font-bold leading-tight"
                        style={{ color: "#8FC74A" }}
                      >
                        {selectedTerenInfo?.dan_dostave} -{" "}
                        {selectedTerenInfo?.datum_dostave}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-0">
                      <div className="-mt-0.5">
                        <div
                          className="text-[10px] font-semibold leading-none"
                          style={{ color: "#785E9E" }}
                        >
                          ŠIFRA
                        </div>
                        <div
                          className="text-[8px] font-bold leading-tight"
                          style={{ color: "#785E9E" }}
                        >
                          {selectedKupac.sifra_kupca}
                        </div>
                      </div>
                      <div className="-mt-0.5">
                        <div
                          className="text-[8px] font-semibold leading-none"
                          style={{ color: "#785E9E" }}
                        >
                          GRAD
                        </div>
                        <div className="text-[11px] text-gray-700 leading-tight">
                          {selectedKupac.naziv_grada}
                        </div>
                      </div>
                    </div>
                    <div className="-mt-1">
                      <div
                        className="text-[10px] font-semibold leading-none"
                        style={{ color: "#785E9E" }}
                      >
                        KUPAC
                      </div>
                      <div className="text-[11px] font-semibold text-gray-800 leading-tight">
                        {selectedKupac.naziv_kupca}
                      </div>
                    </div>
                    {selectedDodatnaLokacija && (
                      <div className="-mt-1">
                        <div
                          className="text-[10px] font-semibold leading-none"
                          style={{ color: "#785E9E" }}
                        >
                          DODATNA LOKACIJA
                        </div>
                        <div className="text-[11px] font-semibold text-gray-800 leading-tight">
                          {getLokacijaLabel(selectedDodatnaLokacija, 0)}
                        </div>
                      </div>
                    )}
                    <div
                      style={{
                        borderTop: "1px solid #E0E0E0",
                        margin: "0.35rem 0",
                      }}
                    />
                    {/* VRSTE PLAĆANJA */}
                    <div className="flex gap-1 flex-wrap">
                      {getVrstePaymentaZaKupca(
                        selectedKupac?.sifra_kupca || 0,
                      ).map((vrsta) => (
                        <button
                          key={vrsta.kod}
                          onClick={() => setSelectedVrstaPlacanja(vrsta.kod)}
                          className={`px-2 py-0.5 rounded-md font-semibold text-[11px] leading-tight transition-all ${
                            selectedVrstaPlacanja === vrsta.kod
                              ? "text-white shadow scale-[1.02]"
                              : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                          }`}
                          style={{
                            backgroundColor:
                              selectedVrstaPlacanja === vrsta.kod
                                ? "#8FC74A"
                                : undefined,
                          }}
                        >
                          {vrsta.naziv}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN CONTENT - DVIJE KOLONE */}
            <div
              className="flex-1 overflow-hidden flex flex-col md:flex-row gap-3 md:gap-4 p-3 md:p-4"
              style={{
                opacity: selectedVrstaPlacanja ? 1 : 0.5,
                pointerEvents: selectedVrstaPlacanja ? "auto" : "none",
              }}
            >
              {/* LIJEVA STRANA - ARTIKLI (30%) */}
              <div
                className="w-full md:w-[30%] flex flex-col border-r-2 pr-4"
                style={{ borderColor: "#8FC74A" }}
              >
                <div className="mb-4 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Pretraži artikle..."
                      value={searchArtikli}
                      onChange={(e) => setSearchArtikli(e.target.value)}
                      className="w-full px-3 py-2 pl-10 border-2 rounded-lg focus:outline-none transition-all text-sm bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
                      style={{ borderColor: "#8FC74A" }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "#785E9E")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#8FC74A")
                      }
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 min-h-[300px]">
                  <div className="grid grid-cols-2 gap-2 min-h-[300px]">
                    {filteredArtikli.map((artikal) => {
                      const isOutOfStock =
                        Number(artikal.kolicinaNaStanju) === 0;
                      return (
                        <div
                          key={artikal.sifra_proizvoda}
                          onClick={() => {
                            const continueWithSelection = () => {
                              if (!selectedVrstaPlacanja) {
                                alert("Prvo odaberi vrstu plaćanja!");
                                return;
                              }
                              handleSelectArtikl(artikal);
                            };
                            if (isOutOfStock) {
                              openOutOfStockConfirm(continueWithSelection);
                              return;
                            }
                            continueWithSelection();
                          }}
                          className={`bg-white dark:bg-[#261f38] border-2 rounded-lg p-2 transition-all ${
                            isOutOfStock
                              ? "opacity-50 cursor-pointer"
                              : "hover:shadow-md cursor-pointer"
                          }`}
                          style={{
                            borderColor: isOutOfStock ? "#E0E0E0" : "#785E9E",
                          }}
                          title={isOutOfStock ? "Nema na stanju" : undefined}
                          onMouseEnter={(e) => {
                            if (!isOutOfStock)
                              e.currentTarget.style.borderColor = "#8FC74A";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isOutOfStock
                              ? "#E0E0E0"
                              : "#785E9E";
                          }}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="min-w-0">
                              <div
                                className="text-[11px] font-semibold"
                                style={{ color: "#785E9E" }}
                              >
                                {artikal.sifra_proizvoda}
                              </div>
                              <div className="text-xs font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                                {artikal.naziv_proizvoda}
                              </div>
                              <div
                                className="text-[11px] font-bold mt-1"
                                style={{ color: "#8FC74A" }}
                              >
                                JM: {artikal.jm}
                              </div>
                              {isOutOfStock && (
                                <div className="text-[10px] font-semibold text-red-600 mt-1">
                                  NEMA NA STANJU
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 text-xs">
                              <div
                                className="rounded p-2 h-[32px] flex items-center justify-between"
                                style={{ backgroundColor: "#F0F4FF" }}
                              >
                                <span
                                  className="font-semibold"
                                  style={{ color: "#785E9E" }}
                                >
                                  VPC
                                </span>
                                <span
                                  className="font-bold"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {formatPrice(artikal.vpc)} KM
                                </span>
                              </div>
                              <div
                                className="rounded p-2 h-[32px] flex items-center justify-between"
                                style={{ backgroundColor: "#F0FFF4" }}
                              >
                                <span
                                  className="font-semibold"
                                  style={{ color: "#785E9E" }}
                                >
                                  MPC
                                </span>
                                <span
                                  className="font-bold"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {formatPrice(artikal.mpc)} KM
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredArtikli.length === 0 && (
                      <div className="col-span-2 text-center text-gray-400 dark:text-[#5f5878] py-8">
                        <p className="text-sm">Nema pronađenih artikala</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SREDINA - SADRŽAJ NARUDŽBE (70%) */}
              <div className="flex-1 overflow-y-auto flex flex-col bg-gray-50 dark:bg-[#1e1730]">
                {selectedArtiklModal ? (
                  <div
                    className="p-4 border-b-2 flex-shrink-0 bg-white dark:bg-[#261f38]"
                    style={{ borderColor: "#8FC74A" }}
                  >
                    <div
                      className="rounded-md px-2 py-2 mb-2"
                      style={{
                        backgroundColor: "#F5F3FF",
                        borderLeft: "4px solid #8FC74A",
                      }}
                    >
                      <h3
                        className="font-bold text-lg mb-1"
                        style={{ color: "#785E9E" }}
                      >
                        {selectedArtiklModal.naziv_proizvoda}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-semibold"
                            style={{ color: "#785E9E" }}
                          >
                            Šifra:
                          </span>
                          <span className="font-semibold text-gray-700">
                            {selectedArtiklModal.sifra_proizvoda}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-semibold"
                            style={{ color: "#785E9E" }}
                          >
                            JM:
                          </span>
                          <span
                            className="font-bold"
                            style={{ color: "#8FC74A" }}
                          >
                            {selectedArtiklModal.jm}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-semibold"
                            style={{ color: "#785E9E" }}
                          >
                            VPC:
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: "#8FC74A" }}
                          >
                            {formatPrice(selectedArtiklModal.vpc)} KM
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-semibold"
                            style={{ color: "#785E9E" }}
                          >
                            MPC:
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: "#8FC74A" }}
                          >
                            {formatPrice(selectedArtiklModal.mpc)} KM
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-end gap-3">
                        <div className="w-2/3">
                          <label
                            className="block text-sm font-semibold mb-0"
                            style={{ color: "#785E9E" }}
                          >
                            Količina ({selectedArtiklModal.jm}) *
                          </label>
                          <input
                            ref={kolicinaInputRef}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={artiklKolicina || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || val === "0" || val === "0.") {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                setArtiklKolicina(val as any);
                                return;
                              }
                              if (/^0\.\d*$/.test(val)) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                setArtiklKolicina(val as any);
                                return;
                              }
                              if (!/^\d*\.?\d*$/.test(val)) return;
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed > 0)
                                setArtiklKolicina(parsed);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleAddArtiklToModalOrder();
                            }}
                            onBlur={(e) => {
                              if (!artiklKolicina || artiklKolicina <= 0)
                                setArtiklKolicina(0.01);
                              e.currentTarget.style.borderColor = "#8FC74A";
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#785E9E")
                            }
                            className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none text-center font-semibold dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
                            style={{ borderColor: "#8FC74A" }}
                          />
                        </div>
                        <div className="w-1/3">
                          <label
                            className="block text-sm font-semibold mb-0"
                            style={{ color: "#785E9E" }}
                          >
                            Tražena cijena (MPC)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={artiklTrazenaCijena || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || val === "0" || val === "0.") {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                setArtiklTrazenaCijena(val as any);
                                return;
                              }
                              if (/^0\.\d*$/.test(val)) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                setArtiklTrazenaCijena(val as any);
                                return;
                              }
                              if (!/^\d*\.?\d*$/.test(val)) return;
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed > 0)
                                setArtiklTrazenaCijena(parsed);
                            }}
                            className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none text-center font-semibold dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
                            style={{ borderColor: "#8FC74A" }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#785E9E")
                            }
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "#8FC74A";
                              if (getPrice(artiklTrazenaCijena) > 0) {
                                setArtiklTrazenaCijena(
                                  parseFloat(
                                    getPrice(artiklTrazenaCijena).toFixed(2),
                                  ),
                                );
                              } else {
                                setArtiklTrazenaCijena(
                                  getDefaultTrazenaCijena(selectedArtiklModal),
                                );
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          className="block text-sm font-semibold mb-0"
                          style={{ color: "#785E9E" }}
                        >
                          Napomena (opciono)
                        </label>
                        <textarea
                          value={artiklNapomena}
                          onChange={(e) => setArtiklNapomena(e.target.value)}
                          placeholder="Unesite napomenu..."
                          rows={2}
                          className="w-full px-3 py-1 border-2 rounded-lg focus:outline-none resize-none dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
                          style={{ borderColor: "#8FC74A" }}
                          onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "#785E9E")
                          }
                          onBlur={(e) =>
                            (e.currentTarget.style.borderColor = "#8FC74A")
                          }
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddArtiklToModalOrder}
                          className="flex-1 px-4 py-3 rounded-lg transition-all text-white font-medium"
                          style={{ backgroundColor: "#8FC74A" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.85")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                          }
                        >
                          Dodaj u narudžbu
                        </button>
                        <button
                          onClick={() => {
                            setSelectedArtiklModal(null);
                            setArtiklTrazenaCijena(0);
                          }}
                          className="flex-1 px-4 py-3 rounded-lg transition-all font-medium border-2"
                          style={{ color: "#785E9E", borderColor: "#785E9E" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#F5F3FF")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          Otkaži
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4">
                    {novaArtiklUNarudzbi.length === 0 ? (
                      <div className="text-center text-gray-400 dark:text-[#5f5878] py-12">
                        <p className="text-sm">
                          Odaberi artikal sa lijeve strane da ga dodaš u
                          narudžbu
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {novaArtiklUNarudzbi.map((artikal) => (
                          <div
                            key={artikal.sifra_proizvoda}
                            className="bg-white dark:bg-[#261f38] border-2 rounded-lg p-2 hover:shadow-md transition-all flex flex-col"
                            style={{ borderColor: "#8FC74A" }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 dark:text-[#ede9f6] text-[11px] truncate">
                                  {artikal.naziv_proizvoda}
                                </h4>
                                <p className="text-[10px] text-gray-500 dark:text-[#7d7498] mt-1">
                                  Šifra:{" "}
                                  <span className="font-bold">
                                    {artikal.sifra_proizvoda}
                                  </span>
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleRemoveArtiklFromModalOrder(
                                    artikal.sifra_proizvoda,
                                  )
                                }
                                className="p-1 rounded-lg transition-all flex-shrink-0 ml-1"
                                style={{ backgroundColor: "#FFE5E5" }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor =
                                    "#FFD5D5")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor =
                                    "#FFE5E5")
                                }
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </button>
                            </div>
                            <div
                              className="text-[10px] font-bold mb-2"
                              style={{ color: "#8FC74A" }}
                            >
                              JM: {artikal.jm}
                            </div>
                            <div
                              className="space-y-1 mb-2 pb-2 border-b"
                              style={{ borderColor: "#E0E0E0" }}
                            >
                              <div
                                className="rounded p-1 h-[28px] flex items-center justify-between"
                                style={{ backgroundColor: "#F5F3FF" }}
                              >
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: "#785E9E" }}
                                >
                                  VPC
                                </span>
                                <span
                                  className="font-bold text-[10px]"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {formatPrice(artikal.vpc)} KM
                                </span>
                              </div>
                              <div
                                className="rounded p-1 h-[28px] flex items-center justify-between"
                                style={{ backgroundColor: "#F0FFF4" }}
                              >
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: "#785E9E" }}
                                >
                                  MPC
                                </span>
                                <span
                                  className="font-bold text-[10px]"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {formatPrice(artikal.mpc)} KM
                                </span>
                              </div>
                              <div
                                className="rounded p-1 h-[28px] flex items-center justify-between"
                                style={{ backgroundColor: "#F0FFF4" }}
                              >
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: "#785E9E" }}
                                >
                                  Tražena cijena
                                </span>
                                <span
                                  className="font-bold text-[10px]"
                                  style={{ color: "#8FC74A" }}
                                >
                                  {formatPrice(artikal.trazenaCijena)} KM
                                </span>
                              </div>
                            </div>
                            <div className="mb-2">
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: "#785E9E" }}
                              >
                                Količina:
                              </span>
                              <div className="flex items-center gap-0.5 mt-1">
                                <button
                                  onClick={() =>
                                    handleUpdateModalArtiklKolicina(
                                      artikal.sifra_proizvoda,
                                      artikal.kolicina - 1,
                                    )
                                  }
                                  className="px-1 py-0.5 rounded text-[10px] font-bold text-white"
                                  style={{ backgroundColor: "#8FC74A" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.opacity = "0.8")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.opacity = "1")
                                  }
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.01"
                                  value={artikal.kolicina}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (
                                      val === "" ||
                                      val === "0" ||
                                      val === "0."
                                    )
                                      return;
                                    if (!/^\d*\.?\d*$/.test(val)) return;
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed) && parsed > 0)
                                      handleUpdateModalArtiklKolicina(
                                        artikal.sifra_proizvoda,
                                        parsed,
                                      );
                                  }}
                                  className="flex-1 min-w-0 px-1 py-0.5 border rounded text-center text-[10px] font-semibold dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
                                  style={{ borderColor: "#8FC74A" }}
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateModalArtiklKolicina(
                                      artikal.sifra_proizvoda,
                                      artikal.kolicina + 1,
                                    )
                                  }
                                  className="px-1 py-0.5 rounded text-[10px] font-bold text-white"
                                  style={{ backgroundColor: "#8FC74A" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.opacity = "0.8")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.opacity = "1")
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div
                              className="rounded-lg p-2 mb-2"
                              style={{
                                backgroundColor: "#F5F3FF",
                                borderLeft: "3px solid #8FC74A",
                              }}
                            >
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: "#785E9E" }}
                              >
                                UKUPNO:
                              </span>
                              <p
                                className="font-bold text-[11px]"
                                style={{ color: "#8FC74A" }}
                              >
                                {formatPrice(
                                  getPrice(artikal.mpc) * artikal.kolicina,
                                )}{" "}
                                KM
                              </p>
                            </div>
                            {artikal.napomena && (
                              <div
                                className="rounded p-1 text-[10px] mt-auto"
                                style={{
                                  backgroundColor: "#FFFEF0",
                                  borderLeft: "3px solid #FFD700",
                                }}
                              >
                                <p className="text-gray-700 font-semibold">
                                  📝
                                </p>
                                <p className="text-gray-600 mt-0.5 break-words">
                                  {artikal.napomena}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DESNO - RANIJE UZIMANI */}
              <div
                className="w-full md:w-[320px] lg:w-[360px] flex flex-col bg-white dark:bg-[#261f38] rounded-lg p-3 border-2 shadow-sm"
                style={{ borderColor: "#8FC74A" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="text-xs font-semibold"
                      style={{ color: "#785E9E" }}
                    >
                      RANIJE UZIMANI PROIZVODI
                    </div>
                    <div
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F5F3FF", color: "#785E9E" }}
                      title="Ukupan broj ranije uzimanih proizvoda"
                    >
                      {totalRecent}
                    </div>
                  </div>
                  {canExpand && (
                    <button
                      type="button"
                      onClick={() => setRecentExpanded((v) => !v)}
                      className="px-2 py-1 rounded-md border text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#2d2648]"
                      style={{ borderColor: "#E7E7E7", color: "#785E9E" }}
                      title={recentExpanded ? "Prikaži manje" : "Prikaži sve"}
                    >
                      {recentExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>
                <div
                  style={{ borderTop: "1px solid #E0E0E0", margin: "0.5rem 0" }}
                />
                <div className="flex-1 min-h-0">
                  {recentLoading && (
                    <div className="text-xs text-gray-600 dark:text-[#9e96b8]">
                      Učitavam...
                    </div>
                  )}
                  {recentError && (
                    <div className="text-xs text-red-600">
                      Greška: {recentError}
                    </div>
                  )}
                  {!recentLoading && !recentError && totalRecent === 0 && (
                    <div className="text-xs text-gray-500 dark:text-[#7d7498]">
                      Nema ranije uzimanih proizvoda.
                    </div>
                  )}
                  {!recentLoading && !recentError && totalRecent > 0 && (
                    <div
                      className={
                        recentExpanded ? "max-h-full overflow-y-auto pr-1" : ""
                      }
                    >
                      <table className="w-full text-xs">
                        <thead>
                          <tr
                            className="text-left"
                            style={{ color: "#785E9E" }}
                          >
                            <th className="py-1 pr-2 w-[90px]">ŠIFRA</th>
                            <th className="py-1 pr-2">NAZIV</th>
                            <th className="py-1 w-[50px] text-right">OK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRecent.map((p) => {
                            const isSelected =
                              Number(selectedArtiklModal?.sifra_proizvoda) ===
                              Number(p.sifra);
                            const isSeen = seenRecent.has(String(p.sifra));
                            const found = artikli.find(
                              (a) =>
                                Number(a.sifra_proizvoda) === Number(p.sifra),
                            );
                            const isOutOfStock = found
                              ? Number(found.kolicinaNaStanju) === 0
                              : false;
                            return (
                              <tr
                                key={`${p.sifra}-${p.naziv}`}
                                onClick={() => {
                                  const continueWithSelection = () =>
                                    handleRecentProductClick(p);
                                  if (isOutOfStock) {
                                    openOutOfStockConfirm(
                                      continueWithSelection,
                                    );
                                    return;
                                  }
                                  continueWithSelection();
                                }}
                                className={`border-t ${
                                  isOutOfStock
                                    ? "opacity-50 cursor-pointer"
                                    : selectedVrstaPlacanja
                                      ? "cursor-pointer"
                                      : "opacity-50 cursor-not-allowed"
                                } ${isSelected ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-gray-50 dark:hover:bg-[#2d2648]"}`}
                                style={{
                                  borderTopColor: "#E7E7E7",
                                  outline: isSelected
                                    ? "2px solid #8FC74A"
                                    : "none",
                                  outlineOffset: "-2px",
                                }}
                                title={
                                  isOutOfStock ? "Nema na stanju" : undefined
                                }
                              >
                                <td className="py-2 pr-2 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8] font-semibold">
                                  {p.sifra}
                                </td>
                                <td className="py-2 pr-2 text-gray-800 dark:text-[#ede9f6]">
                                  <div className="line-clamp-2">{p.naziv}</div>
                                </td>
                                <td className="py-2 text-right">
                                  {isSeen ? (
                                    <span
                                      className="font-bold"
                                      style={{ color: "#8FC74A" }}
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">–</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div
              className="border-t-2 bg-white dark:bg-[#261f38] p-3 md:p-4 flex-shrink-0"
              style={{ borderColor: "#8FC74A" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNewOrder}
                    className="px-6 py-3 rounded-lg transition-all text-white font-medium whitespace-nowrap"
                    style={{ backgroundColor: "#8FC74A" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.85")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    disabled={
                      novaArtiklUNarudzbi.length === 0 ||
                      !selectedVrstaPlacanja ||
                      isSaving
                    }
                  >
                    Spremi sve
                  </button>
                  <button
                    onClick={() => {
                      setShowKupacModal(false);
                      setSelectedKupac(null);
                      setSelectedDodatnaLokacija(null);
                      setPendingKupacSelection(null);
                      setShowDodatnaLokacijaModal(false);
                      setSelectedOrderGradSifra(null);
                      setNovaArtiklUNarudzbi([]);
                      setSelectedArtiklModal(null);
                      setSelectedVrstaPlacanja(null);
                    }}
                    className="px-6 py-3 rounded-lg transition-all font-medium border-2 whitespace-nowrap"
                    style={{ color: "#785E9E", borderColor: "#785E9E" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#F5F3FF")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    Zatvori
                  </button>
                </div>
                {novaArtiklUNarudzbi.length > 0 && (
                  <div className="flex items-center gap-6 ml-auto">
                    <div
                      className="border-l-2 h-12"
                      style={{ borderColor: "#E0E0E0" }}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#785E9E" }}
                      >
                        Stavki:
                      </span>
                      <span
                        className="font-bold text-lg text-white px-2 py-1 rounded"
                        style={{ backgroundColor: "#8FC74A" }}
                      >
                        {novaArtiklUNarudzbi.length}
                      </span>
                    </div>
                    <div
                      className="border-l-2 h-12"
                      style={{ borderColor: "#E0E0E0" }}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#785E9E" }}
                      >
                        UKUPNO:
                      </span>
                      <span
                        className="text-xl font-bold"
                        style={{ color: "#8FC74A" }}
                      >
                        {calculateModalTotalPrice().toFixed(2)} KM
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOZI */}
      {showOutOfStockConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-5">
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              Proizvoda nema na stanju! Da li želiš nastaviti?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOutOfStockConfirmChoice(true)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: "#8FC74A" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                DA
              </button>
              <button
                type="button"
                onClick={() => handleOutOfStockConfirmChoice(false)}
                className="min-w-[90px] px-4 py-2 rounded-lg font-semibold border-2 transition-all"
                style={{ color: "#785E9E", borderColor: "#785E9E" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#F5F3FF")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                NE
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePartnerConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-5">
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              Obrisati SVE stavke za ovog kupca?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeletePartnerConfirm(false);
                  deletePartnerConfirmActionRef.current?.();
                  deletePartnerConfirmActionRef.current = null;
                }}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: "#8FC74A" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                DA
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeletePartnerConfirm(false);
                  deletePartnerConfirmActionRef.current = null;
                }}
                className="min-w-[90px] px-4 py-2 rounded-lg font-semibold border-2 transition-all"
                style={{ color: "#785E9E", borderColor: "#785E9E" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#F5F3FF")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                NE
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProizvodConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-5">
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              Obrisati ovaj proizvod?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteProizvodConfirm(false);
                  deleteProizvodConfirmActionRef.current?.();
                  deleteProizvodConfirmActionRef.current = null;
                }}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: "#8FC74A" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                DA
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteProizvodConfirm(false);
                  deleteProizvodConfirmActionRef.current = null;
                }}
                className="min-w-[90px] px-4 py-2 rounded-lg font-semibold border-2 transition-all"
                style={{ color: "#785E9E", borderColor: "#785E9E" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#F5F3FF")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                NE
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotif && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {notifMessage}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowNotif(false)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: "#8FC74A" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {errorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-red-300 p-6">
            <p className="text-base font-semibold text-red-700 dark:text-red-400 text-center">
              {errorModal}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setErrorModal(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: "#785E9E" }}
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
