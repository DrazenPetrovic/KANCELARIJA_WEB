import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatKM, type IzvodRed } from "./IzvodiPregled";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Šifarnik vrsta_uplate za unos na izvod (1–12).
// tip: "uplata" = novac ulazi na račun, "isplata" = izlazi.
// partner: koga operater bira — kupac, dobavljač ili bilo koji partner
// (pozajmice). veza: za koje vrste se kasnije bira dokument čija se
// šifra upisuje u sifra_veze (račun kupca, kalkulacija, KUF).
interface VrstaUplate {
  kod: number;
  naziv: string;
  tip: "uplata" | "isplata";
  partner: "kupac" | "dobavljac" | "partner";
  veza?: "racun" | "kalkulacija" | "kuf";
}

const VRSTE_UPLATE_UNOS: VrstaUplate[] = [
  { kod: 1, naziv: "Uplate kupaca", tip: "uplata", partner: "kupac", veza: "racun" },
  { kod: 2, naziv: "Uplata dobavljačima (kalk)", tip: "isplata", partner: "dobavljac", veza: "kalkulacija" },
  { kod: 3, naziv: "Uplata (KUF)", tip: "isplata", partner: "dobavljac", veza: "kuf" },
  { kod: 4, naziv: "Dugovanja (dobavljaču)", tip: "isplata", partner: "dobavljac" },
  { kod: 5, naziv: "Davanje pozajmice", tip: "isplata", partner: "partner" },
  { kod: 6, naziv: "Vraćanje date pozajmice", tip: "uplata", partner: "partner" },
  { kod: 7, naziv: "Primanje pozajmice", tip: "uplata", partner: "partner" },
  { kod: 8, naziv: "Vraćanje primljene pozajmice", tip: "isplata", partner: "partner" },
  { kod: 9, naziv: "Povrat pretplate (dobavljaču pogrešna uplata)", tip: "isplata", partner: "dobavljac" },
  { kod: 10, naziv: "Prijem pretplate (kupac vraća pogrešnu uplatu)", tip: "uplata", partner: "kupac" },
  { kod: 11, naziv: "Prijem pretplate dobavljača", tip: "uplata", partner: "dobavljac" },
  { kod: 12, naziv: "Povrat pretplate kupcu (pogrešna uplata)", tip: "isplata", partner: "kupac" },
];

const vrstaPoKodu = (kod: number) =>
  VRSTE_UPLATE_UNOS.find((v) => v.kod === kod) ?? VRSTE_UPLATE_UNOS[0];

const NAZIV_VEZE: Record<NonNullable<VrstaUplate["veza"]>, string> = {
  racun: "račun kupca",
  kalkulacija: "kalkulaciju",
  kuf: "ulazni račun (KUF)",
};

const OZNAKA_PARTNERA: Record<VrstaUplate["partner"], string> = {
  kupac: "Kupac",
  dobavljac: "Dobavljač",
  partner: "Partner",
};

interface Partner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
}

// Red iz erp.racuni_gl_istorija_pojedinacni_pregled (GET /api/racuni/istorija).
interface RacunKupca {
  sifra_tabele: number;
  broj_racuna: number | string;
  vrsta_racuna: string | null;
  datum_racuna: string | null;
  vrsta_racuna_novi: string | number | null;
  vrsta_racuna_pod: string | number | null;
}

// "YYYY-MM-DD ..." -> "dd.MM.yyyy"
const prikazDatumaRacuna = (v: string | null) => {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (v ?? "–");
};

// Stavka pripremljena za slanje — polja kao u JSON-u za
// erp.izvodi_uplate_unos. sifra_radnika i vreme_uplate dodaje server;
// naziv_partnera je samo za prikaz.
interface NovaStavka {
  kljuc: number;
  vrsta_uplate: number;
  sifra_partnera: number;
  naziv_partnera: string;
  datum_uplate: string;
  uplaceno: number;
  sifra_veze: number;
  // Samo za prikaz — broj izabranog računa (ne šalje se).
  veza_prikaz: string | null;
  opis: string;
  napomena: string;
  sifra_blagajne: number;
  dozvoli_storniranje: number;
  konto_knjizenja: number;
}

// Današnji datum u formatu dd.MM.yyyy.
const danasTekst = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

// Maska dok operater kuca: samo cifre, tačke se ubacuju automatski
// (ddMMyyyy -> dd.MM.yyyy).
const maskirajDatum = (unos: string) => {
  const c = unos.replace(/\D/g, "").slice(0, 8);
  if (c.length <= 2) return c;
  if (c.length <= 4) return `${c.slice(0, 2)}.${c.slice(2)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4)}`;
};

// "dd.MM.yyyy" -> "yyyy-MM-dd" za server; null ako datum ne postoji
// (npr. 31.02.2026).
const tekstUIso = (t: string) => {
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    d.getFullYear() !== Number(yyyy) ||
    d.getMonth() !== Number(mm) - 1 ||
    d.getDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
};

const prikazDatuma = (iso: string) => {
  const [g, m, d] = iso.split("-");
  return g && m && d ? `${d}.${m}.${g}.` : iso;
};

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelCls = "block text-xs text-gray-500 dark:text-[#7d7498] mb-1";

export function IzvodiUnosForma({
  izvod,
  onSpremljeno,
}: {
  izvod: IzvodRed;
  onSpremljeno: () => void;
}) {
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [partneriLoading, setPartneriLoading] = useState(true);

  // Polja forme
  const [vrsta, setVrsta] = useState(1);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [pokaziListu, setPokaziListu] = useState(false);
  // Uvijek počinje od današnjeg datuma; operater ga može izmijeniti, a
  // izmijenjeni datum ostaje i za sljedeće stavke.
  const [datum, setDatum] = useState(danasTekst);
  const [iznos, setIznos] = useState("");
  const [sifraVeze, setSifraVeze] = useState("");
  const [opis, setOpis] = useState("");
  const [napomena, setNapomena] = useState("");
  const [dozvoliStorniranje, setDozvoliStorniranje] = useState(true);
  const [greskaForme, setGreskaForme] = useState<string | null>(null);

  // Stavke spremne za slanje
  const [stavke, setStavke] = useState<NovaStavka[]>([]);
  const [slanje, setSlanje] = useState(false);
  const [greskaSlanja, setGreskaSlanja] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);

  // Izbor računa kupca (vrsta 1) — sifra_tabele računa ide u sifra_veze.
  const [izborRacunaOtvoren, setIzborRacunaOtvoren] = useState(false);
  const [racuni, setRacuni] = useState<RacunKupca[]>([]);
  const [racuniLoading, setRacuniLoading] = useState(false);
  const [racuniGreska, setRacuniGreska] = useState<string | null>(null);
  const [pretragaRacuna, setPretragaRacuna] = useState("");
  const [izabraniRacun, setIzabraniRacun] = useState<RacunKupca | null>(null);

  const pretragaRef = useRef<HTMLDivElement>(null);
  const kljucRef = useRef(1);

  const izabranaVrsta = vrstaPoKodu(vrsta);

  const otvoriIzborRacuna = async () => {
    if (!partner) return;
    setIzborRacunaOtvoren(true);
    setPretragaRacuna("");
    setRacuniLoading(true);
    setRacuniGreska(null);
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/istorija?sifraPartnera=${partner.partner_id}&sve=1`,
        { credentials: "include" },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) {
        throw new Error(d.error || d.message || "Greška pri učitavanju računa");
      }
      setRacuni(d.data ?? []);
    } catch (e: unknown) {
      setRacuni([]);
      setRacuniGreska(
        e instanceof Error ? e.message : "Greška pri učitavanju računa",
      );
    } finally {
      setRacuniLoading(false);
    }
  };

  const izaberiRacun = (r: RacunKupca) => {
    setIzabraniRacun(r);
    setSifraVeze(String(r.sifra_tabele));
    if (!opis.trim()) setOpis(`Uplata po računu ${r.broj_racuna}`);
    setIzborRacunaOtvoren(false);
  };

  const filtriraniRacuni = useMemo(() => {
    const q = pretragaRacuna.trim().toLowerCase();
    if (!q) return racuni;
    return racuni.filter(
      (r) =>
        String(r.broj_racuna).includes(q) ||
        String(r.sifra_tabele).includes(q) ||
        String(r.vrsta_racuna ?? "").toLowerCase().includes(q),
    );
  }, [racuni, pretragaRacuna]);

  useEffect(() => {
    fetch(`${API_URL}/api/partneri/lista-sve`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setPartneri(json.data ?? json ?? []))
      .catch(() => setPartneri([]))
      .finally(() => setPartneriLoading(false));
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

  const izaberiPartnera = (p: Partner) => {
    setPartner(p);
    setPretraga("");
    setPokaziListu(false);
  };

  const ocistiFormu = () => {
    setPartner(null);
    setPretraga("");
    setIznos("");
    setSifraVeze("");
    setIzabraniRacun(null);
    setOpis("");
    setNapomena("");
    setDozvoliStorniranje(true);
    setGreskaForme(null);
  };

  const dodajStavku = () => {
    setUspjeh(null);
    const iznosBroj = parseFloat(iznos.replace(",", "."));
    if (!partner) {
      setGreskaForme(
        `Izaberite ${{ kupac: "kupca", dobavljac: "dobavljača", partner: "partnera" }[izabranaVrsta.partner]}`,
      );
      return;
    }
    if (!Number.isFinite(iznosBroj) || iznosBroj <= 0) {
      setGreskaForme("Unesite iznos veći od 0");
      return;
    }
    const datumIso = tekstUIso(datum);
    if (!datumIso) {
      setGreskaForme("Datum uplate mora biti u formatu dd.MM.yyyy");
      return;
    }
    const veza = sifraVeze.trim() === "" ? 0 : parseInt(sifraVeze, 10);
    if (!Number.isInteger(veza) || veza < 0) {
      setGreskaForme("Šifra veze mora biti cijeli broj");
      return;
    }
    setStavke((prev) => [
      ...prev,
      {
        kljuc: kljucRef.current++,
        vrsta_uplate: vrsta,
        sifra_partnera: partner.partner_id,
        naziv_partnera: partner.naziv,
        datum_uplate: datumIso,
        uplaceno: Math.round(iznosBroj * 100) / 100,
        sifra_veze: veza,
        veza_prikaz:
          izabraniRacun && String(izabraniRacun.sifra_tabele) === String(veza)
            ? `Račun ${izabraniRacun.broj_racuna}`
            : null,
        opis: opis.trim(),
        napomena: napomena.trim(),
        sifra_blagajne: izvod.redni_broj,
        dozvoli_storniranje: dozvoliStorniranje ? 1 : 0,
        konto_knjizenja: 0,
      },
    ]);
    ocistiFormu();
  };

  const ukloniStavku = (kljuc: number) =>
    setStavke((prev) => prev.filter((s) => s.kljuc !== kljuc));

  const sumaUplata = stavke
    .filter((s) => vrstaPoKodu(s.vrsta_uplate).tip === "uplata")
    .reduce((a, s) => a + s.uplaceno, 0);
  const sumaIsplata = stavke
    .filter((s) => vrstaPoKodu(s.vrsta_uplate).tip === "isplata")
    .reduce((a, s) => a + s.uplaceno, 0);

  const spremi = async () => {
    if (stavke.length === 0) return;
    setSlanje(true);
    setGreskaSlanja(null);
    setUspjeh(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/uplate-unos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stavke: stavke.map((s) => ({
            vrsta_uplate: s.vrsta_uplate,
            sifra_partnera: s.sifra_partnera,
            datum_uplate: s.datum_uplate,
            uplaceno: s.uplaceno,
            sifra_veze: s.sifra_veze,
            opis: s.opis,
            napomena: s.napomena,
            sifra_blagajne: s.sifra_blagajne,
            dozvoli_storniranje: s.dozvoli_storniranje,
            konto_knjizenja: s.konto_knjizenja,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) {
        throw new Error(d.message || d.error || "Greška pri unosu stavki");
      }
      const broj = Number(d.broj ?? stavke.length);
      setUspjeh(
        d.prvaSifra != null
          ? broj === 1
            ? `Spremljena 1 stavka (šifra uplate ${d.prvaSifra})`
            : `Spremljeno stavki: ${broj} (šifre uplata ${d.prvaSifra}–${d.posljednjaSifra})`
          : `Spremljeno stavki: ${broj}`,
      );
      setStavke([]);
      onSpremljeno();
    } catch (e: unknown) {
      setGreskaSlanja(
        e instanceof Error ? e.message : "Greška pri unosu stavki",
      );
    } finally {
      setSlanje(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Forma */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        <div
          className="px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase"
          style={{ background: `${PRIMARY}0a`, color: PRIMARY }}
        >
          Nova stavka — izvod #{izvod.sifra_izvoda}
        </div>

        <div className="p-4 grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {/* Vrsta uplate */}
          <div className="md:col-span-2">
            <label className={labelCls}>Vrsta uplate</label>
            <select
              value={vrsta}
              onChange={(e) => {
                setVrsta(Number(e.target.value));
                setSifraVeze("");
                setIzabraniRacun(null);
              }}
              className={inputCls}
            >
              {VRSTE_UPLATE_UNOS.map((v) => (
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

          {/* Partner */}
          <div className="md:col-span-2" ref={pretragaRef}>
            <label className={labelCls}>
              {OZNAKA_PARTNERA[izabranaVrsta.partner]}
            </label>
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
                    setSifraVeze("");
                    setIzabraniRacun(null);
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

          {/* Veza (račun / kalkulacija / KUF) */}
          <div className="md:col-span-2">
            <label className={labelCls}>
              Šifra veze
              {izabranaVrsta.veza && ` (${NAZIV_VEZE[izabranaVrsta.veza]})`}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={sifraVeze}
                onChange={(e) => setSifraVeze(e.target.value)}
                placeholder="0"
                className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
              />
              {izabranaVrsta.veza === "racun" && (
                // Računi izabranog kupca — sifra_tabele računa ide u sifra_veze.
                <button
                  type="button"
                  onClick={() => void otvoriIzborRacuna()}
                  disabled={!partner}
                  title={
                    partner
                      ? "Pregled računa izabranog kupca"
                      : "Prvo izaberite kupca"
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:disabled:border-[#3a3158] dark:disabled:text-[#5f5878] enabled:hover:bg-purple-50 dark:enabled:hover:bg-[#2d2648]"
                  style={partner ? { borderColor: PRIMARY, color: PRIMARY } : undefined}
                >
                  <FileSearch size={13} />
                  Izaberi {NAZIV_VEZE.racun}
                </button>
              )}
              {(izabranaVrsta.veza === "kalkulacija" ||
                izabranaVrsta.veza === "kuf") && (
                // Izbor kalkulacije / KUF-a — dolazi kad stigne procedura.
                <button
                  type="button"
                  disabled
                  title="Izbor dokumenta dobavljača dolazi u sljedećem koraku"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-400 dark:text-[#5f5878] whitespace-nowrap cursor-not-allowed"
                >
                  <FileSearch size={13} />
                  Izaberi {NAZIV_VEZE[izabranaVrsta.veza]}
                </button>
              )}
            </div>
            {izabraniRacun &&
              String(izabraniRacun.sifra_tabele) === sifraVeze && (
                <div className="mt-1 text-[11px]" style={{ color: PRIMARY }}>
                  Račun {izabraniRacun.broj_racuna} od{" "}
                  {prikazDatumaRacuna(izabraniRacun.datum_racuna)}
                </div>
              )}
          </div>

          {/* Datum */}
          <div>
            <label className={labelCls}>Datum uplate</label>
            <input
              type="text"
              inputMode="numeric"
              value={datum}
              onChange={(e) => setDatum(maskirajDatum(e.target.value))}
              placeholder="dd.MM.yyyy"
              maxLength={10}
              className={inputCls}
            />
          </div>

          {/* Iznos */}
          <div>
            <label className={labelCls}>Iznos (KM)</label>
            <input
              type="text"
              inputMode="decimal"
              value={iznos}
              onChange={(e) => setIznos(e.target.value)}
              placeholder="0,00"
              className={`${inputCls} text-right font-bold`}
            />
          </div>

          {/* Opis */}
          <div className="md:col-span-2">
            <label className={labelCls}>Opis</label>
            <input
              type="text"
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              maxLength={254}
              placeholder="npr. Uplata po računu"
              className={inputCls}
            />
          </div>

          {/* Napomena */}
          <div className="md:col-span-2">
            <label className={labelCls}>Napomena</label>
            <input
              type="text"
              value={napomena}
              onChange={(e) => setNapomena(e.target.value)}
              maxLength={254}
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#9e96b8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dozvoliStorniranje}
                onChange={(e) => setDozvoliStorniranje(e.target.checked)}
                className="accent-[#785E9E]"
              />
              Dozvoli storniranje
            </label>

            {greskaForme && (
              <span className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle size={13} />
                {greskaForme}
              </span>
            )}

            <button
              type="button"
              onClick={dodajStavku}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: PRIMARY }}
            >
              <Plus size={15} />
              Dodaj stavku
            </button>
          </div>
        </div>
      </div>

      {/* Izbor računa kupca */}
      {izborRacunaOtvoren && partner && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIzborRacunaOtvoren(false);
          }}
        >
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-3 border-b border-gray-100 dark:border-[#2d2648]">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${PRIMARY}14` }}
              >
                <FileSearch size={18} style={{ color: PRIMARY }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  Računi kupca
                </p>
                <p className="text-xs text-gray-500 dark:text-[#7d7498] truncate">
                  {partner.naziv} · #{partner.partner_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIzborRacunaOtvoren(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[#c5bfd8]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 dark:border-[#2d2648]">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
                />
                <input
                  type="text"
                  value={pretragaRacuna}
                  onChange={(e) => setPretragaRacuna(e.target.value)}
                  placeholder="Pretraga po broju računa..."
                  autoFocus
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {racuniLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-[#5f5878]">
                  <Loader2
                    size={18}
                    className="animate-spin"
                    style={{ color: PRIMARY }}
                  />
                  Učitavanje računa...
                </div>
              ) : racuniGreska ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-red-500">
                  <AlertCircle size={15} />
                  {racuniGreska}
                </div>
              ) : filtriraniRacuni.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-[#5f5878]">
                  {racuni.length === 0
                    ? "Kupac nema računa."
                    : "Nema računa za tu pretragu."}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white dark:bg-[#261f38]">
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                      <th className="text-left px-5 py-2">Broj računa</th>
                      <th className="text-left px-3 py-2">Datum</th>
                      <th className="text-left px-3 py-2">Vrsta</th>
                      <th className="text-right px-5 py-2">Šifra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtriraniRacuni.map((r) => {
                      const izabran =
                        String(r.sifra_tabele) === sifraVeze;
                      return (
                        <tr
                          key={r.sifra_tabele}
                          onClick={() => izaberiRacun(r)}
                          className={`border-t border-gray-50 dark:border-[#2d2648] text-sm cursor-pointer transition-colors ${
                            izabran
                              ? "bg-[#e3d9f7] dark:bg-[#3d3163]"
                              : "hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                          }`}
                        >
                          <td className="px-5 py-2 font-semibold text-gray-800 dark:text-[#ede9f6]">
                            {r.broj_racuna}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-[#a99fc2] whitespace-nowrap">
                            {prikazDatumaRacuna(r.datum_racuna)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-[#c5bfd8]">
                            {r.vrsta_racuna ?? "–"}
                          </td>
                          <td className="px-5 py-2 text-right text-gray-400 dark:text-[#5f5878]">
                            {r.sifra_tabele}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-2.5 text-[11px] text-gray-400 dark:text-[#5f5878] border-t border-gray-100 dark:border-[#2d2648]">
              Klik na račun upisuje njegovu šifru u polje „Šifra veze“.
            </div>
          </div>
        </div>
      )}

      {uspjeh && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400">
          <CheckCircle2 size={15} />
          {uspjeh}
        </div>
      )}

      {/* Stavke za slanje */}
      {stavke.length > 0 && (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: `${PRIMARY}40` }}>
          <div
            className="px-4 py-2.5 flex items-center gap-3 text-[10px] font-bold tracking-widest uppercase"
            style={{ background: `${PRIMARY}0a`, color: PRIMARY }}
          >
            <span className="flex-1">
              Za unos ({stavke.length}) — još nije spremljeno
            </span>
            <span style={{ color: ACCENT }}>+ {formatKM(sumaUplata)}</span>
            <span className="text-red-500">− {formatKM(sumaIsplata)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                  <th className="text-left px-3 py-2">Vrsta</th>
                  <th className="text-left px-3 py-2">Partner</th>
                  <th className="text-left px-3 py-2">Datum</th>
                  <th className="text-right px-3 py-2">Iznos</th>
                  <th className="text-left px-3 py-2">Veza</th>
                  <th className="text-left px-3 py-2">Opis / napomena</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {stavke.map((s) => {
                  const v = vrstaPoKodu(s.vrsta_uplate);
                  return (
                    <tr
                      key={s.kljuc}
                      className="border-t border-gray-50 dark:border-[#2d2648] text-sm"
                    >
                      <td
                        className="px-3 py-2 whitespace-nowrap font-medium"
                        style={{ color: v.tip === "uplata" ? ACCENT : "#ef4444" }}
                      >
                        {v.kod} — {v.naziv}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-[#c5bfd8]">
                        {s.naziv_partnera}
                        <span className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                          {" "}
                          #{s.sifra_partnera}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-[#a99fc2]">
                        {prikazDatuma(s.datum_uplate)}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-bold whitespace-nowrap"
                        style={{ color: v.tip === "uplata" ? ACCENT : "#ef4444" }}
                      >
                        {v.tip === "isplata" ? "− " : ""}
                        {formatKM(s.uplaceno)}
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-[#a99fc2]">
                        {s.veza_prikaz ?? (s.sifra_veze || "–")}
                        {s.veza_prikaz && (
                          <div className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                            šifra {s.sifra_veze}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-[#c5bfd8]">
                        {s.opis || "–"}
                        {s.napomena && (
                          <div className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                            {s.napomena}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
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
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-[#2d2648]">
            {greskaSlanja && (
              <span className="flex items-center gap-1.5 text-xs text-red-500 flex-1">
                <AlertCircle size={13} className="flex-shrink-0" />
                {greskaSlanja}
              </span>
            )}
            <button
              type="button"
              onClick={() => setStavke([])}
              disabled={slanje}
              className="ml-auto px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
            >
              Odbaci sve
            </button>
            <button
              type="button"
              onClick={spremi}
              disabled={slanje}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {slanje ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Spremi {stavke.length}{" "}
              {stavke.length === 1 ? "stavku" : "stavki"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
