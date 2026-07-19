import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Ban,
  CheckCircle2,
  RotateCcw,
  ClipboardCheck,
  Download,
  Eye,
  History,
  Loader2,
  Lock,
  MapPin,
  Package,
  Pencil,
  Percent,
  Printer,
  Search,
  StickyNote,
  Tag,
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
  ESIR_OZNAKA_SA_PDV,
  ESIR_OZNAKA_BEZ_PDV,
  ESIR_SLIP_PRESET_58MM,
  type EsirStavka,
  type EsirPlacanje,
  type EsirInvoiceRequest,
  type EsirOpcijeStampe,
  type EsirInvoiceResponse,
} from "./fiskalniRacuni";
import { getCurrentUser } from "../utils/auth";
import { brojUSlovima } from "../utils/brojUSlovima";
import { usePrint } from "../context/PrintContext";
import { RacunA4 } from "../print/templates/RacunA4";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const STOPA_PDV = 0.17;
const VRSTA_RACUNA = "z";
const VRSTA_RACUNA_NOVI = 2;

// Koraci procesa čuvanja računa (redoslijed prati handleSacuvajRacun) — indeks
// u nizu + 1 = vrijednost koju drži korakCuvanja state dok je taj korak aktivan.
const KORACI_CUVANJA = [
  "Unos podataka za račun",
  "Dobijanje šifre tabele",
  "Ažuriranje dostave",
  "Slanje ka ESIR-u",
  "Prihvat JSON-a od ESIR-a",
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 transition-all text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878] bg-white dark:bg-[#1e1a2d]";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDatumIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatVremeIso = (d: Date) =>
  `${formatDatumIso(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
// Format naziva fajla za ESIR debug dump: yyyy-MM-dd_HH_mm_ss (šifra tabele se
// dodaje posebno, vidi sacuvajEsirGreskuJson).
const formatDatumZaNazivFajla = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}_${pad2(d.getMinutes())}_${pad2(d.getSeconds())}`;

interface DodatnaLokacija {
  sifra_partnera: number;
  naziv_lokacije?: string;
  adresa_lokacije?: string;
  naziv_grada?: string;
  JIB?: string;
  [key: string]: unknown;
}

interface Artikal {
  sifra_proizvoda: string;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  nabavna_cijena: number | string;
  barkod?: string;
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

interface RacunPodgrupa {
  sifra_podgrupe: number;
  opis_podgrupe: string;
  // 0 = normalno (PDV se obračunava), 1 = računi u ovoj podgrupi idu bez PDV-a
  // (ESIR-u se šalje osnova bez PDV-a, oznaka stavke "К" umjesto "Е").
  obracunava_se_pdv: number;
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
  vpc: number;
  vpc1: number;
  rab1: number;
  vpc2: number;
  rab2: number;
  vpc3: number;
  rab3: number;
  // Osnova — konačna cijena nakon kaskade rabata (= VPC3, koji uvijek prati VPC2/VPC1/VPC
  // ako neki od nivoa nije dirnut). Koristi se za obračun vrijednosti i PDV-a.
  osnova: number;
  vrednost: number;
  pdv: number;
  ukupno: number;
  nabavna_cijena: number;
  barkod: string;
  // Da li je PDV obračunat na ovu stavku — preuzeto od izabrane podgrupe u
  // trenutku dodavanja (RacunPodgrupa.obracunava_se_pdv). Kad je false, pdv je
  // uvijek 0 i ESIR-u se šalje oznaka "К" (bez PDV-a) umjesto "Е".
  obracunava_se_pdv: boolean;
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

// Red pomoćne tabele (stavke) žiralnog računa — priprema za slanje kroz proceduru
// erp.sp_racuni_unos. Za razliku od gotovinskog, ovdje se stvarno koriste rabatni
// nivoi (rabat_proc/rabat_proc_2/rabat_proc_3) unešeni kroz VPC1/VPC2/VPC3.
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
  vpc_sa_rabat_2: number;
  rabat_proc_3: number;
  rabat_km_3: number;
  vpc_rabat_1: number;
  pdv_po_artiklu: number;
  nabavna_cijena_proizvoda: number;
}

// Heder (glavna tabela) žiralnog računa.
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

export function ZiralniRacuni() {
  const { openPrint, printDirectly, selectedPrinter } = usePrint();
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [odabraniPartner, setOdabraniPartner] = useState<Partner | null>(null);

  const [pretraga, setPretraga] = useState("");
  const [pokaziDropdown, setPokazuiDropdown] = useState(false);
  const [pokaziModal, setPokazuiModal] = useState(false);
  const [pretragaModal, setPretragaModal] = useState("");

  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [grupe, setGrupe] = useState<ArtikalGrupa[]>([]);
  const [loadingArtikli, setLoadingArtikli] = useState(true);
  const [pretragaArtikala, setPretragaArtikala] = useState("");
  const [odabranaGrupa, setOdabranaGrupa] = useState<string | null>(null);
  const [samoNaStanju, setSamoNaStanju] = useState(true);
  const [nivelacijeAktivne, setNivelacijeAktivne] = useState<NivelacijaAktivna[]>([]);
  const [istorijaRacuna, setIstorijaRacuna] = useState<RacunIstorija[]>([]);
  const [loadingIstorijaRacuna, setLoadingIstorijaRacuna] = useState(false);
  const [pokaziModalStavkiRacuna, setPokazuiModalStavkiRacuna] = useState(false);
  const [odabraniRacunIstorija, setOdabraniRacunIstorija] = useState<RacunIstorija | null>(null);
  const [stavkeIstorijeRacuna, setStavkeIstorijeRacuna] = useState<StavkaIstorijeRacuna[]>([]);
  const [loadingStavkeIstorijeRacuna, setLoadingStavkeIstorijeRacuna] = useState(false);
  const [napomena, setNapomena] = useState("");
  const [tereni, setTereni] = useState<Teren[]>([]);
  const [loadingTereni, setLoadingTereni] = useState(true);
  const [odabraniTeren, setOdabraniTeren] = useState<Teren | null>(null);
  const [pokaziDropdownTeren, setPokazuiDropdownTeren] = useState(false);

  const [statusKase, setStatusKase] = useState<
    "provjera" | "dostupna" | "nedostupna"
  >("provjera");

  const [podgrupeRacuna, setPodgrupeRacuna] = useState<RacunPodgrupa[]>([]);
  const [loadingPodgrupeRacuna, setLoadingPodgrupeRacuna] = useState(true);
  const [odabranaPodgrupa, setOdabranaPodgrupa] =
    useState<RacunPodgrupa | null>(null);
  // Podgrupa koju je operater izabrao ali čeka potvrdu (kad ne obračunava PDV —
  // promjena briše sve trenutno uneseno, pa se prvo pita).
  const [podgrupaZaPotvrdu, setPodgrupaZaPotvrdu] =
    useState<RacunPodgrupa | null>(null);
  // Potvrda prije čuvanja kad izabrana podgrupa ne obračunava PDV — pamti da li
  // je operater kliknuo "Sačuvaj i štampaj" (true) ili "Samo sačuvaj" (false).
  const [pokaziPotvrduBezPdv, setPokazuiPotvrduBezPdv] = useState(false);
  const [stampajNakonPotvrde, setStampajNakonPotvrde] = useState(false);
  // Datum do kada račun treba biti plaćen — podrazumijevano se računa iz
  // partnerovog broja dana dogovorene valute (odabraniPartner.dogovorena_valuta),
  // ali korisnik ga može ručno promijeniti.
  const [datumValute, setDatumValute] = useState("");

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
  const [stampajDirektno, setStampajDirektno] = useState(false);
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
  const [artikalZaUnos, setArtikalZaUnos] = useState<Artikal | null>(null);
  const [kolicina, setKolicina] = useState("");
  const [vpc1, setVpc1] = useState("");
  const [rab1, setRab1] = useState("");
  const [vpc2, setVpc2] = useState("");
  const [rab2, setRab2] = useState("");
  const [vpc3, setVpc3] = useState("");
  const [rab3, setRab3] = useState("");
  // Šifra proizvoda stavke koja se trenutno mijenja (preko modala) — null znači da se
  // dodaje nova stavka; kad je postavljena, potvrda zamjenjuje (ne sabira) postojeći unos.
  const [urejivanjeSifra, setUrejivanjeSifra] = useState<string | null>(null);
  const [artikalZaNivelisanje, setArtikalZaNivelisanje] = useState<Artikal | null>(null);
  const [artikalZaCijenu, setArtikalZaCijenu] = useState<Artikal | null>(null);
  const [novaVpc, setNovaVpc] = useState("");
  const [novaMpc, setNovaMpc] = useState("");
  const [nivelacijaLoading, setNivelacijaLoading] = useState(false);
  const [nivelacijaGreska, setNivelacijaGreska] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const terenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partneriRes, lokacijeRes] = await Promise.all([
          fetch(`${API_URL}/api/partneri`, { credentials: "include" }),
          fetch(`${API_URL}/api/partneri/dodatne-lokacije`, { credentials: "include" }),
        ]);
        if (!partneriRes.ok) return;
        const partneriData = await partneriRes.json();
        const lista: Partner[] = (partneriData.data ?? []).filter(
          (p: Partner) => p.sifra_partnera !== 300,
        );
        if (lokacijeRes.ok) {
          const lokacijeData = await lokacijeRes.json();
          const lokacije: DodatnaLokacija[] = lokacijeData.data ?? [];
          const lokacijeMap = new Map(lokacije.map((l) => [l.sifra_partnera, l]));
          lista.forEach((p) => {
            const lok = lokacijeMap.get(p.sifra_partnera);
            if (lok) p.dodatna_lokacija = lok;
          });
        }
        setPartneri(lista);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  // Kad se izabere (ili promijeni) partner, datum valute se podrazumijevano računa
  // kao danas + partnerov broj dana dogovorene valute — korisnik ga poslije može
  // ručno prepisati preko date inputa.
  useEffect(() => {
    if (!odabraniPartner) {
      setDatumValute("");
      return;
    }
    const daniValute = Number(odabraniPartner.dogovorena_valuta) || 0;
    const d = new Date();
    d.setDate(d.getDate() + daniValute);
    const pad = (n: number) => String(n).padStart(2, "0");
    setDatumValute(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }, [odabraniPartner]);

  useEffect(() => {
    if (!odabraniPartner) {
      setIstorijaRacuna([]);
      return;
    }
    let cancelled = false;
    setLoadingIstorijaRacuna(true);
    fetch(`${API_URL}/api/racuni/istorija?sifraPartnera=${odabraniPartner.sifra_partnera}`, { credentials: "include" })
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
        const res = await fetch(`${API_URL}/api/teren/terena-po-danima`, { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          const lista: Teren[] = d.data ?? [];
          setTereni(
            [...lista].sort((a, b) =>
              new Date(a.datum_dostave ?? 0).getTime() - new Date(b.datum_dostave ?? 0).getTime(),
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
    let cancelled = false;
    const provjeriKasu = async () => {
      setStatusKase("provjera");
      try {
        await preuzmiStatusEsira("ziralni");
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
      const res = await fetch(`${API_URL}/api/nivelacije/aktivne`, { credentials: "include" });
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
      const matchGrupa = odabranaGrupa === null || a.grupa_proizvoda === odabranaGrupa;
      const matchQ = !q ||
        a.naziv_proizvoda.toLowerCase().includes(q) ||
        String(a.sifra_proizvoda).includes(q);
      const matchStanje = !samoNaStanju || Number(a.kolicina_proizvoda) > 0;
      return matchGrupa && matchQ && matchStanje;
    });
  }, [artikli, pretragaArtikala, odabranaGrupa, samoNaStanju]);

  const handleOdabir = (p: Partner) => {
    setOdabraniPartner(p);
    setPretraga("");
    setPokazuiDropdown(false);
  };

  const handleKlikArtikl = (a: Artikal) => {
    setArtikalZaUnos(a);
    setKolicina("");
    const vpcTrenutni = (
      typeof a.vpc === "number" ? a.vpc : parseFloat(String(a.vpc)) || 0
    ).toFixed(2);
    setVpc1(vpcTrenutni); setRab1("0.00");
    setVpc2(vpcTrenutni); setRab2("0.00");
    setVpc3(vpcTrenutni); setRab3("0.00");
    setUrejivanjeSifra(null);
  };

  // Otvara modal za izmjenu već unesene stavke — popuni ga postojećim vrijednostima
  // (količina, VPC1/2/3, rabati) umjesto podrazumijevanih, tako da potvrda zamijeni
  // stavku umjesto da sabira količinu.
  const handleIzmijeniStavku = (s: StavkaRacuna) => {
    const artikal = artikli.find(
      (a) => String(a.sifra_proizvoda) === s.sifra_proizvoda,
    );
    if (!artikal) {
      alert("Artikal više nije dostupan u katalogu.");
      return;
    }
    setArtikalZaUnos(artikal);
    setKolicina(String(s.kolicina));
    setVpc1(s.vpc1.toFixed(2)); setRab1(s.rab1.toFixed(2));
    setVpc2(s.vpc2.toFixed(2)); setRab2(s.rab2.toFixed(2));
    setVpc3(s.vpc3.toFixed(2)); setRab3(s.rab3.toFixed(2));
    setUrejivanjeSifra(s.sifra_proizvoda);
  };

  const handlePotvrdiStavku = () => {
    if (!artikalZaUnos) return;
    const kol = parseFloat(kolicina.replace(",", "."));
    if (!kol || kol <= 0) return;

    const vpc = typeof artikalZaUnos.vpc === "number" ? artikalZaUnos.vpc : parseFloat(String(artikalZaUnos.vpc)) || 0;
    const nabavnaCijena =
      typeof artikalZaUnos.nabavna_cijena === "number"
        ? artikalZaUnos.nabavna_cijena
        : parseFloat(String(artikalZaUnos.nabavna_cijena)) || 0;
    const brojVpc1 = parseFloat(vpc1) || 0;
    const brojRab1 = parseFloat(rab1) || 0;
    const brojVpc2 = parseFloat(vpc2) || 0;
    const brojRab2 = parseFloat(rab2) || 0;
    const brojVpc3 = parseFloat(vpc3) || 0;
    const brojRab3 = parseFloat(rab3) || 0;
    // Osnova — konačna cijena nakon kaskade rabata (uvijek = VPC3, jer VPC3 kaskadno
    // prati VPC2/VPC1/VPC kad neki nivo nije eksplicitno mijenjan).
    const osnova = brojVpc3;
    // Podgrupa određuje da li se PDV uopšte obračunava na ovaj račun.
    const obracunavaSePdv = odabranaPodgrupa?.obracunava_se_pdv !== 1;

    setStavke((prev) => {
      const idx = prev.findIndex((s) => s.sifra_proizvoda === artikalZaUnos.sifra_proizvoda);
      // Kod izmjene postojeće stavke, količina se zamjenjuje; kod dodavanja iste
      // šifre drugi put (bez izmjene), količine se sabiraju.
      const novaKolicina =
        idx >= 0
          ? urejivanjeSifra === artikalZaUnos.sifra_proizvoda
            ? kol
            : prev[idx].kolicina + kol
          : kol;
      const vrednost = Math.round(novaKolicina * osnova * 100) / 100;
      const pdv = obracunavaSePdv
        ? Math.round(vrednost * STOPA_PDV * 100) / 100
        : 0;
      const nova: StavkaRacuna = {
        sifra_proizvoda: artikalZaUnos.sifra_proizvoda,
        naziv_proizvoda: artikalZaUnos.naziv_proizvoda,
        jm: artikalZaUnos.jm,
        kolicina: novaKolicina,
        vpc,
        vpc1: brojVpc1,
        rab1: brojRab1,
        vpc2: brojVpc2,
        rab2: brojRab2,
        vpc3: brojVpc3,
        rab3: brojRab3,
        osnova,
        vrednost,
        pdv,
        ukupno: Math.round((vrednost + pdv) * 100) / 100,
        nabavna_cijena: nabavnaCijena,
        barkod: artikalZaUnos.barkod ?? "",
        obracunava_se_pdv: obracunavaSePdv,
      };
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = nova;
        return updated;
      }
      return [...prev, nova];
    });
    setArtikalZaUnos(null);
    setKolicina("");
    setVpc1(""); setRab1("");
    setVpc2(""); setRab2("");
    setVpc3(""); setRab3("");
    setUrejivanjeSifra(null);
  };

  const handleUkloniStavku = (sifra: string) => {
    setStavke((prev) => prev.filter((s) => s.sifra_proizvoda !== sifra));
  };

  // Briše izabranog partnera, sve stavke, teren, napomenu i eventualne poruke
  // o čuvanju/fiskalizaciji — ne dira podgrupu (o njoj odlučuje pozivalac).
  const ocistiRacun = () => {
    setStavke([]);
    setOdabraniPartner(null);
    setOdabraniTeren(null);
    setNapomena("");
    setSifreTabeleZaStampano([]);
    setSpremanjeGreska(null);
    setSpremanjeUpozorenje(null);
    setPosljednjiBrojFiskalnog(null);
  };

  // Vraća cijelu formu na početno stanje (dugme "Poništi sve").
  const handlePonistiSve = () => {
    ocistiRacun();
    const podrazumijevana =
      podgrupeRacuna.find((p) => Number(p.sifra_podgrupe) === 10) ?? null;
    setOdabranaPodgrupa(podrazumijevana);
  };

  // Potvrda promjene na podgrupu koja ne obračunava PDV — briše sve trenutno
  // uneseno (da ne ostanu stavke sa "starim" PDV obračunom) i tek onda mijenja
  // podgrupu. Otkazivanje ostavlja podgrupu nepromijenjenu.
  const handlePotvrdiPromjenuGrupe = () => {
    if (!podgrupaZaPotvrdu) return;
    ocistiRacun();
    setOdabranaPodgrupa(podgrupaZaPotvrdu);
    setPodgrupaZaPotvrdu(null);
  };

  const handleOtkaziPromjenuGrupe = () => setPodgrupaZaPotvrdu(null);

  const handleSacuvajNivelaciju = async () => {
    if (!artikalZaCijenu) return;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const staraVpc = round2(typeof artikalZaCijenu.vpc === "number" ? artikalZaCijenu.vpc : parseFloat(String(artikalZaCijenu.vpc)) || 0);
    const novaVpcBroj = round2(parseFloat(novaVpc));
    if (!novaVpcBroj || novaVpcBroj <= 0) return;
    const kolicina = Number(artikalZaCijenu.kolicina_proizvoda) || 0;
    const nivelacijaRobe = Number(artikalZaCijenu.vrsta_proizvoda) === 2 ? 1 : 0;

    setNivelacijaLoading(true);
    setNivelacijaGreska(null);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const datumNivelacije = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
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

  // Priprema kompletnog JSON-a (header + items) za slanje kroz proceduru
  // erp.sp_racuni_unos — vrsta_racuna "z" (žiralni), vrsta_racuna_novi 2 (VP).
  // Osnova obračuna po stavci je "osnova" (VPC nakon kaskade VPC1/VPC2/VPC3);
  // vpc (kataloški, prije rabata) ide u vpc_bez_rabata, a rabati po nivoima
  // (1/2/3) idu i procentualno (rabat_proc*) i finansijski u KM (rabat_km*).
  const pripremiRacunZaUnos = (): RacunZaUnos => {
    const items: StavkaZaUnos[] = stavke.map((s) => {
      const sifraProizvoda = Number(String(s.sifra_proizvoda).trim());
      if (!Number.isFinite(sifraProizvoda)) {
        throw new Error(
          `Neispravna šifra proizvoda za unos računa: ${s.sifra_proizvoda} (${s.naziv_proizvoda})`,
        );
      }
      return {
        sifra_proizvoda: sifraProizvoda,
        cijena_proizvoda: round2(s.osnova),
        // Osnova + PDV (ako se PDV obračunava za ovu stavku) — koristi već
        // sačuvano s.ukupno/s.kolicina umjesto ponovnog računanja preko
        // STOPA_PDV, da vrijednost bude tačna i kad podgrupa ne obračunava PDV.
        prodajna_cijena: round2(s.ukupno / s.kolicina),
        kolicina: s.kolicina,
        rabat_proc: round2(s.rab1),
        rabat_km: round2((s.vpc - s.osnova) * s.kolicina),
        vpc: round2(s.osnova),
        vpc_bez_rabata: round2(s.vpc),
        rabat_proc_2: round2(s.rab2),
        rabat_km_2: round2((s.vpc1 - s.vpc2) * s.kolicina),
        vpc_sa_rabat_2: round2(s.vpc2),
        rabat_proc_3: round2(s.rab3),
        rabat_km_3: round2((s.vpc2 - s.vpc3) * s.kolicina),
        vpc_rabat_1: round2(s.vpc1),
        pdv_po_artiklu: round2(s.pdv),
        nabavna_cijena_proizvoda: round2(s.nabavna_cijena),
      };
    });

    const ukupanRabatKm = round2(
      items.reduce((sum, it) => sum + it.rabat_km, 0),
    );
    const vpVrednost = round2(
      stavke.reduce((sum, s) => sum + s.osnova * s.kolicina, 0),
    );
    const vpVrednostOriginal = round2(
      stavke.reduce((sum, s) => sum + s.vpc * s.kolicina, 0),
    );
    const vp1 = round2(stavke.reduce((sum, s) => sum + s.vpc1 * s.kolicina, 0));
    const vp2 = round2(stavke.reduce((sum, s) => sum + s.vpc2 * s.kolicina, 0));

    const sada = new Date();
    const datumRacuna = formatDatumIso(sada);

    const header: RacunHeader = {
      vrsta_racuna: VRSTA_RACUNA,
      sifra_kupca: odabraniPartner?.sifra_partnera ?? 0,
      datum_racuna: datumRacuna,
      ukupno: round2(ukupnoRacun),
      sifra_radnika: getCurrentUser()?.sifraRadnika ?? 0,
      slovima: brojUSlovima(round2(ukupnoRacun)),
      valuta: datumValute,
      datum_isporuke: datumRacuna,
      napomena,
      rabat_km: ukupanRabatKm,
      vreme: formatVremeIso(sada),
      VP_vrednost: vpVrednost,
      vp_vrednost_original: vpVrednostOriginal,
      VP_1: vp1,
      VP_2: vp2,
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
    const samoCifre = String(s.sifra_proizvoda).replace(/\D/g, "");
    return samoCifre.padStart(13, "0").slice(-13);
  };

  // Priprema stavki za ESIR fiskalni račun (POST /api/invoices — izdajFiskalniRacun).
  // Cijena koja ide ESIR-u je "MPC-ekvivalent" (osnova + PDV) kad se PDV obračunava,
  // isto kao kod gotovinskog, a kad podgrupa ne obračunava PDV (obracunava_se_pdv=1)
  // šalje se čista osnova i oznaka "К" (ESIR_OZNAKA_BEZ_PDV) umjesto "Е" — rabat je
  // već ukalkulisan u tu cijenu, pa se ne šalje odvojeno.
  // VAŽNO: totalAmount koristi već sačuvano s.ukupno (isti broj kao u unos JSON-u
  // i na printu), ne računa se ponovo — ESIR vraća grešku ako zbir stavki ne
  // odgovara tačno na paru, a nezavisno preračunavanje otvara prostor za razliku
  // od 0.01 KM zbog redoslijeda zaokruživanja.
  const pripremiEsirStavke = (): EsirStavka[] =>
    stavke.map((s) => ({
      name: s.naziv_proizvoda,
      gtin: gtinZaStavku(s),
      labels: [s.obracunava_se_pdv ? ESIR_OZNAKA_SA_PDV : ESIR_OZNAKA_BEZ_PDV],
      totalAmount: s.ukupno,
      unitPrice: round2(s.ukupno / s.kolicina),
      quantity: s.kolicina,
      discount: 0,
      discountAmount: 0,
    }));

  // Žiralni račun se uvijek plaća virmanski (bezgotovinski).
  const pripremiEsirPlacanje = (): EsirPlacanje[] => [
    { amount: round2(ukupnoRacun), paymentType: "WireTransfer" },
  ];

  const pripremiBuyerId = (): string | undefined => {
    const jib = odabraniPartner?.jib?.trim();
    return jib ? jib : undefined;
  };

  // ESIR ograničava buyerCostCenterId na 50 znakova.
  const pripremiBuyerCostCenterId = (): string | undefined =>
    odabraniPartner?.naziv_partnera.slice(0, 50);

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
  const sacuvajEsirGreskuJson = (sifraTabele: unknown, podaci: unknown) => {
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

  // Šalje { header, items } proceduri erp.sp_racuni_unos preko POST /api/racuni/unos,
  // pa best-effort ažurira "stampano" za uvezenu narudžbu, pa fiskalizuje preko ESIR-a
  // (device "ziralni" — VITE_ESIR_URL_ZIRALNI) — isti princip kao kod gotovinskog računa.
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
        sifra_tabele?: number;
      } | null = null;
      if (rawOdgovor) {
        try {
          json = JSON.parse(rawOdgovor) as {
            success?: boolean;
            error?: string;
            broj_racuna?: number | string;
            affected_rows?: number | null;
            response_source?: string;
            sifra_tabele?: number;
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
      // potvrđeno čuvanje računa, samo prijavimo grešku.
      try {
        setKorakCuvanja(4); // Slanje ka ESIR-u
        const esirRezultat = await izdajFiskalniRacun(
          "ziralni",
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
        const stavkeZaPrint = stavke;
        // Broj računa formatiran isto kao "Broj računa" u Pregledu računa (npr.
        // "VP-10-3402 / 26") — POST /api/racuni/unos vraća samo sirov broj_racuna,
        // pa se ovdje sklapa iz djelova koje već imamo (samo za štampu).
        const prefiksVrsteRacuna = "VP";
        const godinaRacuna = String(
          new Date(podaci.header.datum_racuna).getFullYear(),
        ).slice(-2);
        const brojRacunaZaStampu = `${prefiksVrsteRacuna}-${odabranaPodgrupa?.sifra_podgrupe ?? 0}-${json.broj_racuna ?? "-"} / ${godinaRacuna}`;
        const dodatnaLokacija = odabraniPartner?.dodatna_lokacija;
        const racunA4 = (
          <RacunA4
            racun={{
              broj_racuna: brojRacunaZaStampu,
              datum_izdavanja: podaci.header.datum_racuna,
              datum_isporuke: podaci.header.datum_isporuke,
              valuta: podaci.header.valuta,
              sifra_tabele: json.sifra_tabele ?? null,
              naziv_partnera: odabraniPartner?.naziv_partnera ?? "-",
              adresa_partnera: odabraniPartner?.adresa_partnera ?? null,
              naziv_grada: odabraniPartner?.naziv_grada ?? null,
              jib: odabraniPartner?.jib ?? null,
              pib: odabraniPartner?.pib ?? null,
              poslovna_jedinica: dodatnaLokacija
                ? {
                    naziv: dodatnaLokacija.naziv_lokacije ?? "-",
                    adresa: dodatnaLokacija.adresa_lokacije,
                    grad: dodatnaLokacija.naziv_grada,
                    jib: dodatnaLokacija.JIB,
                  }
                : null,
              slovima: podaci.header.slovima,
              napomena: podaci.header.napomena || null,
              br_fiskalnog: esirInvoiceResponse?.invoiceNumber ?? null,
              verifikacioni_qr:
                esirInvoiceResponse?.verificationQRCode ?? null,
            }}
            stavke={stavkeZaPrint.map((s) => ({
              sifra_proizvoda: s.sifra_proizvoda,
              naziv_proizvoda: s.naziv_proizvoda,
              jm: s.jm,
              kolicina: s.kolicina,
              vpc: s.vpc,
              vpc1: s.vpc1,
              rab1: s.rab1,
              vpc2: s.vpc2,
              rab2: s.rab2,
              vpc3: s.vpc3,
              rab3: s.rab3,
              osnova: s.osnova,
              vrednost: s.vrednost,
              pdv: s.pdv,
              ukupno: s.ukupno,
            }))}
          />
        );

        if (stampajDirektno) {
          try {
            await printDirectly(racunA4, {
              printerName: selectedPrinter,
              format: "A4",
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
            title: `Račun ${brojRacunaZaStampu}`,
            component: racunA4,
          });
        }
      }

      // Vraća i partnera na prazno — spriječava da ime prethodnog kupca ostane
      // prikazano na vrhu forme za sljedeći račun.
      setStavke([]);
      setOdabraniPartner(null);
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

  // Klik na "Samo sačuvaj"/"Sačuvaj i štampaj" — ako izabrana podgrupa ne
  // obračunava PDV, prvo pita operatera za potvrdu (da zna da se ovaj račun
  // čuva bez PDV-a) i tek nakon potvrde pokreće stvarno čuvanje.
  const handleKlikSacuvaj = (stampaj: boolean) => {
    if (odabranaPodgrupa?.obracunava_se_pdv === 1) {
      setStampajNakonPotvrde(stampaj);
      setPokazuiPotvrduBezPdv(true);
      return;
    }
    void handleSacuvajRacun(stampaj);
  };

  const handlePotvrdiCuvanjeBezPdv = () => {
    setPokazuiPotvrduBezPdv(false);
    void handleSacuvajRacun(stampajNakonPotvrde);
  };

  // PRIVREMENO — pregled A4 templejta preko trenutnog stanja forme, prije nego
  // što se bilo šta stvarno sačuva (broj računa i šifra tabele su placeholderi
  // jer još ne postoje dok se račun ne sačuva). Ukloniti kad se A4 poveže u
  // stvarni handleSacuvajRacun tok.
  const handlePregledA4Test = () => {
    if (!odabraniPartner) {
      alert("Izaberite partnera za pregled.");
      return;
    }
    if (stavke.length === 0) {
      alert("Dodajte bar jednu stavku za pregled.");
      return;
    }
    const danas = formatDatumIso(new Date());
    const dodatnaLokacija = odabraniPartner.dodatna_lokacija;
    openPrint({
      title: "Pregled A4 (test)",
      component: (
        <RacunA4
          racun={{
            broj_racuna: `VP-${odabranaPodgrupa?.sifra_podgrupe ?? 0}-PREVIEW / ${danas.slice(2, 4)}`,
            datum_izdavanja: danas,
            datum_isporuke: danas,
            valuta: datumValute || danas,
            sifra_tabele: "TEST",
            naziv_partnera: odabraniPartner.naziv_partnera,
            adresa_partnera: odabraniPartner.adresa_partnera,
            naziv_grada: odabraniPartner.naziv_grada,
            jib: odabraniPartner.jib,
            pib: odabraniPartner.pib,
            poslovna_jedinica: dodatnaLokacija
              ? {
                  naziv: dodatnaLokacija.naziv_lokacije ?? "-",
                  adresa: dodatnaLokacija.adresa_lokacije,
                  grad: dodatnaLokacija.naziv_grada,
                  jib: dodatnaLokacija.JIB,
                }
              : null,
            slovima: brojUSlovima(round2(ukupnoRacun)),
            napomena: napomena || null,
          }}
          stavke={stavke.map((s) => ({
            sifra_proizvoda: s.sifra_proizvoda,
            naziv_proizvoda: s.naziv_proizvoda,
            jm: s.jm,
            kolicina: s.kolicina,
            vpc: s.vpc,
            vpc1: s.vpc1,
            rab1: s.rab1,
            vpc2: s.vpc2,
            rab2: s.rab2,
            vpc3: s.vpc3,
            rab3: s.rab3,
            osnova: s.osnova,
            vrednost: s.vrednost,
            pdv: s.pdv,
            ukupno: s.ukupno,
          }))}
        />
      ),
    });
  };

  const formatDatumRacuna = (d: string) => {
    const datum = new Date(d);
    if (isNaN(datum.getTime())) return String(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(datum.getDate())}.${pad(datum.getMonth() + 1)}.${datum.getFullYear()}.`;
  };

  // dd.MM.yyyy — za prikaz datuma dostave uz teren (npr. u padajućoj listi).
  const formatDatumDMY = (v: string | undefined | null): string | null => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
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
      const res = await fetch(`${API_URL}/api/racuni/stavke?sifraTabele=${r.sifra_tabele}`, { credentials: "include" });
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

  // Otvara modal sa završenim narudžbama za odabrani teren — spaja podatke iz
  // "narudzbe-grupisane" (tmp_partneri) i "narudzbe-aktivne" (stavke po proizvodu,
  // sa verifikovano). Prikazuju se samo kupci kod kojih su SVI proizvodi
  // verifikovani (verifikovano === 2) i koji su plaćeni virmanski (žiralno).
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
            k.nacin_placanja.trim().toUpperCase() === "VIRMANSKO",
        )
        .sort((a, b) => a.naziv_kupca.localeCompare(b.naziv_kupca, "bs"));

      setZavrseneNarudzbe(zavrseni);
    } catch {
      setZavrseneNarudzbe([]);
    } finally {
      setLoadingNarudzbe(false);
    }
  };

  // Pokreće uvoz narudžbe u glavnu formu — izabere partnera, a stvarno punjenje
  // stavki radi efekat ispod, čim odabraniPartner stigne na cilj.
  const handleUvezNarudzbu = (k: NarudzbaZavrsenaKupac) => {
    const partner = partneri.find((p) => p.sifra_partnera === k.sifra_kupca);
    if (!partner) {
      alert(
        `Partner sa šifrom ${k.sifra_kupca} nije pronađen u listi partnera.`,
      );
      return;
    }
    setOdabraniPartner(partner);
    setPendingUvozNarudzbe(k);
    setPokazuiModalNarudzbe(false);
    setOdabraniKupacNarudzbe(null);
    // Novi podaci povučeni iz terena — napomena od prethodnog partnera/računa
    // više nije relevantna.
    setNapomena("");

    // Priprema JSON sa svim sifra_tabele iz uvezene narudžbe — kasnije se šalje
    // proceduri koja ažurira "stampano" (nakon što se račun sačuva).
    const sifreTabele = k.proizvodi.map((p) => ({
      sifra_tabele: p.sifra_tabele,
    }));
    setSifreTabeleZaStampano(sifreTabele);
  };

  // Kad odabraniPartner stvarno stigne na traženog kupca, puni se korpa cijenama
  // iz TRENUTNOG kataloga artikli (ne iz narudžbe — cijena se mogla promijeniti).
  // Artikli koji ne postoje u katalogu ili nemaju stanje se preskaču.
  useEffect(() => {
    if (!pendingUvozNarudzbe) return;
    const k = pendingUvozNarudzbe;
    if (odabraniPartner?.sifra_partnera !== k.sifra_kupca) return;

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
      const vpc =
        typeof artikal.vpc === "number"
          ? artikal.vpc
          : parseFloat(String(artikal.vpc)) || 0;
      const nabavnaCijena =
        typeof artikal.nabavna_cijena === "number"
          ? artikal.nabavna_cijena
          : parseFloat(String(artikal.nabavna_cijena)) || 0;
      // Uvoz sa terena ne nosi rabatne nivoe — osnova je kataloški VPC (0% rabat).
      const obracunavaSePdv = odabranaPodgrupa?.obracunava_se_pdv !== 1;
      const vrednost = Math.round(p.kolicina * vpc * 100) / 100;
      const pdv = obracunavaSePdv
        ? Math.round(vrednost * STOPA_PDV * 100) / 100
        : 0;
      noveStavke.push({
        sifra_proizvoda: artikal.sifra_proizvoda,
        naziv_proizvoda: artikal.naziv_proizvoda,
        jm: artikal.jm,
        kolicina: p.kolicina,
        vpc,
        vpc1: vpc,
        rab1: 0,
        vpc2: vpc,
        rab2: 0,
        vpc3: vpc,
        rab3: 0,
        osnova: vpc,
        vrednost,
        pdv,
        ukupno: Math.round((vrednost + pdv) * 100) / 100,
        nabavna_cijena: nabavnaCijena,
        barkod: artikal.barkod ?? "",
        obracunava_se_pdv: obracunavaSePdv,
      });
    });

    setStavke(noveStavke);
    setPendingUvozNarudzbe(null);
    if (preskoceniProizvodi.length > 0) {
      alert(
        `Preskočeni proizvodi (nema ih u katalogu ili nema stanja):\n${preskoceniProizvodi.join("\n")}`,
      );
    }
  }, [pendingUvozNarudzbe, odabraniPartner, artikli, odabranaPodgrupa]);

  return (
    <>
      <div className="flex flex-col" style={{ height: "calc(100vh - 125px)" }}>

      {/* Red: padajući meni lijevo + kartica desno */}
      <div className="flex gap-3 items-stretch flex-shrink-0">

        {/* Padajući meni — lijevo, fiksna širina */}
        <div ref={searchRef} className="relative w-[20%] flex-shrink-0 flex flex-col">
          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          )}
          <input
            value={pretraga}
            onChange={(e) => { setPretraga(e.target.value); setPokazuiDropdown(true); }}
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
                onMouseDown={() => { setPokazuiDropdown(false); setPokazuiModal(true); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border-t border-gray-100 dark:border-[#2d2648] text-gray-500 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all"
              >
                <User size={11} />
                Pregled svih partnera
              </button>
            </div>
          )}

          {pokaziDropdown && pretraga.length >= 1 && dropdownRezultati.length === 0 && !loading && (
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
            <div className="relative h-full rounded-2xl px-3 py-2 shadow-sm flex items-center gap-2" style={{ background: ACCENT }}>
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-white/20">
                <Banknote size={14} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white text-sm truncate">
                  {odabraniPartner.naziv_partnera}{" "}
                  <span className="text-[9px] font-normal text-white/70">
                    (ID: {odabraniPartner.sifra_partnera})
                  </span>
                </div>
                <div className="text-[10px] text-white/70 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin size={8} className="flex-shrink-0" />
                  {[odabraniPartner.adresa_partnera, odabraniPartner.naziv_grada]
                    .filter(Boolean)
                    .join(", ")}
                  {odabraniPartner.jib && ` · JIB: ${odabraniPartner.jib}`}
                  {odabraniPartner.pib && ` · PIB: ${odabraniPartner.pib}`}
                  {odabraniPartner.dodatna_lokacija && (
                    <span className="ml-1 px-1 py-0.5 rounded-full bg-white/20 text-[9px] font-bold flex-shrink-0">+lok</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-full flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] px-3 py-2 text-xs text-gray-400 dark:text-[#5f5878]">
              <User size={13} className="text-gray-300 dark:text-[#3a3158] flex-shrink-0" />
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
                stroke={PRIMARY}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="14 86"
                className="snake-trace"
              />
            </svg>
          )}
        </div>

        {/* Teren */}
        <div ref={terenRef} className="relative flex-shrink-0" style={{ minWidth: 170 }}>
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
                odabraniTeren ? "text-white/70" : "text-gray-400 dark:text-[#5f5878]"
              }`}
            >
              Teren
            </span>
            <span className={`text-xs font-semibold truncate ${odabraniTeren ? "text-white" : "text-gray-700 dark:text-[#ede9f6]"}`}>
              {loadingTereni
                ? "Učitavanje..."
                : odabraniTeren
                  ? (
                    <>
                      {odabraniTeren.naziv_dana}{" "}
                      <span className={`text-[10px] font-normal ${odabraniTeren ? "text-white/70" : "text-gray-400 dark:text-[#5f5878]"}`}>
                        ({formatDatumDMY(odabraniTeren.datum_dostave) ?? odabraniTeren.sifra_terena_dostava})
                      </span>
                    </>
                  )
                  : "Bez terena"}
            </span>
          </button>

          {pokaziDropdownTeren && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
              <button
                onClick={() => { setOdabraniTeren(null); setPokazuiDropdownTeren(false); }}
                className="w-full flex items-center px-3 py-2 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] text-xs font-semibold text-gray-500 dark:text-[#7d7498]"
              >
                Bez terena
              </button>
              {tereni.map((t) => (
                <button
                  key={t.sifra_terena_dostava}
                  onClick={() => { setOdabraniTeren(t); setPokazuiDropdownTeren(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] transition-all border-b border-gray-100 dark:border-[#2d2648] last:border-b-0"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                      {t.naziv_dana}
                    </span>
                    {formatDatumDMY(t.datum_dostave) && (
                      <span className="text-[10px] font-normal text-gray-400 dark:text-[#5f5878]">
                        {formatDatumDMY(t.datum_dostave)}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-normal text-gray-400 dark:text-[#5f5878] flex-shrink-0">
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
          <span className="text-sm font-extrabold uppercase tracking-widest" style={{ color: PRIMARY }}>
            Žiralni račun
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
          <button
            onClick={handlePonistiSve}
            className="mt-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: PRIMARY }}
            title="Poništi sve trenutno uneseno (partner, stavke, teren, napomena)"
          >
            <RotateCcw size={11} />
            Poništi sve
          </button>
        </div>

      </div>

      {/* Glavni sadržaj: lijevo artikli, desno sadržaj računa */}
      <div className="flex gap-3 mt-3 flex-1 min-h-0">

        {/* Lijevi panel — artikli */}
        <div className="relative w-[22%] flex-shrink-0 flex flex-col bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">

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
                  !samoNaStanju ? "text-white" : "text-gray-500 dark:text-[#7d7498] hover:text-gray-700 dark:hover:text-[#c5bfd8]"
                }`}
                style={!samoNaStanju ? { background: PRIMARY } : {}}
              >
                Svi
              </button>
              <button
                onClick={() => setSamoNaStanju(true)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                  samoNaStanju ? "text-white" : "text-gray-500 dark:text-[#7d7498] hover:text-gray-700 dark:hover:text-[#c5bfd8]"
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
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  onClick={() => setOdabranaGrupa(odabranaGrupa === String(g.sifra_grupe) ? null : String(g.sifra_grupe))}
                  className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                    odabranaGrupa === String(g.sifra_grupe)
                      ? "text-white"
                      : "bg-gray-100 dark:bg-[#2a2340] text-gray-500 dark:text-[#7d7498] hover:bg-[#ede8f5] dark:hover:bg-[#2d2648]"
                  }`}
                  style={odabranaGrupa === String(g.sifra_grupe) ? { background: PRIMARY } : {}}
                >
                  {g.naziv_grupe}
                </button>
              ))}
            </div>
          )}

          {/* Header kolona */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-[#f4f1f9] dark:bg-[#1e1a2d] border-b border-gray-100 dark:border-[#2d2648] flex-shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">Naziv artikla</span>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">VPC</span>
          </div>

          {/* Lista artikala */}
          <div className="flex-1 overflow-y-auto">
            {loadingArtikli ? (
              <div className="flex items-center justify-center py-8 gap-1.5 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
              </div>
            ) : filtriranihArtikli.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-1 text-gray-400 dark:text-[#5f5878]">
                <Package size={20} className="text-gray-300 dark:text-[#3a3158]" />
                <span className="text-[11px]">Nema artikala</span>
              </div>
            ) : (
              filtriranihArtikli.map((a) => {
                const nemaStanje = Number(a.kolicina_proizvoda) <= 0;
                const nivelacija = nivelacijeMap.get(String(a.sifra_proizvoda));
                return (
                  <div
                    key={a.sifra_proizvoda}
                    onClick={() => !nemaStanje && handleKlikArtikl(a)}
                  onContextMenu={(e) => { if (!nemaStanje) { e.preventDefault(); setArtikalZaNivelisanje(a); } }}
                  title={nivelacija ? `Privremena nivelacija — originalna cijena ${Number(nivelacija.cijena_bazna).toFixed(2)} KM, trenutno ${Number(nivelacija.cijena_trenutna).toFixed(2)} KM` : undefined}
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
                          <span className="text-xs font-semibold leading-tight truncate" style={{ color: PRIMARY }}>
                            {a.naziv_proizvoda}
                          </span>
                          {nemaStanje && <Ban size={10} className="flex-shrink-0 text-red-400" />}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-[#5f5878] mt-0.5">
                          {a.sifra_proizvoda} · {a.jm}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-xs font-bold" style={{ color: PRIMARY }}>
                          {typeof a.vpc === "number" ? a.vpc.toFixed(2) : a.vpc}
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

          {/* Lista stavki — 2/3 visine, tabela sa sticky headerom (mnogo kolona -> horizontalni scroll).
              Header se prikazuje uvijek, i kad nema stavki. */}
          <div className="relative overflow-auto" style={{ flex: 2 }}>
              {spremanjeLoading && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/90 dark:bg-[#1a1528]/90 backdrop-blur-sm">
                  <Loader2 size={32} className="animate-spin" style={{ color: PRIMARY }} />
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
                            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                          ) : aktivan ? (
                            <Loader2 size={13} className="animate-spin flex-shrink-0" />
                          ) : (
                            <span className="inline-block w-[13px] h-[13px] rounded-full border border-gray-300 dark:border-[#3a3158] flex-shrink-0" />
                          )}
                          {naziv}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648]">Naziv artikla</th>
                    <th className="w-8 border-b border-gray-200 dark:border-[#2d2648]" />
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">Kol.</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">VPC</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">VPC 1</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">VPC 2</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">VPC 3</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">Osnova</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-20">Vrijednost</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-16">PDV</th>
                    <th className="text-right px-2 py-2 font-semibold uppercase tracking-wide border-b border-gray-200 dark:border-[#2d2648] w-20">Ukupno</th>
                    <th className="w-9 border-b border-gray-200 dark:border-[#2d2648]" />
                  </tr>
                </thead>
                <tbody>
                  {stavke.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10">
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
                        <td className="px-3 py-2 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: PRIMARY }}>{s.naziv_proizvoda}</div>
                          <div className="text-xs text-gray-400 dark:text-[#5f5878]">{s.sifra_proizvoda} · {s.jm}</div>
                        </td>
                        <td className="px-1 py-2 text-center">
                          <button
                            onClick={() => handleIzmijeniStavku(s)}
                            className="p-1 rounded-lg text-gray-400 dark:text-[#7d7498] hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648] hover:text-gray-600 dark:hover:text-[#c5bfd8] transition-all"
                            title="Izmijeni stavku"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium text-gray-700 dark:text-[#c5bfd8]">{s.kolicina.toFixed(3)}</td>
                        <td className="px-2 py-2 text-right text-sm text-gray-700 dark:text-[#c5bfd8]">{s.vpc.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">{s.vpc1.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">{s.rab1.toFixed(2)}%</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">{s.vpc2.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">{s.rab2.toFixed(2)}%</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">{s.vpc3.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">{s.rab3.toFixed(2)}%</div>
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-extrabold" style={{ color: PRIMARY }}>{s.osnova.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-sm text-gray-700 dark:text-[#c5bfd8]">{s.vrednost.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                            {((s.vpc - s.osnova) * s.kolicina).toFixed(2)} KM
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right text-sm text-gray-700 dark:text-[#c5bfd8]">{s.pdv.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right text-sm font-bold" style={{ color: PRIMARY }}>{s.ukupno.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleUkloniStavku(s.sifra_proizvoda)}
                            className="flex-shrink-0 p-1.5 rounded-lg transition-all hover:brightness-110"
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
          <div className="border-t-2 border-gray-200 dark:border-[#2d2648] flex flex-col" style={{ flex: 1 }}>
            <div className="flex items-center justify-between px-6 gap-3" style={{ paddingTop: 10, paddingBottom: 10 }}>
              <span className="text-sm text-gray-400 dark:text-[#5f5878] font-semibold">
                Broj stavki: <span style={{ color: PRIMARY }}>{stavke.length}</span>
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 dark:text-[#5f5878] font-semibold uppercase tracking-wide">Ukupno za platiti</span>
                  <span className="text-xl font-bold" style={{ color: PRIMARY }}>
                    {ukupnoRacun.toFixed(2)} KM
                  </span>
                </div>
                <button
                  onClick={() => handleKlikSacuvaj(false)}
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
                  onClick={() => handleKlikSacuvaj(true)}
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
                  onClick={() => {
                    // Privremeno (dok se ne poveže stvarno slanje) — samo ispisuje
                    // tačan ESIR zahtjev u konzolu, da se provjeri tačan oblik.
                    console.log("ESIR zahtjev (žiralni):", {
                      invoiceRequest: pripremiEsirZahtjev(),
                      ...esirOpcijeStampe,
                    });
                  }}
                  disabled={stavke.length === 0}
                  title="Prikaži tačan ESIR zahtjev (debug)"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Eye size={13} />
                  ESIR JSON
                </button>
                <button
                  type="button"
                  onClick={handlePregledA4Test}
                  disabled={stavke.length === 0}
                  title="Privremeno — pregled A4 templejta preko print modala, prije stvarnog čuvanja"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-dashed border-gray-300 dark:border-[#3a3158] text-gray-500 dark:text-[#7d7498] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer size={13} />
                  Pregled A4 (test)
                </button>
              </div>
            </div>
            {(spremanjeGreska || spremanjeUpozorenje || posljednjiBrojFiskalnog) && (
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

            <div className="flex gap-3 px-4 flex-shrink-0" style={{ marginTop: 5 }}>
              {/* Prva trećina — istorija računa */}
              <div className="w-1/3">
                {odabraniPartner && (
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
                      <div className="text-[11px] text-gray-400 dark:text-[#5f5878] py-1">Nema ranijih računa</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {istorijaRacuna.map((r) => (
                          <button
                            key={r.sifra_tabele}
                            onClick={() => handleKlikRacunIstorija(r)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#f4f1f9] dark:bg-[#1e1a2d] hover:bg-[#ede8f5] dark:hover:bg-[#2d2648] transition-all text-left"
                          >
                            <div className="text-[11px] font-bold truncate" style={{ color: PRIMARY }}>
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

              {/* Treća trećina — podgrupa računa + valuta računa */}
              <div className="w-1/3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
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
                        // Promjena na podgrupu bez PDV-a briše sve trenutno uneseno —
                        // prvo se pita za potvrdu (izbornik ostaje na staroj vrijednosti
                        // dok korisnik ne potvrdi, jer se odabranaPodgrupa ne mijenja ovdje).
                        if (podgrupa?.obracunava_se_pdv === 1) {
                          setPodgrupaZaPotvrdu(podgrupa);
                        } else {
                          setOdabranaPodgrupa(podgrupa);
                        }
                      }}
                      disabled={loadingPodgrupeRacuna}
                      className="w-full px-2 py-1.5 text-[11px] border border-gray-200 dark:border-[#3a3158] rounded-lg bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20"
                    >
                      {podgrupeRacuna.length === 0 && (
                        <option value="">
                          {loadingPodgrupeRacuna ? "Učitavanje..." : "Nema podgrupa"}
                        </option>
                      )}
                      {podgrupeRacuna.map((p) => (
                        <option key={p.sifra_podgrupe} value={p.sifra_podgrupe}>
                          {p.opis_podgrupe} ({p.sifra_podgrupe})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                        Valuta računa
                      </span>
                      {odabraniPartner && (
                        <span className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                          ({Number(odabraniPartner.dogovorena_valuta) || 0} dana)
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={datumValute}
                        onChange={(e) => setDatumValute(e.target.value)}
                        style={{ color: "transparent" }}
                        className="w-full px-2 py-1.5 text-[11px] border border-gray-200 dark:border-[#3a3158] rounded-lg bg-white dark:bg-[#1e1a2d] focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20"
                      />
                      <div className="absolute inset-0 flex items-center px-2 text-[11px] text-gray-800 dark:text-[#ede9f6] pointer-events-none">
                        {formatDatumDMY(datumValute) ?? "Izaberite datum"}
                      </div>
                    </div>
                  </div>
                </div>

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

      </div>{/* kraj flex-col wrapper */}

      {/* Modal nivelisanje cijena */}
      {artikalZaNivelisanje &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setArtikalZaNivelisanje(null); }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[576px] overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3" style={{ background: PRIMARY }}>
                <Package size={18} className="text-white flex-shrink-0" />
                <span className="font-bold text-white text-base truncate">{artikalZaNivelisanje.naziv_proizvoda}</span>
                <span className="ml-auto flex-shrink-0 px-2 py-0.5 rounded-lg bg-white/20 text-white text-xs font-semibold">{artikalZaNivelisanje.jm}</span>
              </div>
              {(() => {
                const jeVecIzabran = stavke.some((s) => s.sifra_proizvoda === artikalZaNivelisanje.sifra_proizvoda);
                return (
                  <>
                    <div className="px-6 py-5 space-y-4">
                      {jeVecIzabran ? (
                        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3">
                          <Ban size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Ovaj proizvod je već dodan kao stavka na računu. Nivelisanje cijena nije moguće izvršiti dok se stavka ne ukloni iz liste.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                          Da li želite da izvršite <span className="font-semibold" style={{ color: PRIMARY }}>nivelisanje cijena</span> za navedeni proizvod?
                        </p>
                      )}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">Šifra</div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">{artikalZaNivelisanje.sifra_proizvoda}</div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">VPC</div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">
                            {typeof artikalZaNivelisanje.vpc === "number" ? artikalZaNivelisanje.vpc.toFixed(2) : artikalZaNivelisanje.vpc} KM
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">MPC</div>
                          <div className="text-sm font-bold" style={{ color: PRIMARY }}>
                            {typeof artikalZaNivelisanje.mpc === "number" ? artikalZaNivelisanje.mpc.toFixed(2) : artikalZaNivelisanje.mpc} KM
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold mb-1">Količina</div>
                          <div className="text-sm font-bold text-gray-700 dark:text-[#ede9f6]">
                            {Number(artikalZaNivelisanje.kolicina_proizvoda).toFixed(3)}
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
                              const vpc = typeof artikalZaNivelisanje.vpc === "number" ? artikalZaNivelisanje.vpc : parseFloat(String(artikalZaNivelisanje.vpc)) || 0;
                              const mpc = typeof artikalZaNivelisanje.mpc === "number" ? artikalZaNivelisanje.mpc : parseFloat(String(artikalZaNivelisanje.mpc)) || 0;
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
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setArtikalZaCijenu(null); setNovaVpc(""); setNovaMpc(""); } }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[576px] overflow-hidden">

              {/* Header */}
              <div className="px-6 py-4 flex items-center gap-3" style={{ background: PRIMARY }}>
                <Package size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">{artikalZaCijenu.naziv_proizvoda}</div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Šifra: {artikalZaCijenu.sifra_proizvoda} · Kol: {Number(artikalZaCijenu.kolicina_proizvoda).toFixed(3)} {artikalZaCijenu.jm}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-gray-500 dark:text-[#7d7498]">Unesite novu <b className="text-gray-700 dark:text-[#c5bfd8]">VPC</b> ili <b className="text-gray-700 dark:text-[#c5bfd8]">MPC</b> — druga cijena se računa automatski <span className="text-xs">(VPC × 1.17 = MPC)</span>.</p>

                <div className="grid grid-cols-2 gap-4">
                  {/* VPC */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                      VPC (KM)
                      <span className="ml-2 text-xs font-normal text-gray-400">trenutno: {typeof artikalZaCijenu.vpc === "number" ? artikalZaCijenu.vpc.toFixed(2) : artikalZaCijenu.vpc}</span>
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
                        if (!isNaN(num) && num > 0) setNovaMpc((Math.round(num * 1.17 * 100) / 100).toFixed(2));
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
                      <span className="ml-2 text-xs font-normal text-gray-400">trenutno: {typeof artikalZaCijenu.mpc === "number" ? artikalZaCijenu.mpc.toFixed(2) : artikalZaCijenu.mpc}</span>
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
                        if (!isNaN(num) && num > 0) setNovaVpc((Math.round(num / 1.17 * 100) / 100).toFixed(2));
                        else setNovaVpc("");
                      }}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Preview + razlike */}
                {novaVpc && novaMpc && parseFloat(novaVpc) > 0 && (() => {
                  const kol = Number(artikalZaCijenu.kolicina_proizvoda) || 0;
                  const staraVpc = typeof artikalZaCijenu.vpc === "number" ? artikalZaCijenu.vpc : parseFloat(String(artikalZaCijenu.vpc)) || 0;
                  const staraMpc = typeof artikalZaCijenu.mpc === "number" ? artikalZaCijenu.mpc : parseFloat(String(artikalZaCijenu.mpc)) || 0;
                  const nVpc = parseFloat(novaVpc) || 0;
                  const nMpc = parseFloat(novaMpc) || 0;
                  const difVpcFin = (nVpc - staraVpc) * kol;
                  const difMpcFin = (nMpc - staraMpc) * kol;
                  const difVpcPct = staraVpc !== 0 ? ((nVpc - staraVpc) / staraVpc) * 100 : 0;
                  const difMpcPct = staraMpc !== 0 ? ((nMpc - staraMpc) / staraMpc) * 100 : 0;
                  const clr = (v: number) => v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : undefined;
                  const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2);
                  const fmtPct = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3 text-sm">
                        <span className="text-gray-500 dark:text-[#7d7498]">Nova VPC: <b className="text-gray-700 dark:text-[#c5bfd8]">{novaVpc} KM</b></span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-500 dark:text-[#7d7498]">Nova MPC: <b style={{ color: PRIMARY }}>{novaMpc} KM</b></span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-4 py-2.5 space-y-0.5">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold">VPC razlika</div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: clr(difVpcFin) }}>{fmt(difVpcFin)} KM</span>
                            <span className="text-xs font-semibold" style={{ color: clr(difVpcPct) }}>{fmtPct(difVpcPct)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">{kol.toFixed(3)} × {fmt(nVpc - staraVpc)} KM</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] px-4 py-2.5 space-y-0.5">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878] font-semibold">MPC razlika</div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: clr(difMpcFin) }}>{fmt(difMpcFin)} KM</span>
                            <span className="text-xs font-semibold" style={{ color: clr(difMpcPct) }}>{fmtPct(difMpcPct)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">{kol.toFixed(3)} × {fmt(nMpc - staraMpc)} KM</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {nivelacijaGreska && (
                  <div className="text-xs font-medium text-red-500">{nivelacijaGreska}</div>
                )}
              </div>

              <div className="flex gap-3 px-6 pb-5">
                <button
                  onClick={() => { setArtikalZaCijenu(null); setNovaVpc(""); setNovaMpc(""); setNivelacijaGreska(null); }}
                  disabled={nivelacijaLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-40"
                >
                  Odustani
                </button>
                <button
                  disabled={!novaVpc || !novaMpc || parseFloat(novaVpc) <= 0 || nivelacijaLoading}
                  onClick={handleSacuvajNivelaciju}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  {nivelacijaLoading && <Loader2 size={14} className="animate-spin" />}
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal unos količine */}
      {artikalZaUnos &&
        (() => {
          const vpcKatalog =
            typeof artikalZaUnos.vpc === "number"
              ? artikalZaUnos.vpc
              : parseFloat(String(artikalZaUnos.vpc)) || 0;
          const nabavna =
            typeof artikalZaUnos.nabavna_cijena === "number"
              ? artikalZaUnos.nabavna_cijena
              : parseFloat(String(artikalZaUnos.nabavna_cijena)) || 0;

          const brojVpc1 = parseFloat(vpc1) || 0;
          const brojVpc2 = parseFloat(vpc2) || 0;
          const brojVpc3 = parseFloat(vpc3) || 0;

          // Baza za svaki nivo — prethodni nivo (ili katalog VPC za nivo 1). Rabat N je
          // uvijek razlika između baze i VPC-a tog nivoa: Rabat1 = VPC vs VPC1,
          // Rabat2 = VPC1 vs VPC2, Rabat3 = VPC2 vs VPC3.
          const bazaVpc1 = vpcKatalog;
          const bazaVpc2 = brojVpc1;
          const bazaVpc3 = brojVpc2;

          const izracunajVpcIzRabata = (baza: number, rab: string) => {
            const r = parseFloat(rab);
            if (baza <= 0 || rab === "" || isNaN(r)) return "";
            return (baza * (1 - r / 100)).toFixed(2);
          };
          const izracunajRabatIzVpc = (baza: number, vpcVrijednost: string) => {
            const v = parseFloat(vpcVrijednost);
            if (baza <= 0 || vpcVrijednost === "" || isNaN(v)) return "";
            return (((baza - v) / baza) * 100).toFixed(2);
          };

          // Promjena bilo kojeg VPC-a ili Rabata "gura" izmjenu naniže kroz naredne
          // nivoe (npr. promjena Rabata 1 mijenja VPC1, pa onda i VPC2/VPC3 jer se
          // oni računaju iz svog rabata i (sad izmijenjene) baze iznad).
          const primijeniVpc3 = (novaVpc2: string) => {
            const broj2 = parseFloat(novaVpc2);
            if (isNaN(broj2)) return;
            setVpc3(izracunajVpcIzRabata(broj2, rab3));
          };
          const primijeniVpc2 = (novaVpc1: string) => {
            const broj1 = parseFloat(novaVpc1);
            if (isNaN(broj1)) return;
            const novaVpc2 = izracunajVpcIzRabata(broj1, rab2);
            setVpc2(novaVpc2);
            primijeniVpc3(novaVpc2);
          };

          const onVpc1Change = (val: string) => {
            setVpc1(val);
            setRab1(izracunajRabatIzVpc(bazaVpc1, val));
            primijeniVpc2(val);
          };
          const onRab1Change = (val: string) => {
            setRab1(val);
            const noviVpc1 = izracunajVpcIzRabata(bazaVpc1, val);
            setVpc1(noviVpc1);
            primijeniVpc2(noviVpc1);
          };
          const onVpc2Change = (val: string) => {
            setVpc2(val);
            setRab2(izracunajRabatIzVpc(bazaVpc2, val));
            primijeniVpc3(val);
          };
          const onRab2Change = (val: string) => {
            setRab2(val);
            const noviVpc2 = izracunajVpcIzRabata(bazaVpc2, val);
            setVpc2(noviVpc2);
            primijeniVpc3(noviVpc2);
          };
          const onVpc3Change = (val: string) => {
            setVpc3(val);
            setRab3(izracunajRabatIzVpc(bazaVpc3, val));
          };
          const onRab3Change = (val: string) => {
            setRab3(val);
            setVpc3(izracunajVpcIzRabata(bazaVpc3, val));
          };

          const greske: string[] = [];
          if (vpc1 !== "" && brojVpc1 > vpcKatalog) greske.push("VPC 1 ne može biti veći od VPC-a");
          if (vpc2 !== "" && brojVpc2 > brojVpc1) greske.push("VPC 2 ne može biti veći od VPC 1");
          if (vpc3 !== "" && brojVpc3 > brojVpc2) greske.push("VPC 3 ne može biti veći od VPC 2");
          if (nabavna > 0) {
            if (vpc1 !== "" && brojVpc1 < nabavna) greske.push("VPC 1 ne može biti ispod nabavne cijene");
            if (vpc2 !== "" && brojVpc2 < nabavna) greske.push("VPC 2 ne može biti ispod nabavne cijene");
            if (vpc3 !== "" && brojVpc3 < nabavna) greske.push("VPC 3 ne može biti ispod nabavne cijene");
          }

          return ReactDOM.createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setArtikalZaUnos(null);
                  setKolicina("");
                  setVpc1(""); setRab1(""); setVpc2(""); setRab2(""); setVpc3(""); setRab3("");
                  setUrejivanjeSifra(null);
                }
              }}
            >
              <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[680px] overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]" style={{ background: PRIMARY }}>
                  <Package size={18} className="text-white flex-shrink-0" />
                  <span className="font-bold text-white text-base truncate">{artikalZaUnos.naziv_proizvoda}</span>
                  {urejivanjeSifra === artikalZaUnos.sifra_proizvoda && (
                    <span className="ml-auto flex-shrink-0 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wide">
                      Izmjena
                    </span>
                  )}
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="flex justify-between text-sm text-gray-500 dark:text-[#7d7498]">
                    <span>Šifra: <b className="text-gray-700 dark:text-[#c5bfd8]">{artikalZaUnos.sifra_proizvoda}</b></span>
                    <span>VPC: <b style={{ color: PRIMARY }}>{vpcKatalog.toFixed(2)} KM</b></span>
                    <span>Nabavna (test): <b className="text-gray-700 dark:text-[#c5bfd8]">{nabavna.toFixed(2)} KM</b></span>
                    <span>JM: <b className="text-gray-700 dark:text-[#c5bfd8]">{artikalZaUnos.jm}</b></span>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-gray-400 dark:text-[#7d7498] uppercase tracking-wide mb-2">
                      Cijene i rabati
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">VPC 1</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={vpc1}
                          onChange={(e) => onVpc1Change(e.target.value)}
                          onBlur={() => {
                            const n = parseFloat(vpc1);
                            onVpc1Change(!isNaN(n) ? n.toFixed(2) : vpcKatalog.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">Rabat 1 (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={rab1}
                          onChange={(e) => onRab1Change(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onMouseUp={(e) => e.preventDefault()}
                          onBlur={() => {
                            const n = parseFloat(rab1);
                            if (!isNaN(n)) onRab1Change(n.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">VPC 2</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={vpc2}
                          onChange={(e) => onVpc2Change(e.target.value)}
                          onBlur={() => {
                            const n = parseFloat(vpc2);
                            onVpc2Change(!isNaN(n) ? n.toFixed(2) : bazaVpc2.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">Rabat 2 (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={rab2}
                          onChange={(e) => onRab2Change(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onMouseUp={(e) => e.preventDefault()}
                          onBlur={() => {
                            const n = parseFloat(rab2);
                            if (!isNaN(n)) onRab2Change(n.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">VPC 3</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={vpc3}
                          onChange={(e) => onVpc3Change(e.target.value)}
                          onBlur={() => {
                            const n = parseFloat(vpc3);
                            onVpc3Change(!isNaN(n) ? n.toFixed(2) : bazaVpc3.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">Rabat 3 (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={rab3}
                          onChange={(e) => onRab3Change(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onMouseUp={(e) => e.preventDefault()}
                          onBlur={() => {
                            const n = parseFloat(rab3);
                            if (!isNaN(n)) onRab3Change(n.toFixed(2));
                          }}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    {greske.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {greske.map((g) => (
                          <div key={g} className="text-xs font-medium text-red-500">{g}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="rounded-xl px-4 py-3"
                    style={{ background: `${ACCENT}26` }}
                  >
                    <label className="block text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">Količina ({artikalZaUnos.jm})</label>
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
                      onKeyDown={(e) => e.key === "Enter" && handlePotvrdiStavku()}
                      autoFocus
                      className={inputClass}
                    />
                  </div>
                  {kolicina && parseFloat(kolicina.replace(",", ".")) > 0 && (() => {
                    const kol = parseFloat(kolicina.replace(",", ".")) || 0;
                    // Osnova (brojVpc3) je aktivna cijena nakon kaskade — prati VPC1/2/3
                    // ako su uneseni, inače ostaje na kataloškom VPC-u.
                    const vrednost = kol * brojVpc3;
                    const pdv = vrednost * STOPA_PDV;
                    return (
                      <div className="flex justify-between text-sm rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d] px-4 py-3">
                        <span className="text-gray-500 dark:text-[#7d7498]">Ukupno</span>
                        <span className="font-bold text-base" style={{ color: PRIMARY }}>
                          {(vrednost + pdv).toFixed(2)} KM
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-2 px-5 pb-4">
                  <button
                    onClick={() => {
                      setArtikalZaUnos(null);
                      setKolicina("");
                      setVpc1(""); setRab1(""); setVpc2(""); setRab2(""); setVpc3(""); setRab3("");
                      setUrejivanjeSifra(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={handlePotvrdiStavku}
                    disabled={!kolicina || parseFloat(kolicina.replace(",", ".")) <= 0 || greske.length > 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style={{ background: ACCENT }}
                  >
                    Dodaj
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* Modal pregleda partnera — full screen */}
      {pokaziModal &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#1a1528]">

            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0" style={{ background: PRIMARY }}>
              <Users size={18} className="text-white flex-shrink-0" />
              <span className="font-bold text-white text-base whitespace-nowrap">Pregled partnera</span>
              <span className="text-white/60 text-sm whitespace-nowrap">({modalRezultati.length})</span>
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
                onClick={() => { setPokazuiModal(false); setPretragaModal(""); }}
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
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-12">ID</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">Naziv partnera</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">JIB</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">PIB</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">Mat. broj</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">Adresa</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-32">Grad</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-14">PTT</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">Entitet</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">Država</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">Valuta</th>
                      <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">Radnik</th>
                      <th className="text-center px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-10">Lok.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRezultati.map((p, i) => (
                      <tr
                        key={p.sifra_partnera}
                        onClick={() => { setOdabraniPartner(p); setPokazuiModal(false); setPretragaModal(""); }}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#2a2340] transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#2d2648] ${
                          i % 2 === 0 ? "bg-white dark:bg-[#1a1528]" : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                        } ${odabraniPartner?.sifra_partnera === p.sifra_partnera ? "!bg-[#e0d9f0] dark:!bg-[#2d2648] font-semibold" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-gray-500 dark:text-[#7d7498] font-mono">{p.sifra_partnera}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-[#ede9f6] max-w-[200px]">
                          <div className="truncate">{p.naziv_partnera}</div>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">{p.jib || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">{p.pib || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] font-mono">{p.maticni_broj || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] max-w-[160px]">
                          <div className="truncate">{p.adresa_partnera || "—"}</div>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{p.naziv_grada || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{p.ptt || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{p.entitet || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{p.naziv_drzave || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{p.dogovorena_valuta || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8] max-w-[130px]">
                          <div className="truncate">{p.naziv_radnika || "—"}</div>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {p.dodatna_lokacija && (
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white"
                              style={{ background: ACCENT }}
                              title={p.dodatna_lokacija.naziv_lokacije ?? p.dodatna_lokacija.naziv_grada ?? "Dodatna lokacija"}
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
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border-2 w-[850px] max-h-[80vh] flex flex-col overflow-hidden" style={{ borderColor: ACCENT }}>
              <div className="px-6 py-4 flex items-center gap-3 flex-shrink-0" style={{ background: PRIMARY }}>
                <History size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    {odabraniRacunIstorija ? formatOznakaRacuna(odabraniRacunIstorija) : "Stavke računa"}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabraniRacunIstorija && formatDatumRacuna(odabraniRacunIstorija.datum_racuna)}
                  </div>
                </div>
                <button
                  onClick={() => { setPokazuiModalStavkiRacuna(false); setOdabraniRacunIstorija(null); }}
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
                    <Package size={24} className="text-gray-300 dark:text-[#3a3158]" />
                    <span className="text-sm">Nema stavki za ovaj račun</span>
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="sticky top-0 z-10 bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-16">Šifra</th>
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648]">Naziv proizvoda</th>
                        <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-14">JM</th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-20">Količina</th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">Cij. sa rab.</th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">Prod. cijena</th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-24">VPC vrijed.</th>
                        <th className="text-right px-3 py-2 font-semibold border-b border-gray-200 dark:border-[#2d2648] w-28">Prod. vrijed.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stavkeIstorijeRacuna.map((s, i) => (
                        <tr
                          key={`${s.sifra_proizvoda}-${i}`}
                          className={`border-b border-gray-100 dark:border-[#2a2340] ${i % 2 === 0 ? "bg-white dark:bg-[#1a1528]" : "bg-[#faf9fc] dark:bg-[#1e1a2d]"}`}
                        >
                          <td className="px-3 py-1.5 text-gray-500 dark:text-[#7d7498] font-mono">{s.sifra_proizvoda}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-[#ede9f6]">{s.naziv_proizvoda}</td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-[#c5bfd8]">{s.jm}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">{Number(s.kolicina).toFixed(3)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">{Number(s.cijena_sa_rab).toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">{Number(s.prodajna_cijena).toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700 dark:text-[#c5bfd8]">{Number(s.vpc_vrednost).toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold" style={{ color: PRIMARY }}>{Number(s.prodajna_vrednost).toFixed(2)}</td>
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

      {/* Modal završenih narudžbi (uvoz stavki sa terena) */}
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
                <ClipboardCheck size={18} className="text-white flex-shrink-0" />
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
                    <ClipboardCheck size={24} className="text-gray-300 dark:text-[#3a3158]" />
                    <span className="text-sm">Prvo izaberite teren</span>
                  </div>
                ) : zavrseneNarudzbe.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 dark:text-[#5f5878]">
                    <ClipboardCheck size={24} className="text-gray-300 dark:text-[#3a3158]" />
                    <span className="text-sm">Nema završenih narudžbi za ovaj teren</span>
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
                            style={{ background: PRIMARY }}
                          >
                            <User size={12} style={{ color: ACCENT }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-800 dark:text-[#ede9f6] truncate">
                              {k.naziv_kupca}
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                              Šifra: {k.sifra_kupca} · {k.proizvodi.length}{" "}
                              {k.proizvodi.length === 1 ? "proizvod" : "proizvoda"}
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
                                <Package size={16} className="text-gray-300 dark:text-[#3a3158]" />
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

      {/* Potvrda — promjena na podgrupu koja ne obračunava PDV briše sve trenutno uneseno */}
      {podgrupaZaPotvrdu &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) handleOtkaziPromjenuGrupe();
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[440px] overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3" style={{ background: "#f59e0b" }}>
                <AlertTriangle size={20} className="text-white flex-shrink-0" />
                <span className="font-bold text-white text-base">Promjena grupe — bez PDV-a</span>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-700 dark:text-[#c5bfd8]">
                  Podgrupa <b>{podgrupaZaPotvrdu.opis_podgrupe}</b> ne obračunava PDV.
                  Promjena na ovu podgrupu će obrisati sve trenutno uneseno (partner,
                  stavke, teren, napomena). Da li želiš da nastaviš?
                </p>
              </div>
              <div className="flex gap-3 px-6 pb-5">
                <button
                  onClick={handleOtkaziPromjenuGrupe}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                >
                  Ne
                </button>
                <button
                  onClick={handlePotvrdiPromjenuGrupe}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: PRIMARY }}
                >
                  Da
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Potvrda prije čuvanja — ovaj račun se čuva bez PDV-a */}
      {pokaziPotvrduBezPdv &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPokazuiPotvrduBezPdv(false);
            }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[440px] overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3" style={{ background: "#f59e0b" }}>
                <AlertTriangle size={20} className="text-white flex-shrink-0" />
                <span className="font-bold text-white text-base">Račun bez PDV-a</span>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-700 dark:text-[#c5bfd8]">
                  Podgrupa <b>{odabranaPodgrupa?.opis_podgrupe}</b> ne obračunava PDV —
                  ovaj račun će biti sačuvan i fiskalizovan <b>bez PDV-a</b>. Da li želiš
                  da nastaviš?
                </p>
              </div>
              <div className="flex gap-3 px-6 pb-5">
                <button
                  onClick={() => setPokazuiPotvrduBezPdv(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                >
                  Ne
                </button>
                <button
                  onClick={handlePotvrdiCuvanjeBezPdv}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: PRIMARY }}
                >
                  Da, sačuvaj
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
