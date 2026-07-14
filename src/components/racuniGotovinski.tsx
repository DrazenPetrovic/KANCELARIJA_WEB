import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  History,
  Loader2,
  Lock,
  MapPin,
  Package,
  Percent,
  Printer,
  Search,
  Tag,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
  User,
  X,
} from "lucide-react";
import {
  preuzmiStatusEsira,
  izdajFiskalniRacun,
  izdvojiFiskalnePodatke,
  posaljiEsirDebugZahtjev,
  ESIR_OZNAKA_SA_PDV,
  ESIR_SLIP_PRESET_58MM,
  type EsirStavka,
  type EsirPlacanje,
  type EsirInvoiceRequest,
  type EsirOpcijeStampe,
  type EsirInvoiceResponse,
} from "./fiskalniRacuni";
import { brojUSlovima } from "../utils/brojUSlovima";
import { getCurrentUser } from "../utils/auth";
import { usePrint } from "../context/PrintContext";
import { RacunA5 } from "../print/templates/RacunA5";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Statične oznake vrste računa za ovaj modul (gotovinski, maloprodaja).
const VRSTA_RACUNA = "g";
const VRSTA_RACUNA_NOVI = 1;

// Koraci procesa čuvanja računa (redoslijed prati handleSacuvajRacun) — indeks
// u nizu + 1 = vrijednost koju drži korakCuvanja state dok je taj korak aktivan.
const KORACI_CUVANJA = [
  "Unos podataka za račun",
  "Dobijanje šifre tabele",
  "Ažuriranje dostave",
  "Slanje ka ESIR-u",
  "Prihvat JSON-a od ESIR-a",
];


// Stopa PDV-a — MPC je osnova obračuna, VPC = MPC / (1 + STOPA_PDV).
const STOPA_PDV = 0.17;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const formatDatumIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatVremeIso = (d: Date) =>
  `${formatDatumIso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Format naziva fajla za ESIR debug dump: yyyy-MM-dd_HH_mm_ss (šifra tabele se
// dodaje posebno, vidi sacuvajEsirGreskuJson).
const formatDatumZaNazivFajla = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 transition-all text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878] bg-white dark:bg-[#1e1a2d]";

interface DodatnaLokacija {
  sifra_partnera: number;
  naziv_lokacije?: string;
  adresa_lokacije?: string;
  Naziv_grada?: string;
  [key: string]: unknown;
}

interface Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  nabavna_cijena: number | string;
  barkod: string;
  kolicina_proizvoda: number | string;
  kolicinaNaStanju: number;
  grupa_proizvoda: string;
  naziv_grupe: string;
  vrsta_proizvoda: number;
  [key: string]: unknown;
}

interface ArtikalGrupa {
  sifra_grupe: string | number;
  naziv_grupe: string;
  [key: string]: unknown;
}

interface NivelacijaAktivna {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  cijena_bazna: number | string;
  cijena_trenutna: number | string;
  datum_nivelacije: string;
  sifra_nivelacije: number;
}

interface RacunIstorija {
  sifra_tabele: number;
  broj_racuna: number | string;
  vrsta_racuna: number | string;
  datum_racuna: string;
  vrsta_racuna_novi?: number | string;
  vrsta_racuna_pod?: number | string;
}

interface RacunPodgrupa {
  sifra_podgrupe: number;
  opis_podgrupe: string;
  obracunava_se_pdv: number;
}

interface StavkaIstorijeRacuna {
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number | string;
  cijena_sa_rab: number | string;
  prodajna_cijena: number | string;
  vpc_vrednost: number | string;
  prodajna_vrednost: number | string;
}

interface Teren {
  sifra_terena_dostava: number;
  sifra_terena: number;
  naziv_dana: string;
  datum_dostave?: string;
  zavrsena_dostava?: number;
  [key: string]: unknown;
}

interface NarudzbaZavrsenaProizvod {
  sifra_tabele: number;
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  napomena: string;
  verifikovano: number;
}

interface NarudzbaZavrsenaKupac {
  sifra_kupca: number;
  naziv_kupca: string;
  referentni_broj: string;
  nacin_placanja: string;
  stampano: number;
  proizvodi: NarudzbaZavrsenaProizvod[];
}

interface StavkaRacuna {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  mpc: number;
  nabavna_cijena: number;
  barkod: string;
  ukupno: number;
}

// Red pomoćne tabele (stavke) gotovinskog računa — priprema za slanje kroz proceduru.
// Osnova obračuna je uvijek MPC (odatle se šalje i fiskalnom računu): VPC = MPC / 1.17,
// a PDV po artiklu je razlika MPC - VPC. Rabat i njegovi nivoi (2, 3) postoje zbog
// zajedničkog oblika sa žiralnim računima — za gotovinski (maloprodajni) uvijek su 0,
// a "vpc_bez_rabata"/"vpc_rabat_1" su tada isti kao vpc.
interface StavkaZaUnos {
  sifra_proizvoda: number;
  cijena_proizvoda: number;
  prodajna_cijena: number;
  kolicina: number;
  rabat_proc: number;
  rabat_km: number;
  vpc: number;
  vpc_bez_rabata: number;
  rabat_proc_2: number;
  rabat_km_2: number;
  rab_proc_3: number;
  rabat_km_3: number;
  vpc_rabat_1: number;
  pdv_po_artiklu: number;
  nabavna_cijena_proizvoda: number;
}

// Heder (glavna tabela) gotovinskog računa.
interface RacunHeader {
  vrsta_racuna: string;
  sifra_kupca: number;
  datum_racuna: string;
  ukupno: number;
  sifra_radnika: number;
  slovima: string;
  valuta: string;
  datum_isporuke: string;
  napomena: string;
  rabat_km: number;
  vreme: string;
  VP_vrednost: number;
  vp_vrednost_original: number;
  VP_1: number;
  VP_2: number;
  vrsta_racuna_novi: number;
  vrsta_racuna_pod: number;
  sifra_terena: number;
}

interface RacunZaUnos {
  header: RacunHeader;
  items: StavkaZaUnos[];
}

interface PartnerRazni {
  sifra_partnera: number;
  naziv_partnera: string;
  pripada_radniku: number;
}

interface Grad {
  sifra_grada: number;
  naziv_grada: string;
  [key: string]: unknown;
}

interface Radnik {
  sifra_radnika: number;
  naziv_radnika: string;
  sifra_vrste: number;
  [key: string]: unknown;
}

interface Partner {
  sifra_partnera: number;
  naziv_partnera: string;
  vrsta_partnera: number;
  jib: string;
  pib: string;
  maticni_broj: string;
  adresa_partnera: string;
  sifra_grada: number;
  naziv_grada: string;
  ptt: string;
  entitet: string;
  sifra_drzave: number;
  naziv_drzave: string;
  dogovorena_valuta: string;
  koristiti_u_azuriranju: number;
  pripada_radniku: number;
  naziv_radnika: string;
  dodatna_lokacija?: DodatnaLokacija;
}

export function GotovinskiRacuni() {
  const { openPrint, printDirectly, selectedPrinter } = usePrint();
  // Kad je uključeno, "Sačuvaj i štampaj" šalje A5 obrazac direktno na izabrani
  // štampač (bez otvaranja print modala da korisnik klikne štampaj).
  const [stampajDirektno, setStampajDirektno] = useState(false);
  // Privremeno (debug) — modal koji prikazuje tačan zahtjev koji se šalje ESIR
  // uređaju (esirFetch/izdajFiskalniRacun), da se vidi šta stvarno ide preko wire-a.
  const [pokaziEsirDebug, setPokazuiEsirDebug] = useState(false);
  const [esirDebugSalje, setEsirDebugSalje] = useState(false);
  const [esirDebugOdgovor, setEsirDebugOdgovor] = useState<{
    ok: boolean;
    status: number;
    tekst: string;
  } | null>(null);
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [odabraniPartner, setOdabraniPartner] = useState<Partner | null>(null);

  const [pretraga, setPretraga] = useState("");
  const [pokaziDropdown, setPokazuiDropdown] = useState(false);
  const [pokaziModal, setPokazuiModal] = useState(false);
  const [pretragaModal, setPretragaModal] = useState("");

  const [partneriRazni, setPartneriRazni] = useState<PartnerRazni[]>([]);
  const [loadingPartneriRazni, setLoadingPartneriRazni] = useState(false);
  const [odabraniRazni, setOdabraniRazni] = useState<PartnerRazni | null>(null);
  const [pokaziModalRazni, setPokazuiModalRazni] = useState(false);
  const [pretragaRazni, setPretragaRazni] = useState("");

  const [prikaziNoviRazniForm, setPrikaziNoviRazniForm] = useState(false);
  const [gradovi, setGradovi] = useState<Grad[]>([]);
  const [loadingGradovi, setLoadingGradovi] = useState(false);
  const [radnici, setRadnici] = useState<Radnik[]>([]);
  const [loadingRadnici, setLoadingRadnici] = useState(false);
  const [noviRazniNaziv, setNoviRazniNaziv] = useState("");
  const [noviRazniSifraGrada, setNoviRazniSifraGrada] = useState("");
  const [noviRazniSifraRadnika, setNoviRazniSifraRadnika] = useState("");
  const [dodajRazniLoading, setDodajRazniLoading] = useState(false);
  const [dodajRazniGreska, setDodajRazniGreska] = useState<string | null>(null);

  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [grupe, setGrupe] = useState<ArtikalGrupa[]>([]);
  const [loadingArtikli, setLoadingArtikli] = useState(true);
  const [pretragaArtikala, setPretragaArtikala] = useState("");
  const [odabranaGrupa, setOdabranaGrupa] = useState<string | null>(null);
  const [samoNaStanju, setSamoNaStanju] = useState(true);
  const [nivelacijeAktivne, setNivelacijeAktivne] = useState<
    NivelacijaAktivna[]
  >([]);
  const [istorijaRacuna, setIstorijaRacuna] = useState<RacunIstorija[]>([]);
  const [loadingIstorijaRacuna, setLoadingIstorijaRacuna] = useState(false);
  const [pokaziModalStavkiRacuna, setPokazuiModalStavkiRacuna] =
    useState(false);
  const [odabraniRacunIstorija, setOdabraniRacunIstorija] =
    useState<RacunIstorija | null>(null);
  const [stavkeIstorijeRacuna, setStavkeIstorijeRacuna] = useState<
    StavkaIstorijeRacuna[]
  >([]);
  const [loadingStavkeIstorijeRacuna, setLoadingStavkeIstorijeRacuna] =
    useState(false);
  const [napomena, setNapomena] = useState("");
  const [podgrupeRacuna, setPodgrupeRacuna] = useState<RacunPodgrupa[]>([]);
  const [loadingPodgrupeRacuna, setLoadingPodgrupeRacuna] = useState(true);
  const [odabranaPodgrupa, setOdabranaPodgrupa] =
    useState<RacunPodgrupa | null>(null);
  const [tereni, setTereni] = useState<Teren[]>([]);
  const [loadingTereni, setLoadingTereni] = useState(true);
  const [odabraniTeren, setOdabraniTeren] = useState<Teren | null>(null);
  const [pokaziDropdownTeren, setPokazuiDropdownTeren] = useState(false);

  const [pokaziModalNarudzbe, setPokazuiModalNarudzbe] = useState(false);
  const [loadingNarudzbe, setLoadingNarudzbe] = useState(false);
  const [zavrseneNarudzbe, setZavrseneNarudzbe] = useState<
    NarudzbaZavrsenaKupac[]
  >([]);
  const [odabraniKupacNarudzbe, setOdabraniKupacNarudzbe] =
    useState<NarudzbaZavrsenaKupac | null>(null);
  const [pendingUvozNarudzbe, setPendingUvozNarudzbe] =
    useState<NarudzbaZavrsenaKupac | null>(null);
  // Šifre tabele (tmp_pregled_narucenig_proizvoda) uvezenog kupca — spremne da se
  // kasnije pošalju proceduri koja ažurira polje "stampano" nakon čuvanja računa.
  const [sifreTabeleZaStampano, setSifreTabeleZaStampano] = useState<
    { sifra_tabele: number }[]
  >([]);

  const [stavke, setStavke] = useState<StavkaRacuna[]>([]);
  const [artikalZaUnos, setArtikalZaUnos] = useState<Artikal | null>(null);
  const [kolicina, setKolicina] = useState("");
  const [artikalZaNivelisanje, setArtikalZaNivelisanje] =
    useState<Artikal | null>(null);
  const [artikalZaCijenu, setArtikalZaCijenu] = useState<Artikal | null>(null);
  const [novaVpc, setNovaVpc] = useState("");
  const [novaMpc, setNovaMpc] = useState("");
  const [nivelacijaLoading, setNivelacijaLoading] = useState(false);
  const [nivelacijaGreska, setNivelacijaGreska] = useState<string | null>(null);

  const [spremanjeLoading, setSpremanjeLoading] = useState(false);
  const [spremanjeGreska, setSpremanjeGreska] = useState<string | null>(null);
  // Upozorenje kad je fiskalizacija uspjela ali uređaj javlja sporedan problem
  // (npr. printer nije odštampao paragon) — nije greška, samo obavještenje.
  const [spremanjeUpozorenje, setSpremanjeUpozorenje] = useState<
    string | null
  >(null);
  // Broj fiskalnog računa (br_fiskalnog) nakon uspješne fiskalizacije zadnjeg
  // sačuvanog računa — prikazuje se ispod dugmadi Sačuvaj/Sačuvaj i štampaj.
  const [posljednjiBrojFiskalnog, setPosljednjiBrojFiskalnog] = useState<
    string | null
  >(null);
  // Koraci čuvanja računa — prikazuju se kao status-bar preko liste stavki dok
  // traje handleSacuvajRacun, da operater vidi u kojoj je fazi (0 = neaktivno).
  const [korakCuvanja, setKorakCuvanja] = useState(0);

  const [statusKase, setStatusKase] = useState<
    "provjera" | "dostupna" | "nedostupna"
  >("provjera");

  const searchRef = useRef<HTMLDivElement>(null);
  const terenRef = useRef<HTMLDivElement>(null);
  const korisnickiOdabirPartneraRef = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partneriRes, lokacijeRes] = await Promise.all([
          fetch(`${API_URL}/api/partneri`, { credentials: "include" }),
          fetch(`${API_URL}/api/partneri/dodatne-lokacije`, {
            credentials: "include",
          }),
        ]);
        if (!partneriRes.ok) return;
        const partneriData = await partneriRes.json();
        const lista: Partner[] = partneriData.data ?? [];
        if (lokacijeRes.ok) {
          const lokacijeData = await lokacijeRes.json();
          const lokacije: DodatnaLokacija[] = lokacijeData.data ?? [];
          const lokacijeMap = new Map(
            lokacije.map((l) => [l.sifra_partnera, l]),
          );
          lista.forEach((p) => {
            const lok = lokacijeMap.get(p.sifra_partnera);
            if (lok) p.dodatna_lokacija = lok;
          });
        }
        setPartneri(lista);
        const def = lista.find((p) => p.sifra_partnera === 300);
        if (def) setOdabraniPartner(def);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const provjeriKasu = async () => {
      setStatusKase("provjera");
      try {
        await preuzmiStatusEsira("gotovinski");
        if (!cancelled) setStatusKase("dostupna");
      } catch {
        if (!cancelled) setStatusKase("nedostupna");
      }
    };
    void provjeriKasu();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (odabraniPartner?.sifra_partnera !== 300) {
      setOdabraniRazni(null);
      setPokazuiModalRazni(false);
      setPrikaziNoviRazniForm(false);
      korisnickiOdabirPartneraRef.current = false;
      return;
    }
    const otvoriModal = korisnickiOdabirPartneraRef.current;
    korisnickiOdabirPartneraRef.current = false;
    setOdabraniRazni(null);
    if (otvoriModal) setPokazuiModalRazni(true);
    setLoadingPartneriRazni(true);
    let cancelled = false;
    fetch(`${API_URL}/api/partneri/razni`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setPartneriRazni(d.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setPartneriRazni([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPartneriRazni(false);
      });
    return () => {
      cancelled = true;
    };
  }, [odabraniPartner]);

  useEffect(() => {
    if (!odabraniPartner || odabraniPartner.sifra_partnera === 300) {
      setIstorijaRacuna([]);
      return;
    }
    let cancelled = false;
    setLoadingIstorijaRacuna(true);
    fetch(
      `${API_URL}/api/racuni/istorija?sifraPartnera=${odabraniPartner.sifra_partnera}`,
      { credentials: "include" },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setIstorijaRacuna(d.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setIstorijaRacuna([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingIstorijaRacuna(false);
      });
    return () => {
      cancelled = true;
    };
  }, [odabraniPartner]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setPokazuiDropdown(false);
      if (terenRef.current && !terenRef.current.contains(e.target as Node))
        setPokazuiDropdownTeren(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const dropdownRezultati = useMemo(() => {
    if (pretraga.length < 1) return [];
    const q = pretraga.toLowerCase();
    return partneri
      .filter(
        (p) =>
          p.naziv_partnera.toLowerCase().includes(q) ||
          String(p.sifra_partnera).includes(q) ||
          (p.jib && p.jib.toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [partneri, pretraga]);

  const modalRezultati = useMemo(() => {
    const q = pretragaModal.toLowerCase();
    return partneri
      .filter((p) => p.naziv_partnera.toLowerCase().includes(q))
      .sort((a, b) => a.naziv_partnera.localeCompare(b.naziv_partnera, "bs"));
  }, [partneri, pretragaModal]);

  useEffect(() => {
    const fetchTereni = async () => {
      try {
        const res = await fetch(`${API_URL}/api/teren/terena-po-danima`, {
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          const lista: Teren[] = d.data ?? [];
          setTereni(
            [...lista].sort(
              (a, b) =>
                new Date(a.datum_dostave ?? 0).getTime() -
                new Date(b.datum_dostave ?? 0).getTime(),
            ),
          );
        }
      } finally {
        setLoadingTereni(false);
      }
    };
    void fetchTereni();
  }, []);

  useEffect(() => {
    const fetchPodgrupeRacuna = async () => {
      try {
        const res = await fetch(`${API_URL}/api/racuni/podgrupe`, {
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          const lista: RacunPodgrupa[] = d.data ?? [];
          setPodgrupeRacuna(lista);
          const podrazumijevana = lista.find(
            (p) => Number(p.sifra_podgrupe) === 10,
          );
          if (podrazumijevana) setOdabranaPodgrupa(podrazumijevana);
        }
      } finally {
        setLoadingPodgrupeRacuna(false);
      }
    };
    void fetchPodgrupeRacuna();
  }, []);

  const fetchNivelacijeAktivne = async () => {
    try {
      const res = await fetch(`${API_URL}/api/nivelacije/aktivne`, {
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        setNivelacijeAktivne(d.data ?? []);
      }
    } catch {
      // ignoriši grešku — bedž je samo dodatna informacija
    }
  };

  useEffect(() => {
    const fetchArtikli = async () => {
      try {
        const [artikliRes, grupeRes] = await Promise.all([
          fetch(`${API_URL}/api/artikli`, { credentials: "include" }),
          fetch(`${API_URL}/api/artikli/grupe`, { credentials: "include" }),
        ]);
        if (artikliRes.ok) {
          const d = await artikliRes.json();
          setArtikli(d.data ?? []);
        }
        if (grupeRes.ok) {
          const d = await grupeRes.json();
          setGrupe(d.data ?? []);
        }
        void fetchNivelacijeAktivne();
      } finally {
        setLoadingArtikli(false);
      }
    };
    void fetchArtikli();
  }, []);

  const nivelacijeMap = useMemo(
    () => new Map(nivelacijeAktivne.map((n) => [String(n.sifra_proizvoda), n])),
    [nivelacijeAktivne],
  );

  const filtriranihArtikli = useMemo(() => {
    const q = pretragaArtikala.toLowerCase().trim();
    return artikli.filter((a) => {
      const matchGrupa =
        odabranaGrupa === null || a.grupa_proizvoda === odabranaGrupa;
      const matchQ =
        !q ||
        a.naziv_proizvoda.toLowerCase().includes(q) ||
        String(a.sifra_proizvoda).includes(q);
      const matchStanje = !samoNaStanju || Number(a.kolicina_proizvoda) > 0;
      return matchGrupa && matchQ && matchStanje;
    });
  }, [artikli, pretragaArtikala, odabranaGrupa, samoNaStanju]);

  const handleOdabir = (p: Partner) => {
    korisnickiOdabirPartneraRef.current = true;
    setOdabraniPartner(p);
    setPretraga("");
    setPokazuiDropdown(false);
    // Nova selekcija partnera — poruka o fiskalnom broju sa prethodnog računa
    // više nije relevantna.
    setPosljednjiBrojFiskalnog(null);
  };

  const filtriraniRazni = useMemo(() => {
    const q = pretragaRazni.toLowerCase().trim();
    return partneriRazni.filter(
      (p) =>
        !q ||
        p.naziv_partnera.toLowerCase().includes(q) ||
        String(p.sifra_partnera).includes(q),
    );
  }, [partneriRazni, pretragaRazni]);

  const radniciZaIzbor = useMemo(
    () =>
      radnici.filter(
        (r) => Number(r.sifra_vrste) === 1 || Number(r.sifra_vrste) === 2,
      ),
    [radnici],
  );

  const handleOdabirRazni = (p: PartnerRazni) => {
    setOdabraniRazni(p);
    setPokazuiModalRazni(false);
    setPretragaRazni("");
    setPrikaziNoviRazniForm(false);
    // Nova selekcija kupca — poruka o fiskalnom broju sa prethodnog računa
    // više nije relevantna.
    setPosljednjiBrojFiskalnog(null);
  };

  const handleOtvoriNoviRazniForm = () => {
    setPrikaziNoviRazniForm(true);
    setDodajRazniGreska(null);
    if (gradovi.length === 0 && !loadingGradovi) {
      setLoadingGradovi(true);
      fetch(`${API_URL}/api/gradovi`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setGradovi(d.data ?? []))
        .catch(() => setGradovi([]))
        .finally(() => setLoadingGradovi(false));
    }
    if (radnici.length === 0 && !loadingRadnici) {
      setLoadingRadnici(true);
      fetch(`${API_URL}/api/radnici`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setRadnici(d.data ?? []))
        .catch(() => setRadnici([]))
        .finally(() => setLoadingRadnici(false));
    }
  };

  const handleZatvoriNoviRazniForm = () => {
    setPrikaziNoviRazniForm(false);
    setNoviRazniNaziv("");
    setNoviRazniSifraGrada("");
    setNoviRazniSifraRadnika("");
    setDodajRazniGreska(null);
  };

  const handleSacuvajNovogRaznog = async () => {
    if (
      !noviRazniNaziv.trim() ||
      !noviRazniSifraGrada ||
      !noviRazniSifraRadnika
    ) {
      setDodajRazniGreska("Popunite sva polja");
      return;
    }
    setDodajRazniLoading(true);
    setDodajRazniGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/partneri/razni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nazivPartnera: noviRazniNaziv.trim(),
          pripadaRadniku: Number(noviRazniSifraRadnika),
          sifraGrada: Number(noviRazniSifraGrada),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDodajRazniGreska(json.error || "Greška pri dodavanju kupca");
        return;
      }
      const noviKupac: PartnerRazni = json.data;
      setPartneriRazni((prev) => [...prev, noviKupac]);
      setOdabraniRazni(noviKupac);
      setPokazuiModalRazni(false);
      handleZatvoriNoviRazniForm();
    } catch {
      setDodajRazniGreska("Greška pri dodavanju kupca");
    } finally {
      setDodajRazniLoading(false);
    }
  };

  const jeRazniNeodabran =
    odabraniPartner?.sifra_partnera === 300 && !odabraniRazni;

  const handleKlikArtikl = (a: Artikal) => {
    if (jeRazniNeodabran) {
      setPokazuiModalRazni(true);
      return;
    }
    setArtikalZaUnos(a);
    setKolicina("");
  };

  const handlePotvrdiStavku = () => {
    if (!artikalZaUnos) return;
    const kol = parseFloat(kolicina.replace(",", "."));
    if (!kol || kol <= 0) return;
    const mpc =
      typeof artikalZaUnos.mpc === "number"
        ? artikalZaUnos.mpc
        : parseFloat(String(artikalZaUnos.mpc)) || 0;
    const nabavnaCijena =
      typeof artikalZaUnos.nabavna_cijena === "number"
        ? artikalZaUnos.nabavna_cijena
        : parseFloat(String(artikalZaUnos.nabavna_cijena)) || 0;
    const barkod = artikalZaUnos.barkod ?? "";
    setStavke((prev) => {
      const idx = prev.findIndex(
        (s) => s.sifra_proizvoda === artikalZaUnos.sifra_proizvoda,
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          kolicina: updated[idx].kolicina + kol,
          ukupno: (updated[idx].kolicina + kol) * mpc,
        };
        return updated;
      }
      return [
        ...prev,
        {
          sifra_proizvoda: artikalZaUnos.sifra_proizvoda,
          naziv_proizvoda: artikalZaUnos.naziv_proizvoda,
          jm: artikalZaUnos.jm,
          kolicina: kol,
          mpc,
          nabavna_cijena: nabavnaCijena,
          barkod,
          ukupno: kol * mpc,
        },
      ];
    });
    setArtikalZaUnos(null);
    setKolicina("");
  };

  const handleUkloniStavku = (sifra: string) => {
    setStavke((prev) => prev.filter((s) => s.sifra_proizvoda !== sifra));
  };

  // Promjena terena briše već unesene stavke i vraća partnera na podrazumijevanog
  // (šifra 300) — spriječava da stavke/partner iz narudžbe jednog terena završe
  // na računu koji se ustvari šalje za drugi teren.
  const resetujRacunZaPromjenuTerena = () => {
    setStavke([]);
    const def = partneri.find((p) => p.sifra_partnera === 300);
    setOdabraniPartner(def ?? null);
  };

  const handleSacuvajNivelaciju = async () => {
    if (!artikalZaCijenu) return;
    const staraVpc = round2(
      typeof artikalZaCijenu.vpc === "number"
        ? artikalZaCijenu.vpc
        : parseFloat(String(artikalZaCijenu.vpc)) || 0,
    );
    const novaVpcBroj = round2(parseFloat(novaVpc));
    if (!novaVpcBroj || novaVpcBroj <= 0) return;
    const kolicina = Number(artikalZaCijenu.kolicina_proizvoda) || 0;
    const nivelacijaRobe =
      Number(artikalZaCijenu.vrsta_proizvoda) === 2 ? 1 : 0;

    setNivelacijaLoading(true);
    setNivelacijaGreska(null);
    try {
      const datumNivelacije = formatVremeIso(new Date()).replace("T", " ");
      const res = await fetch(`${API_URL}/api/nivelacije`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          datumNivelacije,
          ukupnoStaro: round2(kolicina * staraVpc),
          ukupnoNovo: round2(kolicina * novaVpcBroj),
          nivelacijaRobe,
          stavke: [
            {
              sifra_proizvoda: artikalZaCijenu.sifra_proizvoda,
              kolicina_proizvoda: kolicina,
              cijena_stara: staraVpc,
              cijena_nova: novaVpcBroj,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setNivelacijaGreska(json.error || "Greška pri unosu nivelacije");
        return;
      }
      const novaMpcBroj = parseFloat(novaMpc) || 0;
      setArtikli((prev) =>
        prev.map((a) =>
          a.sifra_proizvoda === artikalZaCijenu.sifra_proizvoda
            ? { ...a, vpc: novaVpcBroj, mpc: novaMpcBroj }
            : a,
        ),
      );
      setArtikalZaCijenu(null);
      setNovaVpc("");
      setNovaMpc("");
      void fetchNivelacijeAktivne();
    } catch {
      setNivelacijaGreska("Greška pri unosu nivelacije");
    } finally {
      setNivelacijaLoading(false);
    }
  };

  const ukupnoRacun = stavke.reduce((s, r) => s + r.ukupno, 0);
  const ukupnoRacunSlovima = useMemo(
    () => brojUSlovima(ukupnoRacun),
    [ukupnoRacun],
  );

  // Priprema kompletnog JSON-a (header + items) za slanje kroz proceduru.
  // MPC je uvijek osnova obračuna (ista vrijednost ide i fiskalnom računu):
  // VPC = MPC / 1.17, PDV po artiklu = MPC - VPC. Rabat i njegovi nivoi su za
  // gotovinski (maloprodajni) račun uvijek 0 — postoje zbog žiralnih računa.
  const pripremiRacunZaUnos = (): RacunZaUnos => {
    const items: StavkaZaUnos[] = stavke.map((s) => {
      const sifraProizvoda = Number(String(s.sifra_proizvoda).trim());
      if (!Number.isFinite(sifraProizvoda)) {
        throw new Error(
          `Neispravna šifra proizvoda za unos računa: ${s.sifra_proizvoda} (${s.naziv_proizvoda})`,
        );
      }
      const mpc = round2(s.mpc);
      const vpc = round2(mpc / (1 + STOPA_PDV));
      const pdvPoArtiklu = round2(mpc - vpc);
      return {
        sifra_proizvoda: sifraProizvoda,
        cijena_proizvoda: vpc,
        prodajna_cijena: mpc,
        kolicina: s.kolicina,
        rabat_proc: 0,
        rabat_km: 0,
        vpc,
        vpc_bez_rabata: vpc,
        rabat_proc_2: 0,
        rabat_km_2: 0,
        rab_proc_3: 0,
        rabat_km_3: 0,
        vpc_rabat_1: vpc,
        pdv_po_artiklu: pdvPoArtiklu,
        nabavna_cijena_proizvoda: round2(s.nabavna_cijena),
      };
    });

    const vpVrednost = round2(
      items.reduce((sum, it) => sum + it.vpc * it.kolicina, 0),
    );
    const sada = new Date();
    const datumRacuna = formatDatumIso(sada);
    const sifraKupca = odabraniPartner?.sifra_partnera ?? 0;

    // Za partnera 300 (razni kupci) fiskalni račun i sifra_kupca ne razlikuju kog
    // konkretno raznog kupca — zato se ime i šifra tog kupca upisuju u napomenu.
    const napomenaZaUnos =
      odabraniPartner?.sifra_partnera === 300 && odabraniRazni
        ? [
            napomena.trim(),
            `${odabraniRazni.naziv_partnera} #${odabraniRazni.sifra_partnera}`,
          ]
            .filter(Boolean)
            .join(" ")
        : napomena;

    const header: RacunHeader = {
      vrsta_racuna: VRSTA_RACUNA,
      sifra_kupca: sifraKupca,
      datum_racuna: datumRacuna,
      ukupno: round2(ukupnoRacun),
      sifra_radnika: getCurrentUser()?.sifraRadnika ?? 0,
      slovima: ukupnoRacunSlovima,
      valuta: datumRacuna,
      datum_isporuke: datumRacuna,
      napomena: napomenaZaUnos,
      rabat_km: 0,
      vreme: formatVremeIso(sada),
      VP_vrednost: vpVrednost,
      vp_vrednost_original: vpVrednost,
      VP_1: vpVrednost,
      VP_2: vpVrednost,
      vrsta_racuna_novi: VRSTA_RACUNA_NOVI,
      vrsta_racuna_pod: odabranaPodgrupa?.sifra_podgrupe ?? 0,
      sifra_terena: odabraniTeren?.sifra_terena_dostava ?? 0,
    };

    return { header, items };
  };

  // Ako artikal nema barkod, GTIN se zamjenjuje šifrom proizvoda dopunjenom nulama
  // slijeva do 13 cifara (dužina EAN13 barkoda — GTIN mora imati 8 do 14 znakova).
  const gtinZaStavku = (s: StavkaRacuna) => {
    const barkod = s.barkod.trim();
    if (barkod) return barkod;

    // Fallback: sifra_proizvoda kao EAN13 (tačno 13 cifara, sa nulama slijeva).
    const samoCifre = String(s.sifra_proizvoda).replace(/\D/g, "");
    return samoCifre.padStart(13, "0").slice(-13);
  };

  // Priprema stavki za ESIR fiskalni račun (POST /api/invoices — izdajFiskalniRacun).
  // Način plaćanja je za gotovinski račun uvijek "Cash", a poreska oznaka po stavci
  // uvijek ESIR_OZNAKA_SA_PDV ("Е") — svi artikli se ovdje prodaju sa PDV-om.
  const pripremiEsirStavke = (): EsirStavka[] =>
    stavke.map((s) => ({
      name: s.naziv_proizvoda,
      gtin: gtinZaStavku(s),
      labels: [ESIR_OZNAKA_SA_PDV],
      totalAmount: round2(s.kolicina * s.mpc),
      unitPrice: round2(s.mpc),
      quantity: s.kolicina,
      discount: 0,
      discountAmount: 0,
    }));

  const pripremiEsirPlacanje = (): EsirPlacanje[] => [
    { amount: round2(ukupnoRacun), paymentType: "Cash" },
  ];

  // Kupac 300 je generički "razni kupci" — na fiskalnom računu se uvijek šalje kao
  // šifra "300" / oznaka "RAZNI KUPCI", bez obzira koji je konkretan razni kupac
  // izabran interno. Za pravog partnera šalje se JIB / naziv partnera.
  const pripremiBuyerId = (): string | undefined => {
    if (!odabraniPartner) return undefined;
    if (odabraniPartner.sifra_partnera === 300) return "300";
    const jib = odabraniPartner.jib?.trim();
    return jib ? jib : undefined;
  };

  // ESIR ograničava buyerCostCenterId na 50 znakova.
  const pripremiBuyerCostCenterId = (): string | undefined => {
    if (!odabraniPartner) return undefined;
    const naziv =
      odabraniPartner.sifra_partnera === 300
        ? "RAZNI KUPCI"
        : odabraniPartner.naziv_partnera;
    return naziv.slice(0, 50);
  };

  // Kompletan zahtjev za POST /api/invoices (izdajFiskalniRacun). Opcije štampe se
  // šalju odvojeno (sestrinsko polje uz invoiceRequest), vidi EsirOpcijeStampe.
  const pripremiEsirZahtjev = (): EsirInvoiceRequest => ({
    invoiceType: "Training", //Normal (promet), Proforma (predračun), Copy (kopija), Training (trening), Advance (avans)
    transactionType: "Sale",
    referentDocumentNumber: null,
    referentDocumentDT: null,
    buyerId: pripremiBuyerId(),
    buyerCostCenterId: pripremiBuyerCostCenterId(),
    payment: pripremiEsirPlacanje(),
    items: pripremiEsirStavke(),
    cashier: (getCurrentUser()?.username ?? "").toUpperCase(),
  });

  const esirOpcijeStampe: EsirOpcijeStampe = {
    print: true,
    renderReceiptImage: true,
    receiptLayout: "Slip",
    receiptImageFormat: "Png",
    ...ESIR_SLIP_PRESET_58MM,
  };

  // Download JSON dump-a se dešava SAMO kad ESIR fiskalizacija/štampa ne uspije
  // (debug pomoć) — naziv fajla: yyyy-MM-dd_HH_mm_ss_<šifra tabele>.json.
  const sacuvajEsirGreskuJson = (
    sifraTabele: unknown,
    podaci: unknown,
  ) => {
    const naziv = `${formatDatumZaNazivFajla(new Date())}_${sifraTabele ?? "nepoznato"}`;
    const blob = new Blob([JSON.stringify(podaci, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${naziv}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Privremeno — dok se ne doda stvarno slanje na backend, ispisujemo pripremljen
  // JSON u konzolu radi provjere obračuna prilikom testiranja unosa stavki.
  useEffect(() => {
    if (stavke.length > 0) {
      console.log("Račun za unos (gotovinski):", pripremiRacunZaUnos());
      console.log("ESIR zahtjev:", {
        ...esirOpcijeStampe,
        invoiceRequest: pripremiEsirZahtjev(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stavke,
    odabraniPartner,
    odabraniRazni,
    napomena,
    odabranaPodgrupa,
    odabraniTeren,
  ]);

  const formatDatumRacuna = (d: string) => {
    const datum = new Date(d);
    if (isNaN(datum.getTime())) return String(d);
    return `${pad(datum.getDate())}.${pad(datum.getMonth() + 1)}.${datum.getFullYear()}.`;
  };

  const formatOznakaRacuna = (r: RacunIstorija) => {
    const vrsta = Number(r.vrsta_racuna_novi);
    const prefiks = vrsta === 1 ? "MP" : vrsta === 2 ? "VP" : "";
    const godina = String(new Date(r.datum_racuna).getFullYear()).slice(-2);
    return `${prefiks}-${r.vrsta_racuna_pod}-${r.broj_racuna} / ${godina}`;
  };

  const handleKlikRacunIstorija = async (r: RacunIstorija) => {
    setOdabraniRacunIstorija(r);
    setPokazuiModalStavkiRacuna(true);
    setLoadingStavkeIstorijeRacuna(true);
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/stavke?sifraTabele=${r.sifra_tabele}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const d = await res.json();
        setStavkeIstorijeRacuna(d.data ?? []);
      } else {
        setStavkeIstorijeRacuna([]);
      }
    } catch {
      setStavkeIstorijeRacuna([]);
    } finally {
      setLoadingStavkeIstorijeRacuna(false);
    }
  };

  // Završene narudžbe za izabrani teren — spaja "grupisano" (podaci o kupcu) i
  // "aktivne" (stavke po proizvodu, sa verifikovano). Prikazuju se samo kupci kod
  // kojih su SVI proizvodi verifikovani (verifikovano === 2), tj. spremni za račun.
  const handleOtvoriModalNarudzbe = async () => {
    setPokazuiModalNarudzbe(true);
    setOdabraniKupacNarudzbe(null);
    if (!odabraniTeren) {
      setZavrseneNarudzbe([]);
      return;
    }
    setLoadingNarudzbe(true);
    try {
      const [grupisaneRes, aktivneRes] = await Promise.all([
        fetch(
          `${API_URL}/api/narudzbe/narudzbe-grupisane?sifraTerena=${odabraniTeren.sifra_terena_dostava}`,
          { credentials: "include" },
        ),
        fetch(
          `${API_URL}/api/narudzbe/narudzbe-aktivne?sifraTerena=${odabraniTeren.sifra_terena_dostava}`,
          { credentials: "include" },
        ),
      ]);
      if (!grupisaneRes.ok || !aktivneRes.ok) {
        setZavrseneNarudzbe([]);
        return;
      }
      const grupisaneJson = await grupisaneRes.json();
      const aktivneJson = await aktivneRes.json();
      if (!grupisaneJson.success || !aktivneJson.success) {
        setZavrseneNarudzbe([]);
        return;
      }

      // Šema tmp_partneri (narudzbe-grupisane):
      const grupisaneRedovi = (grupisaneJson.data ?? []) as Array<{
        sifra_partnera: number;
        naziv_partnera: string;
        sifra_grada?: number;
        naziv_grada?: string;
        referentni_broj?: string;
        nacin_placanja?: string;
        stampano?: number | string;
      }>;
      // Šema tmp_pregled_narucenig_proizvoda (narudzbe-aktivne):
      const aktivniRedovi = (aktivneJson.data ?? []) as Array<{
        sifra_tabele?: number;
        sifra_partnera: number;
        sifra_proizvoda: string | number;
        naziv_proizvoda: string;
        jm: string;
        kolicina_proizvoda: number | string;
        napomena?: string;
        referentni_broj?: string;
        spremljena_kolicina?: number | string;
        verifikovano: number | string;
        naziv_partnera?: string;
        nacin_placanja?: string;
      }>;

      const kupciMap = new Map<number, NarudzbaZavrsenaKupac>();
      grupisaneRedovi.forEach((row) => {
        const sifraKupca = Number(row.sifra_partnera);
        if (!kupciMap.has(sifraKupca)) {
          kupciMap.set(sifraKupca, {
            sifra_kupca: sifraKupca,
            naziv_kupca: row.naziv_partnera || "Nepoznat kupac",
            referentni_broj: String(row.referentni_broj ?? "").trim(),
            nacin_placanja: String(row.nacin_placanja ?? "").trim(),
            stampano: Number(row.stampano) || 0,
            proizvodi: [],
          });
        }
      });
      aktivniRedovi.forEach((row) => {
        const sifraKupca = Number(row.sifra_partnera);
        let kupac = kupciMap.get(sifraKupca);
        if (!kupac) {
          kupac = {
            sifra_kupca: sifraKupca,
            naziv_kupca: row.naziv_partnera || "Nepoznat kupac",
            referentni_broj: String(row.referentni_broj ?? "").trim(),
            nacin_placanja: String(row.nacin_placanja ?? "").trim(),
            stampano: 0,
            proizvodi: [],
          };
          kupciMap.set(sifraKupca, kupac);
        }
        kupac.proizvodi.push({
          sifra_tabele: Number(row.sifra_tabele),
          sifra_proizvoda: String(row.sifra_proizvoda),
          naziv_proizvoda: row.naziv_proizvoda,
          jm: row.jm,
          kolicina: Number(row.kolicina_proizvoda) || 0,
          napomena: row.napomena || "",
          verifikovano: Number(row.verifikovano),
        });
      });

      const zavrseni = Array.from(kupciMap.values())
        .filter(
          (k) =>
            k.proizvodi.length > 0 &&
            k.proizvodi.every((p) => p.verifikovano === 2) &&
            k.nacin_placanja.trim().toUpperCase() !== "VIRMANSKO",
        )
        .sort((a, b) => a.naziv_kupca.localeCompare(b.naziv_kupca, "bs"));

      setZavrseneNarudzbe(zavrseni);
    } catch {
      setZavrseneNarudzbe([]);
    } finally {
      setLoadingNarudzbe(false);
    }
  };

  // Pokreće uvoz narudžbe u glavnu formu — izabere partnera (ili "razni" kupca),
  // a stvarno punjenje stavki radi efekat ispod, čim odabraniPartner stigne na cilj.
  const handleUvezNarudzbu = (k: NarudzbaZavrsenaKupac) => {
    const jeRazniKupac =
      k.nacin_placanja.trim().toUpperCase() === "RAZNI KUPAC";
    if (jeRazniKupac) {
      const partner300 = partneri.find((p) => p.sifra_partnera === 300);
      if (!partner300) {
        alert("Partner 'Razni kupci' (300) nije pronađen u listi partnera.");
        return;
      }
      korisnickiOdabirPartneraRef.current = false;
      setOdabraniPartner(partner300);
    } else {
      const partner = partneri.find((p) => p.sifra_partnera === k.sifra_kupca);
      if (!partner) {
        alert(
          `Partner sa šifrom ${k.sifra_kupca} nije pronađen u listi partnera.`,
        );
        return;
      }
      korisnickiOdabirPartneraRef.current = false;
      setOdabraniPartner(partner);
    }
    setPendingUvozNarudzbe(k);
    setPokazuiModalNarudzbe(false);
    setOdabraniKupacNarudzbe(null);
    // Novi podaci povučeni iz terena — poruka o fiskalnom broju sa prethodnog
    // računa više nije relevantna.
    setPosljednjiBrojFiskalnog(null);

    // Priprema JSON sa svim sifra_tabele iz uvezene narudžbe — kasnije se šalje
    // proceduri koja ažurira "stampano" (nakon što se račun sačuva). Oblik:
    // [{ "sifra_tabele": 125 }, { "sifra_tabele": 126 }, ...]
    const sifreTabele = k.proizvodi.map((p) => ({
      sifra_tabele: p.sifra_tabele,
    }));
    setSifreTabeleZaStampano(sifreTabele);
    console.log(
      "Sifre tabele za ažuriranje 'stampano' (uvoz narudžbe):",
      JSON.stringify(sifreTabele),
    );
  };

  // Kad odabraniPartner stvarno stigne na traženog kupca (ili na 300 za razni), puni
  // se korpa cijenama iz TRENUTNOG kataloga artikli (ne iz narudžbe — cijena se mogla
  // promijeniti). Artikli koji ne postoje u katalogu ili nemaju stanje se preskaču.
  useEffect(() => {
    if (!pendingUvozNarudzbe) return;
    const k = pendingUvozNarudzbe;
    const jeRazniKupac =
      k.nacin_placanja.trim().toUpperCase() === "RAZNI KUPAC";

    if (jeRazniKupac) {
      if (odabraniPartner?.sifra_partnera !== 300) return;
      setOdabraniRazni({
        sifra_partnera: k.sifra_kupca,
        naziv_partnera: k.naziv_kupca,
        pripada_radniku: 0,
      });
    } else if (odabraniPartner?.sifra_partnera !== k.sifra_kupca) {
      return;
    }

    const preskoceniProizvodi: string[] = [];
    const noveStavke: StavkaRacuna[] = [];
    k.proizvodi.forEach((p) => {
      const artikal = artikli.find(
        (a) => String(a.sifra_proizvoda) === p.sifra_proizvoda,
      );
      if (!artikal || Number(artikal.kolicina_proizvoda) <= 0) {
        preskoceniProizvodi.push(p.naziv_proizvoda);
        return;
      }
      const mpc =
        typeof artikal.mpc === "number"
          ? artikal.mpc
          : parseFloat(String(artikal.mpc)) || 0;
      const nabavnaCijena =
        typeof artikal.nabavna_cijena === "number"
          ? artikal.nabavna_cijena
          : parseFloat(String(artikal.nabavna_cijena)) || 0;
      noveStavke.push({
        sifra_proizvoda: artikal.sifra_proizvoda,
        naziv_proizvoda: artikal.naziv_proizvoda,
        jm: artikal.jm,
        kolicina: p.kolicina,
        mpc,
        nabavna_cijena: nabavnaCijena,
        barkod: artikal.barkod ?? "",
        ukupno: round2(p.kolicina * mpc),
      });
    });

    console.log("Uvoz narudžbe — kupac:", k);
    console.log(
      "Uvoz narudžbe — nove stavke (zamjenjuju sve postojeće u računu):",
      noveStavke,
    );

    // setStavke potpuno zamjenjuje dotadašnji sadržaj računa (ne dodaje na postojeće).
    setStavke(noveStavke);
    setPendingUvozNarudzbe(null);
    if (preskoceniProizvodi.length > 0) {
      alert(
        `Preskočeni proizvodi (nema ih u katalogu ili nema stanja):\n${preskoceniProizvodi.join("\n")}`,
      );
    }
  }, [pendingUvozNarudzbe, odabraniPartner, artikli]);

  // Šalje { header, items } proceduri erp.sp_racuni_unos preko POST /api/racuni/unos.
  // Procedura vraća kod=0 uz sifra_tabele/broj_racuna pri uspjehu, ili kod!=0 uz poruku
  // greške (šifrarnik grešaka: public/kodovi_unosa.txt) — tu poruku samo prosljeđujemo.
  // "stampaj" nakon uspješnog čuvanja otvara A5 print preview (RacunA5) — izdavanje
  // fiskalnog računa (ESIR) je odvojen korak, još nepovezan (pripremiEsirZahtjev/
  // esirOpcijeStampe su već spremni za to).
  const handleSacuvajRacun = async (stampaj: boolean) => {
    if (stavke.length === 0) return;
    setSpremanjeLoading(true);
    setSpremanjeGreska(null);
    setSpremanjeUpozorenje(null);
    setPosljednjiBrojFiskalnog(null);
    setKorakCuvanja(1); // Unos podataka za račun
    try {
      const podaci = pripremiRacunZaUnos();
      const res = await fetch(`${API_URL}/api/racuni/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(podaci),
      });

      const rawOdgovor = await res.text();
      let json: {
        success?: boolean;
        error?: string;
        broj_racuna?: number | string;
        affected_rows?: number | null;
        response_source?: string;
      } | null = null;
      if (rawOdgovor) {
        try {
          json = JSON.parse(rawOdgovor) as {
            success?: boolean;
            error?: string;
            broj_racuna?: number | string;
            affected_rows?: number | null;
            response_source?: string;
          };
        } catch {
          json = null;
        }
      }

      if (!res.ok || !json?.success) {
        const poruka =
          json?.error ||
          rawOdgovor ||
          `Greška pri čuvanju računa (HTTP ${res.status})`;
        setSpremanjeGreska(poruka);
        return;
      }

      const imaBrojRacuna =
        json.broj_racuna !== undefined &&
        json.broj_racuna !== null &&
        String(json.broj_racuna).trim() !== "";
      const affectedRows = Number(json.affected_rows ?? 0);
      const imaAffectedRows = Number.isFinite(affectedRows) && affectedRows > 0;

      if (!imaBrojRacuna && !imaAffectedRows) {
        setSpremanjeGreska(
          "Upis nije pouzdano potvrđen, pa ESIR korak nije odobren.",
        );
        return;
      }

      setKorakCuvanja(2); // Dobijanje šifre tabele

      // Ako je račun napunjen uvozom narudžbe, prije ESIR-a ažuriraj "stampano"
      // (0 -> 1) za sve stavke te narudžbe — best-effort, ne blokira dalje korake.
      if (sifreTabeleZaStampano.length > 0) {
        setKorakCuvanja(3); // Ažuriranje dostave
        try {
          await fetch(`${API_URL}/api/narudzbe/azuriraj-stampano`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sifre_tabele: sifreTabeleZaStampano }),
          });
        } catch (stampanoError) {
          console.error(
            "Ažuriranje 'stampano' za narudžbu nije uspjelo:",
            stampanoError,
          );
        }
        setSifreTabeleZaStampano([]);
      }

      // Uhvaćeno van try/catch da bude dostupno kasnije za A5 print (npr. QR
      // kod za verifikaciju) — ostaje null ako fiskalizacija ne uspije.
      let esirInvoiceResponse: EsirInvoiceResponse | null = null;

      // Fiskalizacija (ESIR) — best-effort korak nakon što je račun već sačuvan u
      // bazi: ako ESIR ili upis fiskalnih podataka ne uspiju, ne diramo već
      // potvrđeno čuvanje računa, samo prijavimo grešku (detaljno rukovanje
      // greškama ESIR-a rješavamo naknadno).
      try {
        setKorakCuvanja(4); // Slanje ka ESIR-u
        const esirRezultat = await izdajFiskalniRacun(
          "gotovinski",
          pripremiEsirZahtjev(),
          esirOpcijeStampe,
          json.sifra_tabele !== undefined && json.sifra_tabele !== null
            ? String(json.sifra_tabele)
            : undefined,
        );
        setKorakCuvanja(5); // Prihvat JSON-a od ESIR-a
        esirInvoiceResponse = esirRezultat.invoiceResponse;
        const { brFiskalnog, datumVremeFiskalnog } = izdvojiFiskalnePodatke(
          esirRezultat.invoiceResponse,
        );

        // Fiskalizacija je uspjela iako uređaj možda prijavi sporedan problem
        // (npr. štampač) — to nije razlog da odbacimo fiskalne podatke.
        if (esirRezultat.upozorenje) {
          console.warn(
            "ESIR upozorenje (fiskalizacija ipak uspjela):",
            esirRezultat.upozorenje,
          );
          setSpremanjeUpozorenje(
            `Fiskalizacija je uspjela, ali uređaj javlja: ${esirRezultat.upozorenje}`,
          );
        }

        if (json.sifra_tabele) {
          const resFiskalno = await fetch(
            `${API_URL}/api/racuni/azuriraj-fiskalne-podatke`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                sifra_tabele: json.sifra_tabele,
                br_fiskalnog: brFiskalnog,
                datum_vreme_fiskalnog: datumVremeFiskalnog,
              }),
            },
          );
          if (!resFiskalno.ok) {
            const greska = await resFiskalno.json().catch(() => null);
            throw new Error(
              greska?.error || "Greška pri upisu fiskalnih podataka",
            );
          }
          setPosljednjiBrojFiskalnog(brFiskalnog);
        }
      } catch (esirError) {
        console.error("Fiskalizacija (ESIR) nije uspjela:", esirError);
        // Privremeno vidljivo u UI (ne samo u konzoli) dok se ne utvrdi tačan
        // uzrok razlike u odnosu na Postman (najčešće CORS — browser fetch šalje
        // preflight OPTIONS zbog Authorization/RequestId headera, Postman ne).
        setSpremanjeGreska(
          `Račun je sačuvan, ali ESIR fiskalizacija nije uspjela: ${
            esirError instanceof Error ? esirError.message : String(esirError)
          }`,
        );
        // Debug dump samo kod neuspjeha — sadrži tačan zahtjev koji je poslat
        // ESIR-u i grešku, da se problem može analizirati/reprodukovati.
        sacuvajEsirGreskuJson(json.sifra_tabele, {
          zahtjev: {
            ...esirOpcijeStampe,
            invoiceRequest: pripremiEsirZahtjev(),
          },
          greska:
            esirError instanceof Error ? esirError.message : String(esirError),
        });
      }

      if (stampaj) {
        const jeRazniKupac =
          odabraniPartner?.sifra_partnera === 300 && odabraniRazni;
        const nazivZaPrint = jeRazniKupac
          ? odabraniRazni!.naziv_partnera
          : (odabraniPartner?.naziv_partnera ?? "-");
        const sifraZaPrint = jeRazniKupac
          ? odabraniRazni!.sifra_partnera
          : (odabraniPartner?.sifra_partnera ?? "-");
        const stavkeZaPrint = stavke;
        const racunA5 = (
          <RacunA5
            racun={{
              broj_racuna: String(json.broj_racuna ?? "-"),
              datum_racuna: podaci.header.datum_racuna,
              naziv_partnera: nazivZaPrint,
              sifra_partnera: sifraZaPrint,
              adresa_partnera: jeRazniKupac
                ? null
                : (odabraniPartner?.adresa_partnera ?? null),
              naziv_grada: jeRazniKupac
                ? null
                : (odabraniPartner?.naziv_grada ?? null),
              napomena: podaci.header.napomena || null,
              ukupno: podaci.header.ukupno,
              br_fiskalnog: esirInvoiceResponse?.invoiceNumber ?? null,
              verifikacioni_qr:
                esirInvoiceResponse?.verificationQRCode ?? null,
            }}
            stavke={stavkeZaPrint.map((s) => ({
              sifra_proizvoda: s.sifra_proizvoda,
              naziv_proizvoda: s.naziv_proizvoda,
              jm: s.jm,
              kolicina: s.kolicina,
              prodajna_cijena: s.mpc,
              prodajna_vrednost: s.ukupno,
            }))}
          />
        );

        if (stampajDirektno) {
          try {
            await printDirectly(racunA5, {
              printerName: selectedPrinter,
              format: "A5",
              orientation: "portrait",
              documentType: "racun",
            });
          } catch (printError) {
            setSpremanjeGreska(
              `Račun je sačuvan, ali direktna štampa nije uspjela: ${
                printError instanceof Error
                  ? printError.message
                  : "nepoznata greška"
              }`,
            );
          }
        } else {
          openPrint({
            title: `Račun ${json.broj_racuna ?? "-"}`,
            component: racunA5,
          });
        }
      }

      // Vraća i partnera na podrazumijevanog (300) — spriječava da ime prethodnog
      // kupca ostane prikazano na vrhu forme za sljedeći račun.
      resetujRacunZaPromjenuTerena();
      setNapomena("");
    } catch (error) {
      setSpremanjeGreska(
        error instanceof Error ? error.message : "Greška pri čuvanju računa",
      );
    } finally {
      setSpremanjeLoading(false);
      setKorakCuvanja(0);
    }
  };

  return (
    <>
      <div className="flex flex-col" style={{ height: "calc(100vh - 125px)" }}>
        {/* Red: padajući meni lijevo + kartica desno */}
        <div className="flex gap-3 items-stretch flex-shrink-0">
          {/* Padajući meni — lijevo, fiksna širina */}
          <div
            ref={searchRef}
            className="relative w-[20%] flex-shrink-0 flex flex-col"
          >
            {loading ? (
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
              onFocus={() => pretraga.length >= 1 && setPokazuiDropdown(true)}
              placeholder={loading ? "Učitavanje..." : "Pretraži partnera..."}
              disabled={loading}
              className={`${inputClass} pl-10 h-full`}
            />

            {/* Dropdown rezultati */}
            {pokaziDropdown && dropdownRezultati.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden">
                {dropdownRezultati.map((p) => (
                  <button
                    key={p.sifra_partnera}
                    onMouseDown={() => handleOdabir(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
                        <User size={11} style={{ color: PRIMARY }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                          {p.naziv_partnera}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-[#7d7498]">
                          {p.naziv_grada} · {p.sifra_partnera}
                        </div>
                      </div>
                    </div>
                    {p.dodatna_lokacija && (
                      <span
                        className="ml-1 flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: "#ede8f5", color: PRIMARY }}
                      >
                        +lok
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onMouseDown={() => {
                    setPokazuiDropdown(false);
                    setPokazuiModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border-t border-gray-100 dark:border-[#2d2648] text-gray-500 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
                >
                  <User size={11} />
                  Pregled svih partnera
                </button>
              </div>
            )}

            {pokaziDropdown &&
              pretraga.length >= 1 &&
              dropdownRezultati.length === 0 &&
              !loading && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl px-3 py-2.5 text-xs text-gray-500 dark:text-[#7d7498]">
                  Nema rezultata za „{pretraga}"
                </div>
              )}
          </div>

          {/* Dva dugmeta — po pola visine, između pretrage i kartice */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              className="flex-1 flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
              style={{ background: ACCENT }}
              title="Dodaj partnera"
            >
              <UserPlus size={13} />
              Dodaj
            </button>
            <button
              onClick={() => setPokazuiModal(true)}
              className="flex-1 flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
              style={{ background: PRIMARY }}
              title="Pregled partnera"
            >
              <Users size={13} />
              Pregled
            </button>
          </div>

          {/* Partner kartica — isti red */}
          <div className="relative flex-1 min-w-0">
            {odabraniPartner ? (
              <div
                className="relative h-full rounded-2xl px-3 py-2 shadow-sm grid grid-cols-[1fr_auto_1fr] items-center gap-2"
                style={{ background: PRIMARY }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-white/20">
                    <Banknote size={14} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-xs truncate">
                      {odabraniPartner.naziv_partnera}
                    </div>
                    <div className="text-[10px] text-white/70 flex items-center gap-1 mt-0.5">
                      <MapPin size={8} />
                      {odabraniPartner.naziv_grada} · ID:{" "}
                      {odabraniPartner.sifra_partnera}
                      {odabraniPartner.dogovorena_valuta &&
                        ` · ${odabraniPartner.dogovorena_valuta}`}
                      {odabraniPartner.dodatna_lokacija && (
                        <span className="ml-1 px-1 py-0.5 rounded-full bg-white/20 text-[9px] font-bold">
                          +lok
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {odabraniPartner.sifra_partnera === 300 ? (
                  <div
                    className="flex items-center gap-1 rounded-full bg-white shadow-md border-2"
                    style={{ borderColor: ACCENT }}
                  >
                    <button
                      onClick={() => setPokazuiModalRazni(true)}
                      className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full hover:bg-black/5 transition-all"
                    >
                      <Users size={12} style={{ color: PRIMARY }} />
                      <span
                        className="text-[11px] font-bold whitespace-nowrap"
                        style={{ color: PRIMARY }}
                      >
                        {odabraniRazni
                          ? odabraniRazni.naziv_partnera
                          : "Izaberite kupca…"}
                      </span>
                    </button>
                    {odabraniRazni && (
                      <button
                        onClick={() => setOdabraniRazni(null)}
                        title="Poništi izbor kupca"
                        className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10 transition-all mr-1.5"
                      >
                        <X size={10} style={{ color: PRIMARY }} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                <div />
              </div>
            ) : (
              <div className="relative h-full flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] px-3 py-2 text-xs text-gray-400 dark:text-[#5f5878]">
                <User
                  size={13}
                  className="text-gray-300 dark:text-[#3a3158] flex-shrink-0"
                />
                Odaberite partnera
              </div>
            )}
            {!!odabraniTeren && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <rect
                  x="1"
                  y="1"
                  width="calc(100% - 2px)"
                  height="calc(100% - 2px)"
                  rx="15"
                  ry="15"
                  pathLength={100}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray="14 86"
                  className="snake-trace"
                />
              </svg>
            )}
          </div>

          {/* Teren */}
          <div
            ref={terenRef}
            className="relative flex-shrink-0"
            style={{ minWidth: 170 }}
          >
            <button
              onClick={() => setPokazuiDropdownTeren((v) => !v)}
              disabled={loadingTereni}
              className={`h-full w-full flex flex-col justify-center px-3 rounded-2xl border text-left disabled:opacity-60 transition-all ${
                odabraniTeren
                  ? "border-transparent"
                  : "border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38]"
              }`}
              style={odabraniTeren ? { background: PRIMARY } : undefined}
            >
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide ${
                  odabraniTeren
                    ? "text-white/70"
                    : "text-gray-400 dark:text-[#5f5878]"
                }`}
              >
                Teren
              </span>
              <span
                className={`text-xs font-semibold truncate ${odabraniTeren ? "text-white" : "text-gray-700 dark:text-[#ede9f6]"}`}
              >
                {loadingTereni ? (
                  "Učitavanje..."
                ) : odabraniTeren ? (
                  <>
                    {odabraniTeren.naziv_dana}{" "}
                    <span
                      className={`text-[10px] font-normal ${odabraniTeren ? "text-white/70" : "text-gray-400 dark:text-[#5f5878]"}`}
                    >
                      ({odabraniTeren.sifra_terena_dostava})
                    </span>
                  </>
                ) : (
                  "Bez terena"
                )}
              </span>
            </button>

            {pokaziDropdownTeren && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    if (odabraniTeren !== null) resetujRacunZaPromjenuTerena();
                    setOdabraniTeren(null);
                    setPokazuiDropdownTeren(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] text-xs font-semibold text-gray-500 dark:text-[#7d7498]"
                >
                  Bez terena
                </button>
                {tereni.map((t) => (
                  <button
                    key={t.sifra_terena_dostava}
                    onClick={() => {
                      if (
                        odabraniTeren?.sifra_terena_dostava !==
                        t.sifra_terena_dostava
                      )
                        resetujRacunZaPromjenuTerena();
                      setOdabraniTeren(t);
                      setPokazuiDropdownTeren(false);
                    }}
                    className="w-full flex items-center px-3 py-2 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
                  >
                    <span className="text-xs font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                      {t.naziv_dana}
                    </span>
                    <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-[#5f5878] flex-shrink-0">
                      ({t.sifra_terena_dostava})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vrsta forme */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-5 rounded-2xl border-2 border-dashed"
            style={{ borderColor: PRIMARY }}
          >
            <span
              className="text-sm font-extrabold uppercase tracking-widest"
              style={{ color: PRIMARY }}
            >
              Gotovinski račun
            </span>
            <span
              className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                statusKase === "dostupna"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : statusKase === "nedostupna"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-gray-400 dark:text-[#7d7498]"
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    statusKase === "dostupna"
                      ? "#22c55e"
                      : statusKase === "nedostupna"
                        ? "#ef4444"
                        : "#f59e0b",
                }}
              />
              {statusKase === "provjera"
                ? "Provjera kase..."
                : statusKase === "dostupna"
                  ? "Kasa dostupna"
                  : "Kasa nije dostupna"}
            </span>
          </div>
        </div>

        {/* Glavni sadržaj: lijevo artikli, desno sadržaj računa */}
        <div className="flex gap-3 mt-3 flex-1 min-h-0">
          {/* Lijevi panel — artikli */}
          <div className="relative w-[22%] flex-shrink-0 flex flex-col bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
            {jeRazniNeodabran && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/90 dark:bg-[#261f38]/90 px-4 text-center">
                <Users
                  size={22}
                  className="text-gray-300 dark:text-[#3a3158]"
                />
                <span className="text-xs text-gray-500 dark:text-[#7d7498]">
                  Izaberite kupca iz liste „Razni kupci" da biste mogli unositi
                  artikle
                </span>
                <button
                  onClick={() => setPokazuiModalRazni(true)}
                  className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: PRIMARY }}
                >
                  Izaberi kupca
                </button>
              </div>
            )}

            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-[#2d2648] flex items-center gap-1.5 flex-shrink-0">
              <Package size={13} style={{ color: PRIMARY }} />
              <span className="text-xs font-bold text-gray-700 dark:text-[#c5bfd8]">
                Artikli{!loadingArtikli && `(${filtriranihArtikli.length})`}
              </span>
              <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-full bg-gray-100 dark:bg-[#2a2340] flex-shrink-0">
                <button
                  onClick={() => setSamoNaStanju(false)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                    !samoNaStanju
                      ? "text-white"
                      : "text-gray-500 dark:text-[#7d7498] hover:text-gray-700 dark:hover:text-[#c5bfd8]"
                  }`}
                  style={!samoNaStanju ? { background: PRIMARY } : {}}
                >
                  Svi
                </button>
                <button
                  onClick={() => setSamoNaStanju(true)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                    samoNaStanju
                      ? "text-white"
                      : "text-gray-500 dark:text-[#7d7498] hover:text-gray-700 dark:hover:text-[#c5bfd8]"
                  }`}
                  style={samoNaStanju ? { background: PRIMARY } : {}}
                >
                  Na stanju
                </button>
              </div>
            </div>

            {/* Pretraga */}
            <div className="px-2 py-1.5 border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
              <div className="relative">
                <Search
                  size={11}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Pretraži artikle..."
                  value={pretragaArtikala}
                  onChange={(e) => setPretragaArtikala(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 dark:border-[#3a3158] rounded-lg bg-[#faf9fc] dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Grupe — horizontalni scroll */}
            {grupe.length > 0 && (
              <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0 scrollbar-none">
                <button
                  onClick={() => setOdabranaGrupa(null)}
                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                    odabranaGrupa === null
                      ? "text-white"
                      : "bg-gray-100 dark:bg-[#2a2340] text-gray-500 dark:text-[#7d7498] hover:bg-[#ede8f5] dark:hover:bg-[#2d2648]"
                  }`}
                  style={odabranaGrupa === null ? { background: PRIMARY } : {}}
                >
                  Sve
                </button>
                {grupe.map((g) => (
                  <button
                    key={g.sifra_grupe}
                    onClick={() =>
                      setOdabranaGrupa(
                        odabranaGrupa === String(g.sifra_grupe)
                          ? null
                          : String(g.sifra_grupe),
                      )
                    }
                    className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                      odabranaGrupa === String(g.sifra_grupe)
                        ? "text-white"
                        : "bg-gray-100 dark:bg-[#2a2340] text-gray-500 dark:text-[#7d7498] hover:bg-[#ede8f5] dark:hover:bg-[#2d2648]"
                    }`}
                    style={
                      odabranaGrupa === String(g.sifra_grupe)
                        ? { background: PRIMARY }
                        : {}
                    }
                  >
                    {g.naziv_grupe}
                  </button>
                ))}
              </div>
            )}

            {/* Header kolona */}
            <div className="flex items-center justify-between px-2.5 py-1 bg-[#f4f1f9] dark:bg-[#1e1a2d] border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                Naziv artikla
              </span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                MPC
              </span>
            </div>

            {/* Lista artikala */}
            <div className="flex-1 overflow-y-auto">
              {loadingArtikli ? (
                <div className="flex items-center justify-center py-8 gap-1.5 text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              ) : filtriranihArtikli.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-1 text-gray-400 dark:text-[#5f5878]">
                  <Package
                    size={20}
                    className="text-gray-300 dark:text-[#3a3158]"
                  />
                  <span className="text-[11px]">Nema artikala</span>
                </div>
              ) : (
                filtriranihArtikli.map((a) => {
                  const nemaStanje = Number(a.kolicina_proizvoda) <= 0;
                  const nivelacija = nivelacijeMap.get(
                    String(a.sifra_proizvoda),
                  );
                  return (
                    <div
                      key={a.sifra_proizvoda}
                      onClick={() => !nemaStanje && handleKlikArtikl(a)}
                      onContextMenu={(e) => {
                        if (!nemaStanje) {
                          e.preventDefault();
                          setArtikalZaNivelisanje(a);
                        }
                      }}
                      title={
                        nivelacija
                          ? `Privremena nivelacija — originalna cijena ${Number(nivelacija.cijena_bazna).toFixed(2)} KM, trenutno ${Number(nivelacija.cijena_trenutna).toFixed(2)} KM`
                          : undefined
                      }
                      className={`px-2.5 py-1.5 border-b border-gray-50 dark:border-[#2a2340] transition-colors ${
                        nemaStanje
                          ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-[#1c1828]"
                          : nivelacija
                            ? "bg-sky-50/70 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-950/50 cursor-pointer"
                            : "hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className="text-xs font-semibold leading-tight truncate"
                              style={{ color: PRIMARY }}
                            >
                              {a.naziv_proizvoda}
                            </span>
                            {nemaStanje && (
                              <Ban
                                size={10}
                                className="flex-shrink-0 text-red-400"
                              />
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878] mt-0.5">
                            {a.sifra_proizvoda} · {a.jm}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div
                            className="text-xs font-bold"
                            style={{ color: PRIMARY }}
                          >
                            {typeof a.mpc === "number"
                              ? a.mpc.toFixed(2)
                              : a.mpc}
                          </div>
                          {nivelacija && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500 text-white text-[9px] font-bold uppercase tracking-wide shadow-sm animate-pulse">
                              <Percent size={9} />
                              Nivel.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Desni panel — stavke računa */}
          <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
            {/* Lista stavki (header + redovi u istoj tabeli — garantovano poravnanje
                kolona, header je sticky unutar istog scroll kontejnera) — 2/3 visine */}
            <div className="relative overflow-y-auto" style={{ flex: 2 }}>
              {spremanjeLoading && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/90 dark:bg-[#1a1528]/90 backdrop-blur-sm">
                  <Loader2
                    size={32}
                    className="animate-spin"
                    style={{ color: PRIMARY }}
                  />
                  <div className="flex flex-col gap-1.5">
                    {KORACI_CUVANJA.map((naziv, i) => {
                      const korak = i + 1;
                      const zavrsen = korakCuvanja > korak;
                      const aktivan = korakCuvanja === korak;
                      return (
                        <div
                          key={korak}
                          className={`flex items-center gap-2 text-xs ${
                            aktivan
                              ? "font-bold"
                              : zavrsen
                                ? "text-gray-400 dark:text-[#5f5878]"
                                : "text-gray-300 dark:text-[#3a3158]"
                          }`}
                          style={aktivan ? { color: PRIMARY } : undefined}
                        >
                          {zavrsen ? (
                            <CheckCircle2
                              size={13}
                              className="text-emerald-500 flex-shrink-0"
                            />
                          ) : aktivan ? (
                            <Loader2
                              size={13}
                              className="animate-spin flex-shrink-0"
                            />
                          ) : (
                            <span className="w-[13px] h-[13px] rounded-full border border-gray-300 dark:border-[#3a3158] flex-shrink-0" />
                          )}
                          {korak}. {naziv}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d]">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]">
                      Naziv artikla
                    </th>
                    <th
                      style={{ width: "6ch", maxWidth: "6ch" }}
                      className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]"
                    >
                      JM
                    </th>
                    <th
                      style={{ width: "120px", maxWidth: "120px" }}
                      className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]"
                    >
                      Kol.
                    </th>
                    <th
                      style={{ width: "68px", maxWidth: "68px" }}
                      className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]"
                    >
                      MPC
                    </th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]">
                      Ukupno
                    </th>
                    {/* Prazna kolona — gura JM..Ukupno ulijevo (bliže nazivu artikla)
                        i drži dugme za brisanje skroz desno. */}
                    <th
                      style={{ width: "10px" }}
                      className="border-b border-gray-200 dark:border-[#2d2648]"
                    />
                    <th className="w-9 border-b border-gray-200 dark:border-[#2d2648]" />
                  </tr>
                </thead>
                <tbody>
                  {stavke.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-300 dark:text-[#3a3158]">
                          <Package size={28} />
                          <span className="text-sm">Nema stavki</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stavke.map((s, i) => (
                      <tr
                        key={s.sifra_proizvoda}
                        className={`border-b border-gray-50 dark:border-[#2a2340] ${i % 2 === 1 ? "bg-[#faf9fc] dark:bg-[#1e1a2d]" : ""}`}
                      >
                        <td className="px-3 pt-2 pb-1 min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: PRIMARY }}
                          >
                            {s.naziv_proizvoda}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                            {s.sifra_proizvoda}
                          </div>
                        </td>
                        <td
                          style={{ width: "6ch", maxWidth: "6ch" }}
                          className="px-1.5 pt-2 pb-1 text-center text-sm text-gray-500 dark:text-[#7d7498] whitespace-nowrap"
                        >
                          {s.jm}
                        </td>
                        <td
                          style={{ width: "120px", maxWidth: "120px" }}
                          className="px-3 pt-2 pb-1 text-right text-sm font-medium text-gray-700 dark:text-[#c5bfd8] whitespace-nowrap"
                        >
                          {s.kolicina.toFixed(3)}
                        </td>
                        <td
                          style={{ width: "68px", maxWidth: "68px" }}
                          className="px-3 pt-2 pb-1 text-right text-sm text-gray-700 dark:text-[#c5bfd8] whitespace-nowrap"
                        >
                          {s.mpc.toFixed(2)}
                        </td>
                        <td
                          className="px-3 pt-2 pb-1 text-right text-sm font-bold whitespace-nowrap"
                          style={{ color: PRIMARY }}
                        >
                          {s.ukupno.toFixed(2)}
                        </td>
                        <td />
                        <td className="px-2 pt-2 pb-1 text-center">
                          <button
                            onClick={() => handleUkloniStavku(s.sifra_proizvoda)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg transition-all hover:brightness-110"
                            style={{ background: PRIMARY }}
                            title="Ukloni stavku"
                          >
                            <Trash2 size={13} className="text-white" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Linija + ukupno — 1/3 visine */}
            <div
              className="border-t-2 border-gray-200 dark:border-[#2d2648] flex flex-col"
              style={{ flex: 1 }}
            >
              <div
                className="flex items-center justify-between px-6 gap-3"
                style={{ paddingTop: 10, paddingBottom: 10 }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-gray-400 dark:text-[#5f5878] font-semibold">
                    Broj stavki:{" "}
                    <span style={{ color: PRIMARY }}>{stavke.length}</span>
                  </span>
                  {stavke.length > 0 && (
                    <span className="text-[11px] italic text-gray-400 dark:text-[#5f5878]">
                      Slovima: {ukupnoRacunSlovima}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 dark:text-[#5f5878] font-semibold uppercase tracking-wide">
                      Ukupno za platiti
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: PRIMARY }}
                    >
                      {ukupnoRacun.toFixed(2)} KM
                    </span>
                  </div>
                  <button
                    onClick={() => handleSacuvajRacun(false)}
                    disabled={stavke.length === 0 || spremanjeLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
                    style={{ background: PRIMARY }}
                  >
                    {spremanjeLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Samo sačuvaj
                  </button>
                  <button
                    onClick={() => handleSacuvajRacun(true)}
                    disabled={stavke.length === 0 || spremanjeLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
                    style={{ background: ACCENT }}
                  >
                    {spremanjeLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Printer size={15} />
                    )}
                    Sačuvaj i štampaj
                  </button>
                  <label
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-[#7d7498] select-none cursor-pointer"
                    title="Kad je uključeno, A5 obrazac se šalje direktno na izabrani štampač, bez otvaranja prozora za štampu"
                  >
                    <input
                      type="checkbox"
                      checked={stampajDirektno}
                      onChange={(e) => setStampajDirektno(e.target.checked)}
                      className="accent-purple-600"
                    />
                    Direktno
                  </label>
                  <button
                    type="button"
                    onClick={() => setPokazuiEsirDebug(true)}
                    disabled={stavke.length === 0}
                    title="Prikaži tačan ESIR zahtjev (debug)"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye size={13} />
                    ESIR JSON
                  </button>
                </div>
              </div>
              {(spremanjeGreska ||
                spremanjeUpozorenje ||
                posljednjiBrojFiskalnog) && (
                <div className="px-6 pb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    {spremanjeGreska && (
                      <span className="text-xs font-medium text-red-500">
                        {spremanjeGreska}
                      </span>
                    )}
                    {spremanjeUpozorenje && (
                      <span className="text-xs font-medium text-amber-500">
                        {spremanjeUpozorenje}
                      </span>
                    )}
                  </div>
                  {posljednjiBrojFiskalnog && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-right flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPosljednjiBrojFiskalnog(null)}
                        title="Sakrij poruku"
                        className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 dark:text-[#7d7498]"
                      >
                        <X size={12} />
                      </button>
                      <span style={{ color: PRIMARY }}>
                        Fiskalni račun: {posljednjiBrojFiskalnog}
                      </span>
                    </span>
                  )}
                </div>
              )}
              <div className="border-t-2 border-gray-200 dark:border-[#2d2648]" />

              <div
                className="flex gap-3 px-4 flex-shrink-0"
                style={{ marginTop: 5 }}
              >
                {/* Prva trećina — istorija računa, samo za partnere različite od 300 (RAZNI KUPCI) */}
                <div className="w-1/3">
                  {odabraniPartner &&
                    odabraniPartner.sifra_partnera !== 300 && (
                      <>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <History size={11} style={{ color: PRIMARY }} />
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                            Poslednji računi partnera
                          </span>
                        </div>
                        {loadingIstorijaRacuna ? (
                          <div className="flex items-center gap-1.5 text-gray-400 text-[11px] py-1">
                            <Loader2 size={12} className="animate-spin" />
                            Učitavanje...
                          </div>
                        ) : istorijaRacuna.length === 0 ? (
                          <div className="text-[11px] text-gray-400 dark:text-[#5f5878] py-1">
                            Nema ranijih računa
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {istorijaRacuna.map((r) => (
                              <button
                                key={r.sifra_tabele}
                                onClick={() => handleKlikRacunIstorija(r)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#f4f1f9] dark:bg-[#1e1a2d] hover:bg-[#ede8f5] dark:hover:bg-[#2d2648] transition-all text-left"
                              >
                                <div
                                  className="text-[11px] font-bold truncate"
                                  style={{ color: PRIMARY }}
                                >
                                  {formatOznakaRacuna(r)}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                                  {formatDatumRacuna(r.datum_racuna)}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                </div>

                {/* Druga trećina — napomena */}
                <div className="w-1/3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <StickyNote size={11} style={{ color: PRIMARY }} />
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                      Napomena
                    </span>
                  </div>
                  <textarea
                    value={napomena}
                    onChange={(e) => setNapomena(e.target.value)}
                    placeholder="Unesite napomenu..."
                    rows={5}
                    className="w-full px-2 py-1 text-[11px] border border-gray-200 dark:border-[#3a3158] rounded-lg bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878] focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 resize-none"
                  />
                </div>

                {/* Treća trećina — podgrupa računa */}
                <div className="w-1/3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Tag size={11} style={{ color: PRIMARY }} />
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                      Podgrupa računa
                    </span>
                  </div>
                  <select
                    value={odabranaPodgrupa?.sifra_podgrupe ?? ""}
                    onChange={(e) => {
                      const podgrupa =
                        podgrupeRacuna.find(
                          (p) => String(p.sifra_podgrupe) === e.target.value,
                        ) ?? null;
                      setOdabranaPodgrupa(podgrupa);
                    }}
                    disabled={loadingPodgrupeRacuna}
                    className="w-full px-2 py-1.5 text-[11px] border border-gray-200 dark:border-[#3a3158] rounded-lg bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20"
                  >
                    {podgrupeRacuna.length === 0 && (
                      <option value="">
                        {loadingPodgrupeRacuna
                          ? "Učitavanje..."
                          : "Nema podgrupa"}
                      </option>
                    )}
                    {podgrupeRacuna.map((p) => (
                      <option key={p.sifra_podgrupe} value={p.sifra_podgrupe}>
                        {p.opis_podgrupe} ({p.sifra_podgrupe})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleOtvoriModalNarudzbe}
                    disabled={odabraniTeren === null}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
                    style={{ background: ACCENT }}
                  >
                    <ClipboardCheck size={12} />
                    Završene narudžbe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* kraj flex-col wrapper */}

      {/* Modal nivelisanje cijena */}
      {artikalZaNivelisanje &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setArtikalZaNivelisanje(null);
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[576px] overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ background: PRIMARY }}
              >
                <Package size={18} className="text-white flex-shrink-0" />
                <span className="font-bold text-white text-base truncate">
                  {artikalZaNivelisanje.naziv_proizvoda}
                </span>
                <span className="ml-auto flex-shrink-0 px-2 py-0.5 rounded-lg bg-white/20 text-white text-xs font-semibold">
                  {artikalZaNivelisanje.jm}
                </span>
              </div>
              {(() => {
                const jeVecIzabran = stavke.some(
                  (s) =>
                    s.sifra_proizvoda === artikalZaNivelisanje.sifra_proizvoda,
                );
                return (
                  <>
                    <div className="px-6 py-5 space-y-4">
                      {jeVecIzabran ? (
                        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3">
                          <Ban
                            size={16}
                            className="text-red-500 flex-shrink-0 mt-0.5"
                          />
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Ovaj proizvod je već dodan kao stavka na računu.
                            Nivelisanje cijena nije moguće izvršiti dok se
                            stavka ne ukloni iz liste.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                          Da li želite da izvršite{" "}
                          <span
                            className="font-semibold"
                            style={{ color: PRIMARY }}
                          >
                            nivelisanje cijena
                          </span>{" "}
                          za navedeni proizvod?
                        </p>
                      )}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">
                            Šifra
                          </div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">
                            {artikalZaNivelisanje.sifra_proizvoda}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">
                            VPC
                          </div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">
                            {typeof artikalZaNivelisanje.vpc === "number"
                              ? artikalZaNivelisanje.vpc.toFixed(2)
                              : artikalZaNivelisanje.vpc}{" "}
                            KM
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">
                            MPC
                          </div>
                          <div
                            className="text-sm font-bold"
                            style={{ color: PRIMARY }}
                          >
                            {typeof artikalZaNivelisanje.mpc === "number"
                              ? artikalZaNivelisanje.mpc.toFixed(2)
                              : artikalZaNivelisanje.mpc}{" "}
                            KM
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">
                            Količina
                          </div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">
                            {Number(
                              artikalZaNivelisanje.kolicina_proizvoda,
                            ).toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 px-6 pb-5">
                      {jeVecIzabran ? (
                        <button
                          onClick={() => setArtikalZaNivelisanje(null)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                          style={{ background: PRIMARY }}
                        >
                          Razumijem
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setArtikalZaNivelisanje(null)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                          >
                            Ne
                          </button>
                          <button
                            onClick={() => {
                              const vpc =
                                typeof artikalZaNivelisanje.vpc === "number"
                                  ? artikalZaNivelisanje.vpc
                                  : parseFloat(
                                      String(artikalZaNivelisanje.vpc),
                                    ) || 0;
                              const mpc =
                                typeof artikalZaNivelisanje.mpc === "number"
                                  ? artikalZaNivelisanje.mpc
                                  : parseFloat(
                                      String(artikalZaNivelisanje.mpc),
                                    ) || 0;
                              setNovaVpc(vpc.toFixed(2));
                              setNovaMpc(mpc.toFixed(2));
                              setNivelacijaGreska(null);
                              setArtikalZaCijenu(artikalZaNivelisanje);
                              setArtikalZaNivelisanje(null);
                            }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                            style={{ background: ACCENT }}
                          >
                            Da
                          </button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body,
        )}

      {/* Modal unos cijena — nivelisanje */}
      {artikalZaCijenu &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setArtikalZaCijenu(null);
                setNovaVpc("");
                setNovaMpc("");
              }
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[576px] overflow-hidden">
              {/* Header */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ background: PRIMARY }}
              >
                <Package size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    {artikalZaCijenu.naziv_proizvoda}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Šifra: {artikalZaCijenu.sifra_proizvoda} · Kol:{" "}
                    {Number(artikalZaCijenu.kolicina_proizvoda).toFixed(3)}{" "}
                    {artikalZaCijenu.jm}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-gray-500 dark:text-[#7d7498]">
                  Unesite novu{" "}
                  <b className="text-gray-700 dark:text-[#c5bfd8]">VPC</b> ili{" "}
                  <b className="text-gray-700 dark:text-[#c5bfd8]">MPC</b> —
                  druga cijena se računa automatski{" "}
                  <span className="text-xs">(VPC × 1.17 = MPC)</span>.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* VPC */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                      VPC (KM)
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        trenutno:{" "}
                        {typeof artikalZaCijenu.vpc === "number"
                          ? artikalZaCijenu.vpc.toFixed(2)
                          : artikalZaCijenu.vpc}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={novaVpc}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNovaVpc(val);
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0)
                          setNovaMpc(
                            (Math.round(num * 1.17 * 100) / 100).toFixed(2),
                          );
                        else setNovaMpc("");
                      }}
                      autoFocus
                      className={inputClass}
                    />
                  </div>

                  {/* MPC */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                      MPC (KM)
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        trenutno:{" "}
                        {typeof artikalZaCijenu.mpc === "number"
                          ? artikalZaCijenu.mpc.toFixed(2)
                          : artikalZaCijenu.mpc}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={novaMpc}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNovaMpc(val);
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0)
                          setNovaVpc(
                            (Math.round((num / 1.17) * 100) / 100).toFixed(2),
                          );
                        else setNovaVpc("");
                      }}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Preview + razlike */}
                {novaVpc &&
                  novaMpc &&
                  parseFloat(novaVpc) > 0 &&
                  (() => {
                    const kol = Number(artikalZaCijenu.kolicina_proizvoda) || 0;
                    const staraVpc =
                      typeof artikalZaCijenu.vpc === "number"
                        ? artikalZaCijenu.vpc
                        : parseFloat(String(artikalZaCijenu.vpc)) || 0;
                    const staraMpc =
                      typeof artikalZaCijenu.mpc === "number"
                        ? artikalZaCijenu.mpc
                        : parseFloat(String(artikalZaCijenu.mpc)) || 0;
                    const nVpc = parseFloat(novaVpc) || 0;
                    const nMpc = parseFloat(novaMpc) || 0;
                    const difVpcFin = (nVpc - staraVpc) * kol;
                    const difMpcFin = (nMpc - staraMpc) * kol;
                    const difVpcPct =
                      staraVpc !== 0 ? ((nVpc - staraVpc) / staraVpc) * 100 : 0;
                    const difMpcPct =
                      staraMpc !== 0 ? ((nMpc - staraMpc) / staraMpc) * 100 : 0;
                    const clr = (v: number) =>
                      v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : undefined;
                    const fmt = (v: number) =>
                      (v >= 0 ? "+" : "") + v.toFixed(2);
                    const fmtPct = (v: number) =>
                      (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3 text-sm">
                          <span className="text-gray-500 dark:text-[#7d7498]">
                            Nova VPC:{" "}
                            <b className="text-gray-700 dark:text-[#c5bfd8]">
                              {novaVpc} KM
                            </b>
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-500 dark:text-[#7d7498]">
                            Nova MPC:{" "}
                            <b style={{ color: PRIMARY }}>{novaMpc} KM</b>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-4 py-2.5 space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold">
                              VPC razlika
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className="text-sm font-bold"
                                style={{ color: clr(difVpcFin) }}
                              >
                                {fmt(difVpcFin)} KM
                              </span>
                              <span
                                className="text-xs font-semibold"
                                style={{ color: clr(difVpcPct) }}
                              >
                                {fmtPct(difVpcPct)}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                              {kol.toFixed(3)} × {fmt(nVpc - staraVpc)} KM
                            </div>
                          </div>
                          <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-4 py-2.5 space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold">
                              MPC razlika
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className="text-sm font-bold"
                                style={{ color: clr(difMpcFin) }}
                              >
                                {fmt(difMpcFin)} KM
                              </span>
                              <span
                                className="text-xs font-semibold"
                                style={{ color: clr(difMpcPct) }}
                              >
                                {fmtPct(difMpcPct)}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                              {kol.toFixed(3)} × {fmt(nMpc - staraMpc)} KM
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {nivelacijaGreska && (
                  <div className="text-xs font-medium text-red-500">
                    {nivelacijaGreska}
                  </div>
                )}
              </div>

              <div className="flex gap-3 px-6 pb-5">
                <button
                  onClick={() => {
                    setArtikalZaCijenu(null);
                    setNovaVpc("");
                    setNovaMpc("");
                    setNivelacijaGreska(null);
                  }}
                  disabled={nivelacijaLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40"
                >
                  Odustani
                </button>
                <button
                  disabled={
                    !novaVpc ||
                    !novaMpc ||
                    parseFloat(novaVpc) <= 0 ||
                    nivelacijaLoading
                  }
                  onClick={handleSacuvajNivelaciju}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  {nivelacijaLoading && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal unos količine */}
      {artikalZaUnos &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setArtikalZaUnos(null);
                setKolicina("");
              }
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[540px] overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]"
                style={{ background: PRIMARY }}
              >
                <Package size={18} className="text-white flex-shrink-0" />
                <span className="font-bold text-white text-base truncate">
                  {artikalZaUnos.naziv_proizvoda}
                </span>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex justify-between text-sm text-gray-500 dark:text-[#7d7498]">
                  <span>
                    Šifra:{" "}
                    <b className="text-gray-700 dark:text-[#c5bfd8]">
                      {artikalZaUnos.sifra_proizvoda}
                    </b>
                  </span>
                  <span>
                    MPC:{" "}
                    <b style={{ color: PRIMARY }}>
                      {typeof artikalZaUnos.mpc === "number"
                        ? artikalZaUnos.mpc.toFixed(2)
                        : artikalZaUnos.mpc}{" "}
                      KM
                    </b>
                  </span>
                  <span>
                    JM:{" "}
                    <b className="text-gray-700 dark:text-[#c5bfd8]">
                      {artikalZaUnos.jm}
                    </b>
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                    Količina ({artikalZaUnos.jm})
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={kolicina}
                    onChange={(e) => {
                      const val = e.target.value;
                      const decimale = val.split(".")[1];
                      if (decimale && decimale.length > 3) return;
                      setKolicina(val);
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handlePotvrdiStavku()
                    }
                    autoFocus
                    className={inputClass}
                  />
                </div>
                {kolicina && parseFloat(kolicina.replace(",", ".")) > 0 && (
                  <div className="flex justify-between text-sm rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                    <span className="text-gray-500 dark:text-[#7d7498]">
                      Ukupno
                    </span>
                    <span
                      className="font-bold text-base"
                      style={{ color: PRIMARY }}
                    >
                      {(
                        parseFloat(kolicina.replace(",", ".")) *
                        (typeof artikalZaUnos.mpc === "number"
                          ? artikalZaUnos.mpc
                          : parseFloat(String(artikalZaUnos.mpc)) || 0)
                      ).toFixed(2)}{" "}
                      KM
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-5 pb-4">
                <button
                  onClick={() => {
                    setArtikalZaUnos(null);
                    setKolicina("");
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                >
                  Odustani
                </button>
                <button
                  onClick={handlePotvrdiStavku}
                  disabled={
                    !kolicina || parseFloat(kolicina.replace(",", ".")) <= 0
                  }
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  Dodaj
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal izbora "razni kupac" — blokirajući, obavezan kad je izabran partner 300 */}
      {pokaziModalRazni &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <Users size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    {prikaziNoviRazniForm ? "Novi razni kupac" : "Razni kupci"}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {prikaziNoviRazniForm
                      ? "Unesite podatke za novog kupca"
                      : "Izaberite kupca da biste mogli nastaviti unos artikala"}
                  </div>
                </div>
              </div>

              {prikaziNoviRazniForm ? (
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                        Naziv kupca
                      </label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Unesite naziv kupca..."
                        value={noviRazniNaziv}
                        onChange={(e) => setNoviRazniNaziv(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                        Grad
                      </label>
                      <select
                        value={noviRazniSifraGrada}
                        onChange={(e) => setNoviRazniSifraGrada(e.target.value)}
                        disabled={loadingGradovi}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingGradovi ? "Učitavanje..." : "Izaberite grad"}
                        </option>
                        {gradovi.map((g) => (
                          <option key={g.sifra_grada} value={g.sifra_grada}>
                            {g.naziv_grada}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                        Radnik
                      </label>
                      <select
                        value={noviRazniSifraRadnika}
                        onChange={(e) =>
                          setNoviRazniSifraRadnika(e.target.value)
                        }
                        disabled={loadingRadnici}
                        className={inputClass}
                      >
                        <option value="">
                          {loadingRadnici
                            ? "Učitavanje..."
                            : "Izaberite radnika"}
                        </option>
                        {radniciZaIzbor.map((r) => (
                          <option key={r.sifra_radnika} value={r.sifra_radnika}>
                            {r.naziv_radnika}
                          </option>
                        ))}
                      </select>
                    </div>
                    {dodajRazniGreska && (
                      <div className="text-xs font-medium text-red-500">
                        {dodajRazniGreska}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                    <button
                      onClick={handleZatvoriNoviRazniForm}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                    >
                      Nazad
                    </button>
                    <button
                      onClick={handleSacuvajNovogRaznog}
                      disabled={
                        dodajRazniLoading ||
                        !noviRazniNaziv.trim() ||
                        !noviRazniSifraGrada ||
                        !noviRazniSifraRadnika
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                      style={{ background: ACCENT }}
                    >
                      {dodajRazniLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      Sačuvaj
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Pretraži kupca..."
                        value={pretragaRazni}
                        onChange={(e) => setPretragaRazni(e.target.value)}
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {loadingPartneriRazni ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">Učitavanje...</span>
                      </div>
                    ) : filtriraniRazni.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-gray-400 dark:text-[#5f5878]">
                        <Users
                          size={22}
                          className="text-gray-300 dark:text-[#3a3158]"
                        />
                        <span className="text-xs">Nema rezultata</span>
                      </div>
                    ) : (
                      filtriraniRazni.map((p) => {
                        const jeNoviKupac = p.sifra_partnera >= 10000;
                        return (
                          <button
                            key={p.sifra_partnera}
                            onClick={() => handleOdabirRazni(p)}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all border-b border-gray-50 dark:border-[#2a2340] last:border-b-0 ${
                              jeNoviKupac
                                ? "bg-amber-50/70 dark:bg-[#3a2f1a]/40 hover:bg-amber-100 dark:hover:bg-[#3a2f1a]/70"
                                : "hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                                jeNoviKupac
                                  ? "bg-amber-100 dark:bg-[#4a3a1f]"
                                  : "bg-[#ede8f5] dark:bg-[#312a50]"
                              }`}
                            >
                              {jeNoviKupac ? (
                                <UserPlus
                                  size={12}
                                  className="text-amber-600 dark:text-amber-400"
                                />
                              ) : (
                                <User size={12} style={{ color: PRIMARY }} />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-[#ede9f6] truncate flex-1">
                              {p.naziv_partnera}
                            </span>
                            {jeNoviKupac && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-[#4a3a1f] text-amber-700 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wide">
                                Novi
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                    <button
                      onClick={() => {
                        setPokazuiModalRazni(false);
                        setPretragaRazni("");
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                    >
                      Odustani
                    </button>
                    <button
                      onClick={handleOtvoriNoviRazniForm}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                      style={{ background: ACCENT }}
                    >
                      <UserPlus size={14} />
                      Novi kupac
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Modal pregleda partnera — full screen */}
      {pokaziModal &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#1a1528]">
            {/* Header */}
            <div
              className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
              style={{ background: PRIMARY }}
            >
              <Users size={18} className="text-white flex-shrink-0" />
              <span className="font-bold text-white text-base whitespace-nowrap">
                Pregled partnera
              </span>
              <span className="text-white/60 text-sm whitespace-nowrap">
                ({modalRezultati.length})
              </span>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  placeholder="Pretraži po nazivu, JIB-u, gradu..."
                  value={pretragaModal}
                  onChange={(e) => setPretragaModal(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-white/15 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:bg-white/20"
                />
              </div>
              <button
                onClick={() => {
                  setPokazuiModal(false);
                  setPretragaModal("");
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full gap-3 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Učitavanje...</span>
                </div>
              ) : modalRezultati.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-[#5f5878]">
                  <User size={32} />
                  <span className="text-sm">Nema rezultata</span>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-12">
                        ID
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">
                        Naziv partnera
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">
                        JIB
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">
                        PIB
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">
                        Mat. broj
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">
                        Adresa
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-32">
                        Grad
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-14">
                        PTT
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">
                        Entitet
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">
                        Država
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">
                        Valuta
                      </th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">
                        Radnik
                      </th>
                      <th className="text-center px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-10">
                        Lok.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRezultati.map((p, i) => (
                      <tr
                        key={p.sifra_partnera}
                        onClick={() => {
                          korisnickiOdabirPartneraRef.current = true;
                          setOdabraniPartner(p);
                          setPokazuiModal(false);
                          setPretragaModal("");
                          // Nova selekcija partnera — poruka o fiskalnom broju sa
                          // prethodnog računa više nije relevantna.
                          setPosljednjiBrojFiskalnog(null);
                        }}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#2a2340] transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#2d2648] ${
                          i % 2 === 0
                            ? "bg-white dark:bg-[#1a1528]"
                            : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                        } ${odabraniPartner?.sifra_partnera === p.sifra_partnera ? "!bg-[#e0d9f0] dark:!bg-[#2d2648] font-semibold" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-gray-500 dark:text-[#7d7498] font-mono">
                          {p.sifra_partnera}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-[#ede9f6] max-w-[200px]">
                          <div className="truncate">{p.naziv_partnera}</div>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">
                          {p.jib || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">
                          {p.pib || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">
                          {p.maticni_broj || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] max-w-[160px]">
                          <div className="truncate">
                            {p.adresa_partnera || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                          {p.naziv_grada || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                          {p.ptt || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                          {p.entitet || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                          {p.naziv_drzave || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                          {p.dogovorena_valuta || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] max-w-[130px]">
                          <div className="truncate">
                            {p.naziv_radnika || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {p.dodatna_lokacija && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white"
                              style={{ background: ACCENT }}
                              title={
                                p.dodatna_lokacija.naziv_lokacije ??
                                p.dodatna_lokacija.Naziv_grada ??
                                "Dodatna lokacija"
                              }
                            >
                              <MapPin size={9} />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Modal stavki ranijeg računa (iz istorije) */}
      {pokaziModalStavkiRacuna &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPokazuiModalStavkiRacuna(false);
                setOdabraniRacunIstorija(null);
              }
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border-2 w-[850px] max-h-[80vh] flex flex-col overflow-hidden"
              style={{ borderColor: ACCENT }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <History size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    {odabraniRacunIstorija
                      ? formatOznakaRacuna(odabraniRacunIstorija)
                      : "Stavke računa"}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabraniRacunIstorija &&
                      formatDatumRacuna(odabraniRacunIstorija.datum_racuna)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPokazuiModalStavkiRacuna(false);
                    setOdabraniRacunIstorija(null);
                  }}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {loadingStavkeIstorijeRacuna ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Učitavanje...</span>
                  </div>
                ) : stavkeIstorijeRacuna.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 dark:text-[#5f5878]">
                    <Package
                      size={24}
                      className="text-gray-300 dark:text-[#3a3158]"
                    />
                    <span className="text-sm">Nema stavki za ovaj račun</span>
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">
                          Šifra
                        </th>
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">
                          Naziv proizvoda
                        </th>
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-14">
                          JM
                        </th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-20">
                          Količina
                        </th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">
                          Cij. sa rab.
                        </th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">
                          Prod. cijena
                        </th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">
                          VPC vrijed.
                        </th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">
                          Prod. vrijed.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stavkeIstorijeRacuna.map((s, i) => (
                        <tr
                          key={`${s.sifra_proizvoda}-${i}`}
                          className={`border-b border-gray-100 dark:border-[#2a2340] ${i % 2 === 0 ? "bg-white dark:bg-[#1a1528]" : "bg-[#faf9fc] dark:bg-[#1e1a2d]"}`}
                        >
                          <td className="px-3 py-1.5 text-gray-500 dark:text-[#7d7498] font-mono">
                            {s.sifra_proizvoda}
                          </td>
                          <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-[#ede9f6]">
                            {s.naziv_proizvoda}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                            {s.jm}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">
                            {Number(s.kolicina).toFixed(3)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">
                            {Number(s.cijena_sa_rab).toFixed(2)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">
                            {Number(s.prodajna_cijena).toFixed(2)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">
                            {Number(s.vpc_vrednost).toFixed(2)}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right font-semibold"
                            style={{ color: PRIMARY }}
                          >
                            {Number(s.prodajna_vrednost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal završenih narudžbi — spremne za pretvaranje u račun (svi proizvodi verifikovano=2) */}
      {pokaziModalNarudzbe &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setPokazuiModalNarudzbe(false);
                setOdabraniKupacNarudzbe(null);
              }
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <ClipboardCheck
                  size={18}
                  className="text-white flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Završene narudžbe
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabraniTeren
                      ? `Teren: ${odabraniTeren.naziv_dana}`
                      : "Izaberite teren da biste vidjeli narudžbe"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPokazuiModalNarudzbe(false);
                    setOdabraniKupacNarudzbe(null);
                  }}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingNarudzbe ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Učitavanje...</span>
                  </div>
                ) : !odabraniTeren ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 dark:text-[#5f5878]">
                    <ClipboardCheck
                      size={24}
                      className="text-gray-300 dark:text-[#3a3158]"
                    />
                    <span className="text-sm">Prvo izaberite teren</span>
                  </div>
                ) : zavrseneNarudzbe.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 dark:text-[#5f5878]">
                    <ClipboardCheck
                      size={24}
                      className="text-gray-300 dark:text-[#3a3158]"
                    />
                    <span className="text-sm">
                      Nema završenih narudžbi za ovaj teren
                    </span>
                  </div>
                ) : (
                  zavrseneNarudzbe.map((k) => {
                    const vecUneseno = k.stampano !== 0;
                    const prosireno =
                      odabraniKupacNarudzbe?.sifra_kupca === k.sifra_kupca;
                    return (
                      <div
                        key={k.sifra_kupca}
                        className="border-b border-gray-50 dark:border-[#2a2340] last:border-b-0"
                      >
                        <button
                          onClick={() => {
                            if (!vecUneseno)
                              setOdabraniKupacNarudzbe(prosireno ? null : k);
                          }}
                          disabled={vecUneseno}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all ${
                            vecUneseno
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                            style={{
                              background:
                                k.sifra_kupca >= 10000 ? ACCENT : PRIMARY,
                            }}
                          >
                            <User
                              size={12}
                              style={{
                                color:
                                  k.sifra_kupca >= 10000 ? PRIMARY : ACCENT,
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-800 dark:text-[#ede9f6] truncate">
                              {k.naziv_kupca}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                              Šifra: {k.sifra_kupca} · {k.proizvodi.length}{" "}
                              {k.proizvodi.length === 1
                                ? "proizvod"
                                : "proizvoda"}
                              {k.nacin_placanja && ` · ${k.nacin_placanja}`}
                            </div>
                          </div>
                          {vecUneseno ? (
                            <span className="flex items-center gap-1 flex-shrink-0 text-[10px] font-semibold text-gray-400 dark:text-[#5f5878]">
                              <Lock size={12} />
                              Već uneseno
                            </span>
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUvezNarudzbu(k);
                              }}
                              className="flex-shrink-0 p-1 -m-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                              title="Uvezi u račun"
                            >
                              <Download size={14} style={{ color: PRIMARY }} />
                            </span>
                          )}
                        </button>

                        {prosireno && (
                          <div className="bg-[#faf9fc] dark:bg-[#1e1a2d] px-4 py-2">
                            {k.proizvodi.length === 0 ? (
                              <div className="flex items-center justify-center gap-1.5 py-4 text-gray-400 dark:text-[#5f5878]">
                                <Package
                                  size={16}
                                  className="text-gray-300 dark:text-[#3a3158]"
                                />
                                <span className="text-xs">Nema proizvoda</span>
                              </div>
                            ) : (
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="text-gray-500 dark:text-[#7d7498]">
                                    <th className="text-left px-2 py-1.5 font-semibold border-b border-gray-200 dark:border-[#2d2648]">
                                      Naziv proizvoda
                                    </th>
                                    <th className="text-left px-2 py-1.5 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-14">
                                      JM
                                    </th>
                                    <th className="text-right px-2 py-1.5 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-20">
                                      Količina
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {k.proizvodi.map((p, i) => (
                                    <tr
                                      key={`${p.sifra_proizvoda}-${i}`}
                                      className={`border-b border-gray-100 dark:border-[#2a2340] last:border-b-0 ${i % 2 === 0 ? "bg-white dark:bg-[#1a1528]" : "bg-[#faf9fc] dark:bg-[#1e1a2d]"}`}
                                    >
                                      <td className="px-2 py-1.5 font-medium text-gray-800 dark:text-[#ede9f6]">
                                        {p.naziv_proizvoda}
                                        {p.napomena && (
                                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                                            {p.napomena}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5 text-gray-600 dark:text-[#c5bfd8]">
                                        {p.jm}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-semibold text-gray-700 dark:text-[#c5bfd8]">
                                        {p.kolicina.toFixed(3)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <button
                              onClick={() => handleUvezNarudzbu(k)}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                              style={{ background: ACCENT }}
                            >
                              <Download size={12} />
                              Uvezi u račun
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Privremeno (debug) — tačan zahtjev koji ide ka ESIR-u (esirFetch). */}
      {pokaziEsirDebug &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPokazuiEsirDebug(false);
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <Eye size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    ESIR zahtjev (debug)
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Tačno ono što esirFetch šalje ka uređaju
                  </div>
                </div>
                <button
                  onClick={() => setPokazuiEsirDebug(false)}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-4">
                {(() => {
                  const baseUrl =
                    import.meta.env.VITE_ESIR_URL_GOTOVINSKI ||
                    "http://127.0.0.1:3566";
                  const apiKey =
                    import.meta.env.VITE_ESIR_API_KEY_GOTOVINSKI || "";
                  const bodyObj = {
                    ...esirOpcijeStampe,
                    invoiceRequest: pripremiEsirZahtjev(),
                  };
                  const bodyText = JSON.stringify(bodyObj, null, 2);
                  return (
                    <>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878] mb-1">
                          Method + URL
                        </div>
                        <div className="text-xs font-mono bg-gray-50 dark:bg-[#1e1a2d] border border-gray-200 dark:border-[#3a3158] rounded-lg px-3 py-2 text-gray-700 dark:text-[#c5bfd8] break-all">
                          POST {baseUrl}/api/invoices
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878] mb-1">
                          Headers
                        </div>
                        <div className="text-xs font-mono bg-gray-50 dark:bg-[#1e1a2d] border border-gray-200 dark:border-[#3a3158] rounded-lg px-3 py-2 text-gray-700 dark:text-[#c5bfd8] break-all space-y-1">
                          <div>Authorization: Bearer {apiKey}</div>
                          <div>Content-Type: application/json; charset=UTF-8</div>
                          <div>
                            RequestId: (kod stvarnog čuvanja = sifra_tabele
                            računa; ovdje, prije čuvanja, generiše se nasumičan
                            UUID)
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#5f5878]">
                            Body
                          </div>
                          <button
                            onClick={() =>
                              navigator.clipboard?.writeText(bodyText)
                            }
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-gray-200 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                          >
                            Kopiraj
                          </button>
                        </div>
                        <pre className="text-[11px] font-mono bg-gray-50 dark:bg-[#1e1a2d] border border-gray-200 dark:border-[#3a3158] rounded-lg px-3 py-2 text-gray-700 dark:text-[#c5bfd8] whitespace-pre-wrap break-all">
                          {bodyText}
                        </pre>
                      </div>

                      <div>
                        <button
                          onClick={async () => {
                            setEsirDebugSalje(true);
                            setEsirDebugOdgovor(null);
                            try {
                              const odgovor = await posaljiEsirDebugZahtjev(
                                "gotovinski",
                                bodyObj.invoiceRequest,
                                esirOpcijeStampe,
                              );
                              let tekst = odgovor.rawText;
                              try {
                                tekst = JSON.stringify(
                                  JSON.parse(odgovor.rawText),
                                  null,
                                  2,
                                );
                              } catch {
                                // Nije JSON — ostavi sirov tekst (npr. HTML greška).
                              }
                              setEsirDebugOdgovor({
                                ok: odgovor.ok,
                                status: odgovor.status,
                                tekst,
                              });
                            } catch (err) {
                              setEsirDebugOdgovor({
                                ok: false,
                                status: 0,
                                tekst:
                                  err instanceof Error
                                    ? err.message
                                    : String(err),
                              });
                            } finally {
                              setEsirDebugSalje(false);
                            }
                          }}
                          disabled={esirDebugSalje}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: ACCENT }}
                        >
                          {esirDebugSalje ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Eye size={15} />
                          )}
                          {esirDebugSalje
                            ? "Šaljem ka ESIR uređaju..."
                            : "Pošalji test ka ESIR-u i prikaži odgovor"}
                        </button>
                        <p className="text-[10px] text-gray-400 dark:text-[#5f5878] mt-1.5">
                          Ovo stvarno šalje zahtjev na uređaj (isti kao gore) —
                          identično Postman testu.
                        </p>
                      </div>

                      {esirDebugOdgovor && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`text-[10px] font-bold uppercase tracking-widest ${
                                esirDebugOdgovor.ok
                                  ? "text-emerald-500"
                                  : "text-red-500"
                              }`}
                            >
                              Odgovor uređaja — HTTP {esirDebugOdgovor.status || "?"}{" "}
                              ({esirDebugOdgovor.ok ? "OK" : "GREŠKA"})
                            </div>
                            <button
                              onClick={() =>
                                navigator.clipboard?.writeText(
                                  esirDebugOdgovor.tekst,
                                )
                              }
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-gray-200 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                            >
                              Kopiraj
                            </button>
                          </div>
                          <pre
                            className={`text-[11px] font-mono border rounded-lg px-3 py-2 whitespace-pre-wrap break-all ${
                              esirDebugOdgovor.ok
                                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200"
                                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200"
                            }`}
                          >
                            {esirDebugOdgovor.tekst}
                          </pre>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
