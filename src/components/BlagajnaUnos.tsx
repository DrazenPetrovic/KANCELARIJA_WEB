import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useBlagajna } from "../context/BlagajnaContext";
import { formatDatum, formatKM } from "./IzvodiPregled";
import { oznakaRacuna, type RacunKupca } from "./IzvodiUnosForma";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Unos uplata/isplata na trenutno otvoreni nalog blagajne →
// POST /api/blagajna/uplate-unos → erp.blagajna_uplate_unos(p_json).
// sifra_blagajne, datum_uplate (danas) i sifra_radnika postavlja server.
// Operater može izabrati neplaćeni gotovinski račun (popunjava partnera,
// iznos, opis i sifra_veze) ili ručno unijeti iznos — partner je obavezan.
// Nakon unosa, izabrani računi se označavaju plaćenim
// (/api/izvodi/azuriranje-placenosti), isto kao kod izvoda.

// Šifarnik vrsta_uplate — usklađen sa VRSTA_UPLATE u BlagajnaPregled.tsx i
// TIP_UPLATE u blagajna.service.js.
const VRSTE: { kod: number; naziv: string; tip: "uplata" | "isplata" }[] = [
  { kod: 1, naziv: "Uplate kupaca", tip: "uplata" },
  { kod: 0, naziv: "Dugovanja kupaca", tip: "uplata" },
  { kod: 2, naziv: "Uplata dobavljačima (kalk)", tip: "isplata" },
  { kod: 3, naziv: "Uplata (KUF)", tip: "isplata" },
  { kod: 4, naziv: "Dugovanja (dobavljaču)", tip: "isplata" },
  { kod: 5, naziv: "Davanje pozajmice", tip: "isplata" },
  { kod: 6, naziv: "Vraćanje date pozajmice", tip: "uplata" },
  { kod: 7, naziv: "Primanje pozajmice", tip: "uplata" },
  { kod: 8, naziv: "Vraćanje primljene pozajmice", tip: "isplata" },
  { kod: 9, naziv: "Povrat pretplate dobavljaču", tip: "isplata" },
  { kod: 10, naziv: "Prijem pretplate (povrat od kupca)", tip: "uplata" },
  { kod: 11, naziv: "Prijem pretplate dobavljača", tip: "uplata" },
  { kod: 12, naziv: "Povrat pretplate kupcu", tip: "isplata" },
];

// Na unosu: 0 i 1 idu u uplate (erp.blagajna_uplate_unos), 3 = isplata
// dobavljaču po računu — posebna tabela (erp.blagajna_uplate_isplate).
// Puni šifarnik iznad služi za prikaz već sačuvanih stavki.
const VRSTA_ISPLATA_DOB = 3;
const VRSTE_UNOS: { kod: number; naziv: string; tip: "uplata" | "isplata" }[] = [
  { kod: 1, naziv: "Uplate kupaca", tip: "uplata" },
  { kod: VRSTA_ISPLATA_DOB, naziv: "Isplata dobavljaču (račun)", tip: "isplata" },
];

// Red iz erp.blagajna_uplate_isplata_dobavljaci_pregled.
interface Dobavljac {
  sifra: number;
  naziv_dobavljaca: string | null;
  Adresa_dobavljaca: string | null;
  JIB: string | null;
}

// Red iz erp.blagajna_uplate_ispate_troskovi_pregled.
interface Trosak {
  sifra: number;
  naziv_troska: string | null;
}

interface NovaIsplata {
  kljuc: number;
  sifra_dobavljaca: number;
  naziv_dobavljaca: string;
  broj_racuna: string;
  datum_racuna: string; // yyyy-mm-dd
  opis: string;
  ukupno: number;
  iskazani_pdv: number;
  ulazni_pdv: number;
}

// Red iz erp.blagajna_isplate_pregled (broj_naloga = sifra blagajne).
interface SacuvanaIsplata {
  sifra: number;
  sifra_dobavljaca: number | string | null;
  naziv_dobavljaca: string | null;
  datum_racuna: string | null;
  opis: string | null;
  broj_racuna: string | null;
  iskazani_pdv: number | string | null;
  ulazni_pdv: number | string | null;
  ukupno: number | string | null;
  broj_naloga: number | string;
}

const isoUPrikaz = (iso: string) => {
  const [g, m, d] = iso.split("-");
  return g && m && d ? `${d}.${m}.${g}` : null;
};

const broj = (s: string) => parseFloat(s.replace(",", "."));

const vrstaPoKodu = (kod: number | string | null | undefined) =>
  VRSTE.find((v) => v.kod === Number(kod)) ?? {
    kod: Number(kod),
    naziv: kod == null ? "Uplata" : String(kod),
    tip: "uplata" as const,
  };

interface Partner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
}

// Red iz erp.racuni_gl_neplaceni_pregled (GET /api/racuni/neplaceni).
interface RacunNeplacen extends RacunKupca {
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
  Napomena?: string | null;
}

// Gotovinski račun: vrsta_racuna "g" (racuniGotovinski.tsx). Ako stari
// zapis nema vrsta_racuna, gleda se vrsta_racuna_novi = 1 (MP).
const jeGotovinski = (r: RacunNeplacen) => {
  const v = String(r.vrsta_racuna ?? "").trim().toLowerCase();
  if (v) return v === "g";
  return Number(r.vrsta_racuna_novi) === 1;
};

// Red iz erp.blagajna_uplate_pregled.
interface SacuvanaUplata {
  sifra_uplate: number;
  vrsta_uplate: string | number | null;
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
  datum_uplate: string | null;
  uplaceno: number | string | null;
  opis: string | null;
  napomena: string | null;
  sifra_blagajne: number | string;
}

interface NovaStavka {
  kljuc: number;
  vrsta_uplate: number;
  sifra_partnera: number;
  naziv_partnera: string;
  uplaceno: number;
  sifra_veze: number | null;
  veza_prikaz: string | null;
  opis: string;
  napomena: string;
}

type StatusKoraka = "ceka" | "radi" | "ok" | "greska" | "nema";

interface ObradaCuvanja {
  unos: StatusKoraka;
  unosPoruka: string | null;
  isplate: StatusKoraka;
  isplatePoruka: string | null;
  placenost: StatusKoraka;
  placenostPoruka: string | null;
  racuni: { sifra: number; oznaka: string }[];
}

const danasPrikaz = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelCls = "block text-xs text-gray-500 dark:text-[#7d7498] mb-1";

// Datum dd.MM.yyyy, klik bilo gdje u polju otvara kalendar.
function DatumPolje({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const otvoriPicker = () => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };
  return (
    <div className="relative cursor-pointer" onClick={otvoriPicker}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: "transparent" }}
        className={`${inputCls} cursor-pointer`}
      />
      <div
        className={`absolute inset-0 flex items-center px-3 text-sm tabular-nums pointer-events-none ${
          value
            ? "text-gray-800 dark:text-[#ede9f6]"
            : "text-gray-400 dark:text-[#6f6890]"
        }`}
      >
        {isoUPrikaz(value) ?? "dd.mm.gggg"}
      </div>
    </div>
  );
}

const TH = ({
  children,
  right,
  usko,
}: {
  children?: React.ReactNode;
  right?: boolean;
  usko?: boolean;
}) => (
  <th
    className={`sticky top-0 ${usko ? "px-2 py-1.5" : "px-3 py-2"} text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

function KorakObrade({
  status,
  naslov,
  poruka,
}: {
  status: StatusKoraka;
  naslov: string;
  poruka: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
        {status === "radi" ? (
          <Loader2 size={17} className="animate-spin" style={{ color: PRIMARY }} />
        ) : status === "ok" ? (
          <CheckCircle2 size={17} style={{ color: ACCENT }} />
        ) : status === "greska" ? (
          <AlertCircle size={17} className="text-red-500" />
        ) : status === "nema" ? (
          <CheckCircle2 size={17} className="text-gray-300 dark:text-[#5f5878]" />
        ) : (
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-[#5f5878]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            status === "ceka" || status === "nema"
              ? "text-gray-400 dark:text-[#5f5878]"
              : "text-gray-800 dark:text-[#ede9f6]"
          }`}
        >
          {naslov}
        </p>
        {poruka && (
          <p
            className={`text-xs mt-0.5 ${
              status === "greska"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-[#7d7498]"
            }`}
          >
            {poruka}
          </p>
        )}
      </div>
    </div>
  );
}

export function BlagajnaUnos() {
  const { stanje, otvorena, refresh: osvjeziStanje } = useBlagajna();

  // Podaci
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [partneriLoading, setPartneriLoading] = useState(true);
  const [racuni, setRacuni] = useState<RacunNeplacen[]>([]);
  const [racuniLoading, setRacuniLoading] = useState(true);
  const [racuniGreska, setRacuniGreska] = useState<string | null>(null);
  const [pretragaRacuna, setPretragaRacuna] = useState("");
  const [skenPoruka, setSkenPoruka] = useState<string | null>(null);
  const [sacuvane, setSacuvane] = useState<SacuvanaUplata[]>([]);
  const [sacuvaneIsp, setSacuvaneIsp] = useState<SacuvanaIsplata[]>([]);
  const [dobavljaci, setDobavljaci] = useState<Dobavljac[]>([]);
  const [dobavljaciLoading, setDobavljaciLoading] = useState(true);
  const [dobavljaciGreska, setDobavljaciGreska] = useState<string | null>(null);
  const [pretragaDob, setPretragaDob] = useState("");
  const [troskovi, setTroskovi] = useState<Trosak[]>([]);

  // Forma — isplata dobavljaču (vrsta 3)
  const [dobavljac, setDobavljac] = useState<Dobavljac | null>(null);
  const [brojRacuna, setBrojRacuna] = useState("");
  const [datumRacuna, setDatumRacuna] = useState("");
  const [ukupnoIsp, setUkupnoIsp] = useState("");
  const [iskazaniPdv, setIskazaniPdv] = useState("");
  const [ulazniPdv, setUlazniPdv] = useState("");
  const [isplate, setIsplate] = useState<NovaIsplata[]>([]);

  // Novi dobavljač (modal)
  const [noviDob, setNoviDob] = useState<{
    naziv: string;
    adresa: string;
    jib: string;
  } | null>(null);
  const [noviDobGreska, setNoviDobGreska] = useState<string | null>(null);
  const [noviDobSlanje, setNoviDobSlanje] = useState(false);

  // Forma
  const [vrsta, setVrsta] = useState(1);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [pokaziListu, setPokaziListu] = useState(false);
  const [iznos, setIznos] = useState("");
  const [izabraniRacun, setIzabraniRacun] = useState<RacunNeplacen | null>(
    null,
  );
  const [opis, setOpis] = useState("");
  const [napomena, setNapomena] = useState("");
  const [greskaForme, setGreskaForme] = useState<string | null>(null);

  // Stavke
  const [stavke, setStavke] = useState<NovaStavka[]>([]);
  const [slanje, setSlanje] = useState(false);
  const [obrada, setObrada] = useState<ObradaCuvanja | null>(null);

  const pretragaRef = useRef<HTMLDivElement>(null);
  const [pokaziTroskove, setPokaziTroskove] = useState(false);
  const [pretragaTroska, setPretragaTroska] = useState("");
  const kljucRef = useRef(1);

  const izabranaVrsta =
    VRSTE_UNOS.find((v) => v.kod === vrsta) ?? vrstaPoKodu(vrsta);
  const jeIsplataDob = vrsta === VRSTA_ISPLATA_DOB;
  const sifraBlagajne = stanje?.id ?? null;

  const ucitajRacune = async () => {
    setRacuniLoading(true);
    setRacuniGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/racuni/neplaceni`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) {
        throw new Error(d.error || d.message || "Greška pri učitavanju računa");
      }
      setRacuni(
        ((d.data ?? []) as RacunNeplacen[])
          .filter(jeGotovinski)
          .sort((a, b) =>
            String(b.datum_racuna ?? "").localeCompare(
              String(a.datum_racuna ?? ""),
            ),
          ),
      );
    } catch (e: unknown) {
      setRacuni([]);
      setRacuniGreska(
        e instanceof Error ? e.message : "Greška pri učitavanju računa",
      );
    } finally {
      setRacuniLoading(false);
    }
  };

  const ucitajSacuvane = async () => {
    try {
      const res = await fetch(`${API_URL}/api/blagajna/pregled-sa-uplatama`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      setSacuvane((d.uplate ?? []) as SacuvanaUplata[]);
      setSacuvaneIsp((d.isplate ?? []) as SacuvanaIsplata[]);
    } catch {
      setSacuvane([]);
      setSacuvaneIsp([]);
    }
  };

  const ucitajDobavljace = async (): Promise<Dobavljac[]> => {
    setDobavljaciLoading(true);
    setDobavljaciGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/blagajna/isplate-dobavljaci`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) {
        throw new Error(d.message || "Greška pri učitavanju dobavljača");
      }
      const lista = (d.data ?? []) as Dobavljac[];
      setDobavljaci(lista);
      return lista;
    } catch (e: unknown) {
      setDobavljaci([]);
      setDobavljaciGreska(
        e instanceof Error ? e.message : "Greška pri učitavanju dobavljača",
      );
      return [];
    } finally {
      setDobavljaciLoading(false);
    }
  };

  // Izbor dobavljača uvijek kreće od prazne forme isplate.
  const izaberiDobavljaca = (d: Dobavljac) => {
    setDobavljac(d);
    setBrojRacuna("");
    setDatumRacuna("");
    setUkupnoIsp("");
    setIskazaniPdv("");
    setUlazniPdv("");
    setOpis("");
    setGreskaForme(null);
  };

  // Unos novog dobavljača → POST /api/blagajna/isplate-dobavljaci-unos.
  // Nakon uspjeha lista se osvježi i novi dobavljač se odmah izabere.
  const sacuvajNovogDobavljaca = async () => {
    if (!noviDob || noviDobSlanje) return;
    const naziv = noviDob.naziv.trim();
    const adresa = noviDob.adresa.trim();
    const jib = noviDob.jib.trim();
    if (!naziv) {
      setNoviDobGreska("Unesite naziv dobavljača");
      return;
    }
    if (jib && !/^\d+$/.test(jib)) {
      setNoviDobGreska("JIB smije sadržati samo cifre");
      return;
    }
    if (jib && dobavljaci.some((d) => String(d.JIB ?? "").trim() === jib)) {
      setNoviDobGreska(`Dobavljač sa JIB-om ${jib} već postoji u listi`);
      return;
    }
    setNoviDobSlanje(true);
    setNoviDobGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/blagajna/isplate-dobavljaci-unos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naziv_dobavljaca: naziv,
          Adresa_dobavljaca: adresa,
          JIB: jib,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        throw new Error(d.message || "Greška pri unosu dobavljača");
      }
      const lista = await ucitajDobavljace();
      const novi =
        (d.sifra != null &&
          lista.find((x) => String(x.sifra) === String(d.sifra))) ||
        lista.find(
          (x) =>
            (jib && String(x.JIB ?? "").trim() === jib) ||
            (x.naziv_dobavljaca ?? "").trim().toLowerCase() ===
              naziv.toLowerCase(),
        );
      if (novi) izaberiDobavljaca(novi);
      setNoviDob(null);
    } catch (e: unknown) {
      setNoviDobGreska(
        e instanceof Error ? e.message : "Greška pri unosu dobavljača",
      );
    } finally {
      setNoviDobSlanje(false);
    }
  };

  const ucitajTroskove = async () => {
    try {
      const res = await fetch(`${API_URL}/api/blagajna/isplate-troskovi`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => ({}));
      setTroskovi(res.ok ? ((d.data ?? []) as Trosak[]) : []);
    } catch {
      setTroskovi([]);
    }
  };

  const osvjeziSve = () => {
    void ucitajRacune();
    void ucitajSacuvane();
    void ucitajDobavljace();
    void ucitajTroskove();
    void osvjeziStanje();
  };

  useEffect(() => {
    fetch(`${API_URL}/api/partneri/lista-sve`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setPartneri(json.data ?? json ?? []))
      .catch(() => setPartneri([]))
      .finally(() => setPartneriLoading(false));
    void ucitajRacune();
    void ucitajSacuvane();
    void ucitajDobavljace();
    void ucitajTroskove();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        pretragaRef.current &&
        !pretragaRef.current.contains(e.target as Node)
      ) {
        setPokaziListu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtriraniPartneri = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return partneri.slice(0, 50);
    return partneri
      .filter(
        (p) =>
          p.naziv.toLowerCase().includes(q) ||
          (p.skraceni_naziv ?? "").toLowerCase().includes(q) ||
          String(p.partner_id) === q,
      )
      .slice(0, 50);
  }, [partneri, pretraga]);

  // Računi koji su već dodati u nove stavke se ne nude ponovo.
  const dodatiRacuni = useMemo(
    () => new Set(stavke.map((s) => s.sifra_veze).filter((v) => v !== null)),
    [stavke],
  );

  const filtriraniRacuni = useMemo(() => {
    const q = pretragaRacuna.trim().toLowerCase();
    return racuni.filter(
      (r) =>
        !dodatiRacuni.has(Number(r.sifra_tabele)) &&
        (!q ||
          String(r.sifra_tabele) === q ||
          oznakaRacuna(r).toLowerCase().includes(q) ||
          (r.naziv_partnera ?? "").toLowerCase().includes(q)),
    );
  }, [racuni, pretragaRacuna, dodatiRacuni]);

  const sacuvaneBlagajne = useMemo(
    () =>
      sifraBlagajne == null
        ? []
        : sacuvane
            .filter((u) => String(u.sifra_blagajne) === String(sifraBlagajne))
            .sort((a, b) => {
              const tA = vrstaPoKodu(a.vrsta_uplate).tip === "isplata" ? 1 : 0;
              const tB = vrstaPoKodu(b.vrsta_uplate).tip === "isplata" ? 1 : 0;
              if (tA !== tB) return tA - tB;
              return (Number(b.uplaceno) || 0) - (Number(a.uplaceno) || 0);
            }),
    [sacuvane, sifraBlagajne],
  );

  const sacuvaneIsplateBlagajne = useMemo(
    () =>
      sifraBlagajne == null
        ? []
        : sacuvaneIsp.filter(
            (i) => String(i.broj_naloga) === String(sifraBlagajne),
          ),
    [sacuvaneIsp, sifraBlagajne],
  );

  const filtriraniTroskovi = useMemo(() => {
    const q = pretragaTroska.trim().toLowerCase();
    if (!q) return troskovi;
    return troskovi.filter((t) =>
      (t.naziv_troska ?? "").toLowerCase().includes(q),
    );
  }, [troskovi, pretragaTroska]);

  const izaberiTrosak = (t: Trosak) => {
    setOpis(t.naziv_troska ?? "");
    setPokaziTroskove(false);
  };

  const filtriraniDobavljaci = useMemo(() => {
    const q = pretragaDob.trim().toLowerCase();
    if (!q) return dobavljaci;
    return dobavljaci.filter(
      (d) =>
        (d.naziv_dobavljaca ?? "").toLowerCase().includes(q) ||
        (d.JIB ?? "").toLowerCase().includes(q) ||
        (d.Adresa_dobavljaca ?? "").toLowerCase().includes(q) ||
        String(d.sifra) === q,
    );
  }, [dobavljaci, pretragaDob]);

  // PDV se unosi ručno; ovo je samo upozorenje ako iskazani PDV nije 17%
  // sadržan u ukupnom iznosu (ukupno * 17/117). Ne blokira dodavanje.
  const upozorenjePdv = useMemo(() => {
    const uk = broj(ukupnoIsp);
    const isk = iskazaniPdv.trim() ? broj(iskazaniPdv) : 0;
    if (!Number.isFinite(uk) || uk <= 0 || !Number.isFinite(isk) || isk <= 0) {
      return null;
    }
    const ocekivano = Math.round(((uk * 17) / 117) * 100) / 100;
    if (Math.abs(isk - ocekivano) <= 0.02) return null;
    return `Iskazani PDV nije 17% od ukupnog (očekivano ${formatKM(ocekivano)})`;
  }, [ukupnoIsp, iskazaniPdv]);

  const dodajIsplatu = () => {
    if (!dobavljac) {
      setGreskaForme("Izaberite dobavljača iz liste lijevo");
      return;
    }
    if (!brojRacuna.trim()) {
      setGreskaForme("Unesite broj računa");
      return;
    }
    if (!datumRacuna) {
      setGreskaForme("Unesite datum računa");
      return;
    }
    const uk = broj(ukupnoIsp);
    if (!Number.isFinite(uk) || uk <= 0) {
      setGreskaForme("Ukupno mora biti veće od 0");
      return;
    }
    const isk = iskazaniPdv.trim() ? broj(iskazaniPdv) : 0;
    const ul = ulazniPdv.trim() ? broj(ulazniPdv) : 0;
    if (!Number.isFinite(isk) || isk < 0 || isk > uk) {
      setGreskaForme("Iskazani PDV mora biti između 0 i ukupnog iznosa");
      return;
    }
    if (!Number.isFinite(ul) || ul < 0 || ul > isk) {
      setGreskaForme("Ulazni PDV ne može biti veći od iskazanog");
      return;
    }
    const r2 = (n: number) => Math.round(n * 100) / 100;
    setIsplate((prev) => [
      ...prev,
      {
        kljuc: kljucRef.current++,
        sifra_dobavljaca: Number(dobavljac.sifra),
        naziv_dobavljaca:
          dobavljac.naziv_dobavljaca ?? `Dobavljač #${dobavljac.sifra}`,
        broj_racuna: brojRacuna.trim(),
        datum_racuna: datumRacuna,
        opis: opis.trim(),
        ukupno: r2(uk),
        iskazani_pdv: r2(isk),
        ulazni_pdv: r2(ul),
      },
    ]);
    setDobavljac(null);
    setBrojRacuna("");
    setDatumRacuna("");
    setUkupnoIsp("");
    setIskazaniPdv("");
    setUlazniPdv("");
    setOpis("");
    setGreskaForme(null);
  };

  const ukloniIsplatu = (kljuc: number) =>
    setIsplate((prev) => prev.filter((s) => s.kljuc !== kljuc));

  const izaberiPartnera = (p: Partner) => {
    setPartner(p);
    setPretraga("");
    setPokaziListu(false);
  };

  const odveziRacun = () => {
    if (izabraniRacun) setIznos("");
    setIzabraniRacun(null);
  };

  // Klik na račun popunjava formu: vrsta 1, partner, iznos, opis, veza.
  const izaberiRacun = (r: RacunNeplacen) => {
    const n = Number(r.ukupno);
    setVrsta(1);
    setPartner({
      partner_id: Number(r.sifra_partnera),
      naziv: r.naziv_partnera ?? `Partner #${r.sifra_partnera}`,
      skraceni_naziv: null,
    });
    setPretraga("");
    setIzabraniRacun(r);
    setIznos(Number.isFinite(n) && n > 0 ? n.toFixed(2) : "");
    setOpis(`Uplata po računu ${oznakaRacuna(r)}`);
    setNapomena("Gotovinska uplata");
    setGreskaForme(null);
  };

  // Skener bar koda upisuje sifra_tabele u pretragu i šalje Enter.
  const obradiSkeniranje = () => {
    const kod = pretragaRacuna.trim();
    if (!/^\d+$/.test(kod)) {
      if (filtriraniRacuni.length === 1) {
        izaberiRacun(filtriraniRacuni[0]);
        setPretragaRacuna("");
        setSkenPoruka(null);
      }
      return;
    }
    const sifra = Number(kod);
    if (dodatiRacuni.has(sifra)) {
      setSkenPoruka(`Račun ${kod} je već dodat u stavke`);
    } else {
      const r = racuni.find((x) => Number(x.sifra_tabele) === sifra);
      if (r) {
        izaberiRacun(r);
        setSkenPoruka(null);
      } else {
        setSkenPoruka(`Račun ${kod} nije među neplaćenim gotovinskim računima`);
      }
    }
    setPretragaRacuna("");
  };

  const ocistiFormu = () => {
    setPartner(null);
    setPretraga("");
    setIznos("");
    setIzabraniRacun(null);
    setOpis("");
    setNapomena("");
    setGreskaForme(null);
  };

  const dodajStavku = () => {
    if (!partner || !(partner.partner_id > 0)) {
      setGreskaForme("Izaberite partnera — stavka mora biti vezana za partnera");
      return;
    }
    const iznosBroj = parseFloat(iznos.replace(",", "."));
    if (!Number.isFinite(iznosBroj) || iznosBroj <= 0) {
      setGreskaForme(
        izabraniRacun ? "Izabrani račun nema iznos" : "Unesite iznos veći od 0",
      );
      return;
    }
    setStavke((prev) => [
      ...prev,
      {
        kljuc: kljucRef.current++,
        vrsta_uplate: vrsta,
        sifra_partnera: partner.partner_id,
        naziv_partnera: partner.naziv,
        uplaceno: Math.round(iznosBroj * 100) / 100,
        sifra_veze: izabraniRacun ? Number(izabraniRacun.sifra_tabele) : null,
        veza_prikaz: izabraniRacun
          ? `Račun ${oznakaRacuna(izabraniRacun)}`
          : null,
        opis: opis.trim(),
        napomena: napomena.trim(),
      },
    ]);
    ocistiFormu();
  };

  const ukloniStavku = (kljuc: number) =>
    setStavke((prev) => prev.filter((s) => s.kljuc !== kljuc));

  const sumaNovihUplata = stavke
    .filter((s) => vrstaPoKodu(s.vrsta_uplate).tip === "uplata")
    .reduce((a, s) => a + s.uplaceno, 0);
  const sumaNovihIsplata =
    stavke
      .filter((s) => vrstaPoKodu(s.vrsta_uplate).tip === "isplata")
      .reduce((a, s) => a + s.uplaceno, 0) +
    isplate.reduce((a, s) => a + s.ukupno, 0);
  const brojNovih = stavke.length + isplate.length;

  const azurirajPlacenost = async (
    racuniZaPlacenost: ObradaCuvanja["racuni"],
  ) => {
    if (racuniZaPlacenost.length === 0) {
      setObrada((o) =>
        o && {
          ...o,
          placenost: "nema",
          placenostPoruka: "Nema računa za označavanje.",
        },
      );
      return;
    }
    setObrada((o) => o && { ...o, placenost: "radi", placenostPoruka: null });
    try {
      const res = await fetch(`${API_URL}/api/izvodi/azuriranje-placenosti`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dokumenti: racuniZaPlacenost.map((r) => ({
            tip_dokumenta: "RACUN",
            sifra_dokumenta: r.sifra,
            placen: 1,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        throw new Error(
          d.message || d.error || "Greška pri ažuriranju plaćenosti",
        );
      }
      setObrada((o) =>
        o && {
          ...o,
          placenost: "ok",
          placenostPoruka: `Označeno plaćenim računa: ${d.brojRacuna ?? 0}`,
        },
      );
      void ucitajRacune();
    } catch (e: unknown) {
      setObrada((o) =>
        o && {
          ...o,
          placenost: "greska",
          placenostPoruka:
            e instanceof Error ? e.message : "Greška pri ažuriranju plaćenosti",
        },
      );
    }
  };

  // Šalju se samo nesačuvane stavke; nakon uspjeha iz liste se skidaju
  // tačno poslane (nova stavka dodata tokom slanja ostaje).
  // Redoslijed: 1) uplate (erp.blagajna_uplate_unos), 2) isplate
  // dobavljačima (erp.blagajna_uplate_isplate), 3) plaćenost računa.
  // Ako uplate padnu, ništa dalje se ne šalje.
  const spremi = async () => {
    if (brojNovih === 0 || slanje) return;
    const zaSlanje = stavke;
    const zaIsplate = isplate;
    const poslani = new Set(zaSlanje.map((s) => s.kljuc));
    const poslaneIsp = new Set(zaIsplate.map((s) => s.kljuc));
    const racuniZaPlacenost = zaSlanje
      .filter((s) => s.sifra_veze !== null)
      .map((s) => ({
        sifra: s.sifra_veze as number,
        oznaka: s.veza_prikaz ?? `Račun ${s.sifra_veze}`,
      }));
    setSlanje(true);
    setObrada({
      unos: zaSlanje.length > 0 ? "radi" : "nema",
      unosPoruka: zaSlanje.length > 0 ? null : "Nema uplata za unos.",
      isplate: "ceka",
      isplatePoruka: null,
      placenost: "ceka",
      placenostPoruka: null,
      racuni: racuniZaPlacenost,
    });
    let unosUspio = zaSlanje.length === 0;
    if (zaSlanje.length > 0) try {
      const res = await fetch(`${API_URL}/api/blagajna/uplate-unos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stavke: zaSlanje.map((s) => ({
            vrsta_uplate: s.vrsta_uplate,
            sifra_partnera: s.sifra_partnera,
            uplaceno: s.uplaceno,
            sifra_veze: s.sifra_veze,
            opis: s.opis,
            napomena: s.napomena,
            konto_knjizenja: 0,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        throw new Error(d.message || d.error || "Greška pri unosu stavki");
      }
      const broj = Number(d.broj ?? zaSlanje.length);
      setObrada((o) =>
        o && {
          ...o,
          unos: "ok",
          unosPoruka:
            d.prvaSifra != null
              ? broj === 1
                ? `Sačuvana 1 stavka (šifra uplate ${d.prvaSifra}) — blagajna #${d.sifraBlagajne ?? sifraBlagajne}`
                : `Sačuvano stavki: ${broj} (šifre uplata ${d.prvaSifra}–${d.posljednjaSifra}) — blagajna #${d.sifraBlagajne ?? sifraBlagajne}`
              : `Sačuvano stavki: ${broj} (blagajna #${d.sifraBlagajne ?? sifraBlagajne})`,
        },
      );
      setStavke((prev) => prev.filter((s) => !poslani.has(s.kljuc)));
      void ucitajSacuvane();
      void osvjeziStanje();
      unosUspio = true;
    } catch (e: unknown) {
      setObrada((o) =>
        o && {
          ...o,
          unos: "greska",
          unosPoruka: e instanceof Error ? e.message : "Greška pri unosu stavki",
        },
      );
    }
    if (unosUspio) {
      if (zaIsplate.length === 0) {
        setObrada(
          (o) => o && { ...o, isplate: "nema", isplatePoruka: "Nema isplata za unos." },
        );
      } else {
        setObrada((o) => o && { ...o, isplate: "radi", isplatePoruka: null });
        try {
          const res = await fetch(`${API_URL}/api/blagajna/isplate-unos`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              isplate: zaIsplate.map((s) => ({
                sifra_dobavljaca: s.sifra_dobavljaca,
                datum_racuna: s.datum_racuna,
                opis: s.opis,
                broj_racuna: s.broj_racuna,
                iskazani_pdv: s.iskazani_pdv,
                ulazni_pdv: s.ulazni_pdv,
                ukupno: s.ukupno,
              })),
            }),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.success) {
            throw new Error(d.message || d.error || "Greška pri unosu isplata");
          }
          setObrada(
            (o) =>
              o && {
                ...o,
                isplate: "ok",
                isplatePoruka:
                  d.prvaSifra != null
                    ? `Sačuvano isplata: ${d.broj ?? zaIsplate.length} (šifre ${d.prvaSifra}–${d.posljednjaSifra}) — blagajna #${d.sifraBlagajne ?? sifraBlagajne}`
                    : `Sačuvano isplata: ${d.broj ?? zaIsplate.length} — blagajna #${d.sifraBlagajne ?? sifraBlagajne}`,
              },
          );
          setIsplate((prev) => prev.filter((s) => !poslaneIsp.has(s.kljuc)));
          void ucitajSacuvane();
          void osvjeziStanje();
        } catch (e: unknown) {
          setObrada(
            (o) =>
              o && {
                ...o,
                isplate: "greska",
                isplatePoruka:
                  e instanceof Error ? e.message : "Greška pri unosu isplata",
              },
          );
        }
      }
      await azurirajPlacenost(racuniZaPlacenost);
    }
    setSlanje(false);
  };

  const ponoviPlacenost = async () => {
    if (!obrada || slanje) return;
    setSlanje(true);
    await azurirajPlacenost(obrada.racuni);
    setSlanje(false);
  };

  // Blagajna zatvorena (npr. zatvorena u međuvremenu) — unos nije moguć.
  if (!otvorena || !stanje) {
    return (
      <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <Wallet size={20} style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Unos uplata/isplata
          </h2>
        </div>
        <p className="text-gray-500 dark:text-[#7d7498]">
          Blagajna je zatvorena — otvorite je u Statusu blagajne da nastavite.
        </p>
      </div>
    );
  }

  const pocetno = Number(stanje.pocetak_gotovine) || 0;
  const uplate = stanje.tekuce_uplate ?? 0;
  const tekuceIsplate = stanje.tekuce_isplate ?? 0;

  return (
    <div className="space-y-4">
      {/* Sažetak + Osvježi u istoj visini */}
      <div className="flex flex-wrap items-stretch gap-3">
        {[
          { naziv: "Početno stanje", v: pocetno, boja: undefined },
          { naziv: "Uplate", v: uplate, boja: ACCENT },
          { naziv: "Isplate", v: tekuceIsplate, boja: "#ef4444" },
          {
            naziv: "Obračunato stanje",
            v: stanje.tekuci_obracun ?? pocetno + uplate - tekuceIsplate,
            boja: PRIMARY,
          },
        ].map((s) => (
          <div
            key={s.naziv}
            className="flex-1 min-w-[150px] bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3"
          >
            <div className="text-xs text-gray-400 dark:text-[#5f5878]">
              {s.naziv}
            </div>
            <div
              className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]"
              style={s.boja ? { color: s.boja } : undefined}
            >
              {formatKM(s.v)}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={osvjeziSve}
          disabled={racuniLoading}
          title="Osvježi"
          className="flex items-center justify-center gap-1.5 px-4 rounded-2xl text-xs font-semibold bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-sm text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RotateCcw size={14} className={racuniLoading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {/* Lijevo neplaćeni računi (širina po tabeli), desno od njih forma */}
      <div className="flex flex-wrap lg:flex-nowrap items-start gap-4">
        {/* Forma — u prikazu ide DRUGA (order-2) */}
        <div
          className={`order-2 w-full max-w-[374px] lg:w-[374px] flex-shrink-0 rounded-2xl border-2 shadow-md overflow-hidden transition-colors ${
            jeIsplataDob
              ? "bg-[#fdf0ee] dark:bg-[#3a2430] border-[#ef444455]"
              : "bg-[#f4effa] dark:bg-[#2c2444] border-[#785E9E55]"
          }`}
        >
          <div
            className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase text-center text-white"
            style={{ background: PRIMARY }}
          >
            Blagajna br. {stanje.id}
          </div>

          <div className="p-4 grid gap-3 grid-cols-2">
            {/* Vrsta */}
            <div className="col-span-2">
              <label className={labelCls}>Vrsta uplate</label>
              <select
                value={vrsta}
                onChange={(e) => {
                  setVrsta(Number(e.target.value));
                  odveziRacun();
                  setGreskaForme(null);
                }}
                className={inputCls}
              >
                {VRSTE_UNOS.map((v) => (
                  <option key={v.kod} value={v.kod}>
                    {v.kod} — {v.naziv}
                  </option>
                ))}
              </select>
              <span
                className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={
                  izabranaVrsta.tip === "uplata"
                    ? { background: `${ACCENT}26`, color: ACCENT }
                    : { background: "#ef444420", color: "#ef4444" }
                }
              >
                {izabranaVrsta.tip === "uplata"
                  ? "UPLATA — novac ulazi"
                  : "ISPLATA — novac izlazi"}
              </span>
            </div>

            {jeIsplataDob ? (
              <>
                {/* Dobavljač — bira se iz liste lijevo */}
                <div className="col-span-2">
                  <label className={labelCls}>Dobavljač</label>
                  {dobavljac ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#785E9E] bg-[#785E9E0a]">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                          {dobavljac.naziv_dobavljaca}
                        </span>
                        {dobavljac.JIB && (
                          <span className="block text-[10px] text-gray-400 dark:text-[#5f5878]">
                            JIB {dobavljac.JIB}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDobavljac(null)}
                        title="Promijeni dobavljača"
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] text-xs text-gray-400 dark:text-[#5f5878]">
                      Kliknite dobavljača u listi lijevo.
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Broj računa</label>
                  <input
                    type="text"
                    value={brojRacuna}
                    onChange={(e) => setBrojRacuna(e.target.value)}
                    maxLength={50}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Datum računa</label>
                  <DatumPolje value={datumRacuna} onChange={setDatumRacuna} />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Ukupno (KM)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ukupnoIsp}
                    onChange={(e) => setUkupnoIsp(e.target.value)}
                    placeholder="0,00"
                    className={`${inputCls} text-right font-bold`}
                  />
                </div>

                <div>
                  <label className={labelCls}>Iskazani PDV</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={iskazaniPdv}
                    onChange={(e) => setIskazaniPdv(e.target.value)}
                    placeholder="0,00"
                    className={`${inputCls} text-right`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ulazni PDV</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ulazniPdv}
                    onChange={(e) => setUlazniPdv(e.target.value)}
                    placeholder="0,00"
                    className={`${inputCls} text-right`}
                  />
                </div>
                {upozorenjePdv && (
                  <div className="col-span-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertCircle size={12} />
                    {upozorenjePdv}
                  </div>
                )}
              </>
            ) : (
            <>
            {/* Partner */}
            <div className="col-span-2" ref={pretragaRef}>
              <label className={labelCls}>Partner</label>
              {partner ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#785E9E] bg-[#785E9E0a]">
                  <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 dark:text-[#ede9f6] truncate">
                    {partner.naziv}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                    #{partner.partner_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPartner(null);
                      odveziRacun();
                    }}
                    title="Promijeni partnera"
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
                  />
                  <input
                    type="text"
                    value={pretraga}
                    onChange={(e) => {
                      setPretraga(e.target.value);
                      setPokaziListu(true);
                    }}
                    onFocus={() => setPokaziListu(true)}
                    placeholder={
                      partneriLoading
                        ? "Učitavanje partnera..."
                        : "Pretraga po nazivu ili šifri..."
                    }
                    disabled={partneriLoading}
                    className={`${inputCls} pl-8`}
                  />
                  {pokaziListu && !partneriLoading && (
                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] shadow-lg">
                      {filtriraniPartneri.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400 dark:text-[#5f5878]">
                          Nema rezultata
                        </div>
                      ) : (
                        filtriraniPartneri.map((p) => (
                          <button
                            key={p.partner_id}
                            type="button"
                            onClick={() => izaberiPartnera(p)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                          >
                            <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-[#c5bfd8]">
                              {p.naziv}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                              #{p.partner_id}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vezani račun */}
            <div className="col-span-2">
              <label className={labelCls}>Vezani račun</label>
              {izabraniRacun ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#3a3158]">
                  <span
                    className="flex-1 min-w-0 text-sm font-semibold truncate"
                    style={{ color: PRIMARY }}
                  >
                    {oznakaRacuna(izabraniRacun)}
                    <span className="ml-2 text-[10px] font-normal text-gray-400 dark:text-[#5f5878]">
                      {formatDatum(izabraniRacun.datum_racuna)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={odveziRacun}
                    title="Odveži račun i otključaj ručni unos iznosa"
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-[#3a3158] text-xs text-gray-400 dark:text-[#5f5878]">
                  Bez veze — ručni unos. Klik na račun desno ga veže.
                </div>
              )}
            </div>

            {/* Datum — danas, ne mijenja se */}
            <div>
              <label className={labelCls}>Datum uplate</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={danasPrikaz()}
                  title="Datum uplate je današnji datum"
                  className={`${inputCls} pr-8 bg-gray-100 dark:bg-[#1a1626] cursor-not-allowed`}
                />
                <Lock
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878] pointer-events-none"
                />
              </div>
            </div>

            {/* Iznos */}
            <div>
              <label className={labelCls}>Iznos (KM)</label>
              <input
                type="text"
                inputMode="decimal"
                value={iznos}
                onChange={(e) => setIznos(e.target.value)}
                readOnly={!!izabraniRacun}
                title={
                  izabraniRacun
                    ? "Iznos je preuzet iz računa. Za ručni unos odvežite račun."
                    : undefined
                }
                placeholder="0,00"
                className={`${inputCls} text-right font-bold ${
                  izabraniRacun
                    ? "!bg-gray-100 dark:!bg-[#1a1626] cursor-not-allowed"
                    : ""
                }`}
              />
            </div>
            </>
            )}

            {/* Opis — kod isplata nudi često korištene troškove */}
            <div className="col-span-2">
              <label className={labelCls}>
                {jeIsplataDob ? "Opis računa" : "Opis"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={opis}
                  onChange={(e) => setOpis(e.target.value)}
                  maxLength={254}
                  placeholder={
                    jeIsplataDob
                      ? "Upišite opis ili izaberite trošak"
                      : "npr. Uplata kupca"
                  }
                  className={inputCls}
                />
                {jeIsplataDob && (
                  <button
                    type="button"
                    onClick={() => {
                      setPretragaTroska("");
                      setPokaziTroskove(true);
                    }}
                    title="Izaberi iz često korištenih troškova"
                    className="flex-shrink-0 flex items-center gap-1 px-3 rounded-xl text-xs font-bold text-white hover:brightness-110"
                    style={{ background: PRIMARY }}
                  >
                    <Search size={13} />
                    Troškovi
                  </button>
                )}
              </div>
            </div>

            {/* Napomena */}
            {!jeIsplataDob && (
            <div className="col-span-2">
              <label className={labelCls}>Napomena</label>
              <input
                type="text"
                value={napomena}
                onChange={(e) => setNapomena(e.target.value)}
                maxLength={254}
                className={inputCls}
              />
            </div>
            )}

            <div className="col-span-2 flex flex-wrap items-center gap-3 pt-1">
              {greskaForme && (
                <span className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} />
                  {greskaForme}
                </span>
              )}
              <button
                type="button"
                onClick={jeIsplataDob ? dodajIsplatu : dodajStavku}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
                style={{ background: PRIMARY }}
              >
                <Plus size={15} />
                Dodaj stavku
              </button>
            </div>
          </div>
        </div>

        {/* Vrsta 3: umjesto računa lijevo je lista registrovanih dobavljača.
            Oba panela su uvijek u istoj ćeliji grida (neaktivni je nevidljiv),
            pa lijevi objekat ima istu širinu za 1 i za 3. */}
        <div className="order-1 grid max-w-full flex-shrink-0">
        <div
          aria-hidden={!jeIsplataDob}
          className={`[grid-area:1/1] self-start ${jeIsplataDob ? "" : "invisible"} max-w-full bg-[#fdf0ee] dark:bg-[#3a2430] rounded-2xl border-2 border-[#ef444455] shadow-md overflow-hidden`}
        >
          <div
            className="px-4 py-2 flex flex-wrap items-center gap-3"
            style={{ background: PRIMARY }}
          >
            <span className="flex-1 text-xs font-extrabold tracking-widest uppercase text-white">
              Registrovani dobavljači ({filtriraniDobavljaci.length})
            </span>
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
              />
              <input
                type="text"
                value={pretragaDob}
                onChange={(e) => setPretragaDob(e.target.value)}
                placeholder="Naziv, JIB ili adresa..."
                className={`${inputCls} pl-8`}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setNoviDob({ naziv: pretragaDob.trim(), adresa: "", jib: "" });
                setNoviDobGreska(null);
              }}
              title="Unos novog dobavljača"
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/15 text-white hover:bg-white/25"
            >
              <Plus size={14} />
              Novi
            </button>
          </div>
          {dobavljaciLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400 dark:text-[#5f5878]">
              <Loader2 size={18} className="animate-spin" style={{ color: PRIMARY }} />
              Učitavanje dobavljača...
            </div>
          ) : dobavljaciGreska ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-red-500">
              <AlertCircle size={15} />
              {dobavljaciGreska}
            </div>
          ) : filtriraniDobavljaci.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
              {dobavljaci.length === 0
                ? "Nema registrovanih dobavljača."
                : "Nema dobavljača za tu pretragu."}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-230px)] overflow-auto">
              <table className="table-auto w-full text-sm">
                <thead>
                  <tr>
                    <TH usko>Dobavljač</TH>
                    <TH usko>JIB</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtriraniDobavljaci.map((d) => {
                    const izabran =
                      dobavljac && String(dobavljac.sifra) === String(d.sifra);
                    return (
                      <tr
                        key={d.sifra}
                        onClick={() => izaberiDobavljaca(d)}
                        className={`border-b border-gray-200 dark:border-[#3a3158] cursor-pointer transition-colors ${
                          izabran
                            ? "bg-[#e3d9f7] dark:bg-[#3d3163]"
                            : "hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                        }`}
                      >
                        <td className="px-1.5 py-1 font-bold text-gray-800 dark:text-[#ede9f6]">
                          <span
                            className="block truncate max-w-[260px]"
                            title={d.naziv_dobavljaca ?? undefined}
                          >
                            {d.naziv_dobavljaca ?? `Dobavljač #${d.sifra}`}
                          </span>
                          {d.Adresa_dobavljaca && (
                            <span
                              className="block text-[10px] font-normal text-gray-400 dark:text-[#5f5878] truncate max-w-[260px]"
                              title={d.Adresa_dobavljaca}
                            >
                              {d.Adresa_dobavljaca}
                            </span>
                          )}
                        </td>
                        <td className="px-1.5 py-1 whitespace-nowrap text-gray-600 dark:text-[#c5bfd8] tabular-nums">
                          {d.JIB || "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Neplaćeni gotovinski računi */}
        <div
          aria-hidden={jeIsplataDob}
          className={`[grid-area:1/1] self-start ${jeIsplataDob ? "invisible" : ""} max-w-full bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden`}
        >
          <div
            className="px-4 py-2 flex flex-wrap items-center gap-3"
            style={{ background: PRIMARY }}
          >
            <span className="flex-1 text-xs font-extrabold tracking-widest uppercase text-white">
              Neplaćeni gotovinski računi ({filtriraniRacuni.length})
            </span>
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
              />
              <input
                type="text"
                value={pretragaRacuna}
                onChange={(e) => {
                  setPretragaRacuna(e.target.value);
                  setSkenPoruka(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    obradiSkeniranje();
                  }
                }}
                autoFocus
                placeholder="Skeniraj bar kod / broj računa / partner..."
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>
          {skenPoruka && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle size={13} />
              {skenPoruka}
            </div>
          )}
          {racuniLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400 dark:text-[#5f5878]">
              <Loader2 size={18} className="animate-spin" style={{ color: PRIMARY }} />
              Učitavanje računa...
            </div>
          ) : racuniGreska ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-red-500">
              <AlertCircle size={15} />
              {racuniGreska}
            </div>
          ) : filtriraniRacuni.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
              {racuni.length === 0
                ? "Nema neplaćenih gotovinskih računa."
                : "Nema računa za tu pretragu."}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-230px)] overflow-auto">
              <table className="table-auto w-full text-sm">
                <thead>
                  <tr>
                    <TH usko>Broj računa</TH>
                    <TH usko>Partner</TH>
                    <TH usko>Datum</TH>
                    <TH usko right>Ukupno</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtriraniRacuni.map((r) => {
                    const izabran =
                      izabraniRacun &&
                      String(izabraniRacun.sifra_tabele) ===
                        String(r.sifra_tabele);
                    return (
                      <tr
                        key={r.sifra_tabele}
                        onClick={() => izaberiRacun(r)}
                        className={`border-b border-gray-200 dark:border-[#3a3158] cursor-pointer transition-colors ${
                          izabran
                            ? "bg-[#e3d9f7] dark:bg-[#3d3163]"
                            : "hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                        }`}
                      >
                        <td className="px-1.5 py-1 whitespace-nowrap font-bold text-gray-800 dark:text-[#ede9f6]">
                          {oznakaRacuna(r)}
                          {r.Napomena && (
                            <div
                              className="text-[10px] font-normal text-gray-400 dark:text-[#5f5878] truncate max-w-[170px]"
                              title={r.Napomena}
                            >
                              {r.Napomena}
                            </div>
                          )}
                        </td>
                        <td className="px-1.5 py-1 text-gray-600 dark:text-[#c5bfd8]">
                          <span
                            className="block truncate max-w-[190px]"
                            title={r.naziv_partnera ?? undefined}
                          >
                            {r.naziv_partnera ?? `Partner #${r.sifra_partnera}`}
                          </span>
                        </td>
                        <td className="px-1.5 py-1 whitespace-nowrap text-gray-600 dark:text-[#c5bfd8]">
                          {formatDatum(r.datum_racuna)}
                        </td>
                        <td
                          className="px-1.5 py-1 whitespace-nowrap text-right font-bold"
                          style={{ color: PRIMARY }}
                        >
                          {r.ukupno == null ? "–" : formatKM(r.ukupno)}
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

      {/* Stavke blagajne (desno od forme): nesačuvane na vrhu, pa sačuvane */}
      <div className="order-3 flex-1 min-w-[300px] lg:min-w-0 max-w-full bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        <div
          className="px-4 py-2.5 flex items-center gap-3 text-xs font-extrabold tracking-widest uppercase text-white"
          style={{ background: PRIMARY }}
        >
          <span className="flex-1">
            Stavke blagajne (
            {sacuvaneBlagajne.length + sacuvaneIsplateBlagajne.length + brojNovih})
          </span>
          {brojNovih > 0 && (
            <>
              <span className="text-green-200">+ {formatKM(sumaNovihUplata)}</span>
              <span className="text-red-200">− {formatKM(sumaNovihIsplata)}</span>
            </>
          )}
        </div>

        <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]">
          <button
            type="button"
            onClick={() => void spremi()}
            disabled={slanje || brojNovih === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: ACCENT }}
          >
            {slanje ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Sačuvaj unos
            {brojNovih > 0 && ` (${brojNovih})`}
          </button>
          {brojNovih > 0 && (
            <button
              type="button"
              onClick={() => {
                setStavke([]);
                setIsplate([]);
              }}
              disabled={slanje}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
            >
              Odbaci nesačuvane
            </button>
          )}
          <span className="text-[11px] text-gray-400 dark:text-[#5f5878]">
            {brojNovih === 0
              ? "Nema nesačuvanih stavki."
              : `Nesačuvanih stavki: ${brojNovih}`}
          </span>
        </div>

        {brojNovih === 0 &&
        sacuvaneBlagajne.length === 0 &&
        sacuvaneIsplateBlagajne.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
            Na blagajni još nema stavki
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-sm">
              <thead>
                <tr>
                  <TH>Partner</TH>
                  <TH>Vrsta</TH>
                  <TH>Datum</TH>
                  <TH right>Iznos</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {stavke.map((s) => {
                  const v = vrstaPoKodu(s.vrsta_uplate);
                  const boja = v.tip === "uplata" ? ACCENT : "#ef4444";
                  return (
                    <Fragment key={`N-${s.kljuc}`}>
                    <tr className="bg-amber-50/70 dark:bg-amber-900/15">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <span className="mr-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200">
                          NOVO
                        </span>
                        <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                          {s.naziv_partnera}
                        </span>
                        {s.veza_prikaz && (
                          <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                            {s.veza_prikaz}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-3 py-1 whitespace-nowrap text-xs font-medium"
                        style={{ color: boja }}
                      >
                        {v.tip === "uplata" ? "Uplate" : "Isplate"}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-gray-500 dark:text-[#a99fc2]">
                        {danasPrikaz()}
                      </td>
                      <td
                        className="px-3 py-1 text-right font-bold whitespace-nowrap"
                        style={{ color: boja }}
                      >
                        {v.tip === "isplata" ? "− " : ""}
                        {formatKM(s.uplaceno)}
                      </td>
                      <td className="px-3 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => ukloniStavku(s.kljuc)}
                          disabled={slanje}
                          title="Ukloni stavku"
                          className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {/* Opis (i napomena) u redu ispod */}
                    <tr className="border-b border-gray-200 dark:border-[#3a3158] bg-amber-50/70 dark:bg-amber-900/15">
                      <td
                        colSpan={5}
                        className="px-3 pb-1 pt-0 text-xs text-gray-600 dark:text-[#c5bfd8]"
                      >
                        {s.opis || "–"}
                        {s.napomena && (
                          <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                            {s.napomena}
                          </span>
                        )}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}

                {isplate.map((s) => (
                  <Fragment key={`NI-${s.kljuc}`}>
                    <tr className="bg-amber-50/70 dark:bg-amber-900/15">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <span className="mr-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200">
                          NOVO
                        </span>
                        <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                          {s.naziv_dobavljaca}
                        </span>
                        <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                          Račun {s.broj_racuna}
                        </span>
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-xs font-medium text-red-500">
                        Isplate
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-gray-500 dark:text-[#a99fc2]">
                        {isoUPrikaz(s.datum_racuna)}
                      </td>
                      <td className="px-3 py-1 text-right font-bold whitespace-nowrap text-red-500">
                        − {formatKM(s.ukupno)}
                      </td>
                      <td className="px-3 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => ukloniIsplatu(s.kljuc)}
                          disabled={slanje}
                          title="Ukloni isplatu"
                          className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-[#3a3158] bg-amber-50/70 dark:bg-amber-900/15">
                      <td
                        colSpan={5}
                        className="px-3 pb-1 pt-0 text-xs text-gray-600 dark:text-[#c5bfd8]"
                      >
                        {s.opis || "–"}
                        <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                          Isk. PDV {formatKM(s.iskazani_pdv)} · Ul. PDV{" "}
                          {formatKM(s.ulazni_pdv)}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                ))}

                {sacuvaneIsplateBlagajne.map((i) => (
                  <Fragment key={`I-${i.sifra}`}>
                    <tr className="bg-[#f3eefa] dark:bg-[#2c2444]">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                          {i.naziv_dobavljaca ?? `Dobavljač #${i.sifra_dobavljaca}`}
                        </span>
                        {i.broj_racuna && (
                          <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                            Račun {i.broj_racuna}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-xs font-medium text-red-500">
                        Isplate
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-gray-500 dark:text-[#a99fc2]">
                        {formatDatum(i.datum_racuna)}
                      </td>
                      <td className="px-3 py-1 text-right font-semibold whitespace-nowrap text-red-500">
                        − {formatKM(i.ukupno)}
                      </td>
                      <td className="px-3 py-1" />
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-[#3a3158] bg-[#f3eefa] dark:bg-[#2c2444]">
                      <td
                        colSpan={5}
                        className="px-3 pb-1 pt-0 text-xs text-gray-600 dark:text-[#c5bfd8]"
                      >
                        {i.opis || "–"}
                        <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                          Isk. PDV {formatKM(i.iskazani_pdv)} · Ul. PDV{" "}
                          {formatKM(i.ulazni_pdv)}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                ))}

                {sacuvaneBlagajne.map((u) => {
                  const v = vrstaPoKodu(u.vrsta_uplate);
                  const boja = v.tip === "isplata" ? "#ef4444" : ACCENT;
                  return (
                    <Fragment key={`U-${u.sifra_uplate}`}>
                    <tr className="bg-[#f3eefa] dark:bg-[#2c2444]">
                      <td className="px-3 py-1 whitespace-nowrap text-[15px] font-bold text-gray-900 dark:text-white">
                        {u.naziv_partnera ?? `Partner #${u.sifra_partnera}`}
                      </td>
                      <td
                        className="px-3 py-1 whitespace-nowrap text-xs font-medium"
                        style={{ color: boja }}
                      >
                        {v.tip === "uplata" ? "Uplate" : "Isplate"}
                      </td>
                      <td className="px-3 py-1 whitespace-nowrap text-gray-500 dark:text-[#a99fc2]">
                        {formatDatum(u.datum_uplate)}
                      </td>
                      <td
                        className="px-3 py-1 text-right font-semibold whitespace-nowrap"
                        style={{ color: boja }}
                      >
                        {v.tip === "isplata" ? "− " : ""}
                        {formatKM(u.uplaceno)}
                      </td>
                      <td className="px-3 py-1" />
                    </tr>
                    {/* Opis u redu ispod */}
                    <tr className="border-b border-gray-200 dark:border-[#3a3158] bg-[#f3eefa] dark:bg-[#2c2444]">
                      <td
                        colSpan={5}
                        className="px-3 pb-1 pt-0 text-xs text-gray-600 dark:text-[#c5bfd8]"
                      >
                        {u.opis || "–"}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Izbor troška za opis računa */}
      {pokaziTroskove && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPokaziTroskove(false);
          }}
        >
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden">
            <div
              className="px-4 py-2.5 flex items-center gap-3"
              style={{ background: PRIMARY }}
            >
              <span className="flex-1 text-xs font-extrabold tracking-widest uppercase text-white">
                Često korišteni troškovi ({filtriraniTroskovi.length})
              </span>
              <button
                type="button"
                onClick={() => setPokaziTroskove(false)}
                className="text-white/80 hover:text-white"
                title="Zatvori"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-[#2d2648]">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
                />
                <input
                  type="text"
                  value={pretragaTroska}
                  onChange={(e) => setPretragaTroska(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setPokaziTroskove(false);
                    if (e.key === "Enter" && filtriraniTroskovi.length === 1) {
                      izaberiTrosak(filtriraniTroskovi[0]);
                    }
                  }}
                  autoFocus
                  placeholder="Pretraga troškova..."
                  className={`${inputCls} pl-9 !text-base`}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filtriraniTroskovi.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400 dark:text-[#5f5878]">
                  {troskovi.length === 0
                    ? "Nema unesenih troškova."
                    : "Nema troškova za tu pretragu."}
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filtriraniTroskovi.map((t) => (
                    <button
                      key={t.sifra}
                      type="button"
                      onClick={() => izaberiTrosak(t)}
                      className={`px-4 py-3 rounded-xl text-left text-[15px] font-semibold border transition-colors ${
                        opis === t.naziv_troska
                          ? "border-[#785E9E] bg-[#e3d9f7] dark:bg-[#3d3163] text-gray-900 dark:text-white"
                          : "border-gray-200 dark:border-[#3a3158] text-gray-800 dark:text-[#ede9f6] hover:bg-purple-50 hover:border-[#785E9E] dark:hover:bg-[#2d2648]"
                      }`}
                    >
                      {t.naziv_troska}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Novi dobavljač */}
      {noviDob && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden">
            <div
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase text-white"
              style={{ background: PRIMARY }}
            >
              Novi dobavljač
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={labelCls}>Naziv dobavljača *</label>
                <input
                  type="text"
                  value={noviDob.naziv}
                  onChange={(e) =>
                    setNoviDob((n) => n && { ...n, naziv: e.target.value })
                  }
                  maxLength={150}
                  autoFocus
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Adresa</label>
                <input
                  type="text"
                  value={noviDob.adresa}
                  onChange={(e) =>
                    setNoviDob((n) => n && { ...n, adresa: e.target.value })
                  }
                  maxLength={150}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>JIB</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={noviDob.jib}
                  onChange={(e) =>
                    setNoviDob((n) => n && { ...n, jib: e.target.value })
                  }
                  maxLength={13}
                  className={inputCls}
                />
              </div>
              {noviDobGreska && (
                <p className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} />
                  {noviDobGreska}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNoviDob(null)}
                  disabled={noviDobSlanje}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={() => void sacuvajNovogDobavljaca()}
                  disabled={noviDobSlanje}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                  style={{ background: PRIMARY }}
                >
                  {noviDobSlanje ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Sačuvaj dobavljača
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tok čuvanja: unos stavki, pa ažuriranje plaćenosti računa */}
      {obrada && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl p-5">
            <p className="text-sm font-bold text-gray-800 dark:text-[#ede9f6] mb-4">
              Čuvanje unosa
            </p>
            <div className="space-y-4">
              <KorakObrade
                status={obrada.unos}
                naslov="Unos uplata u blagajnu"
                poruka={obrada.unosPoruka}
              />
              <KorakObrade
                status={obrada.isplate}
                naslov="Unos isplata dobavljačima"
                poruka={obrada.isplatePoruka}
              />
              <KorakObrade
                status={obrada.placenost}
                naslov="Označavanje računa plaćenim"
                poruka={obrada.placenostPoruka}
              />
            </div>

            {obrada.unos === "greska" && (
              <p className="mt-4 text-xs text-gray-500 dark:text-[#7d7498]">
                Ništa nije sačuvano. Stavke su ostale u listi.
              </p>
            )}
            {obrada.isplate === "greska" && (
              <div className="mt-4 px-3 py-2 rounded-xl text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400">
                Isplate NISU sačuvane i ostale su u listi — ispravite pa ponovo
                kliknite Sačuvaj unos.
              </div>
            )}
            {obrada.placenost === "greska" && (
              <div className="mt-4 px-3 py-2 rounded-xl text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400">
                Uplate JESU sačuvane, ali ovi računi NISU označeni plaćenim:{" "}
                {obrada.racuni.map((x) => x.oznaka).join(", ")}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              {obrada.placenost === "greska" && (
                <button
                  type="button"
                  onClick={() => void ponoviPlacenost()}
                  disabled={slanje}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: PRIMARY }}
                >
                  Pokušaj ponovo
                </button>
              )}
              <button
                type="button"
                onClick={() => setObrada(null)}
                disabled={slanje}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
