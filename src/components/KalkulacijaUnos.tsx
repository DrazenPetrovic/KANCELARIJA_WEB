import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const SIROVINA_BOJA = "#b45309";
const PDV_STOPA = 0.17;
// TEST režim: "Zaključi kalkulaciju" samo preuzima JSON koji bi išao
// proceduri, bez upisa u bazu. Isključiti (false) čim se procedura poveže —
// inače bi svako zaključenje ostavljalo fajl u Downloads.
const TEST_SAMO_JSON = true;
// Šifra države BiH (domaći partner) — vidi erp.sp_partneri_drzave i
// SIFRA_DRZAVE_BIH u racuniZiralni. Sve ostale države su ino.
const SIFRA_DRZAVE_BIH = 1;

// Red sa /api/partneri/lista-sve (isti izvor kao PartneriPregled).
interface Partner {
  partner_id: number;
  naziv: string;
  jib: string | null;
  pib: string | null;
  pdv_obveznik: number | string | null;
  tip_partnera: string | null;
  adresa: string | null;
  grad: string | null;
  drzava: string | null;
  valuta_placanja: number | null;
  aktivan: number | string | null;
}

interface Drzava {
  sifra_drzave: number;
  naziv_drzave: string;
}

// Red sa erp.artikli_pregled_sve (/api/artikli/pregled-sve) — za razliku od
// /api/artikli vraća i sirovine, a kalkulacija mora moći da zaprimi oboje.
interface Artikal {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  nabavna_cijena: number | string;
  kolicina_proizvoda: number | string;
  barkod: string;
  vrsta_proizvoda: number | string;
  sirovina?: number | string | null;
  [key: string]: unknown;
}

// Jedna kalkulacija je ili ulaz sirovine ili ulaz robe — ne miješaju se.
// Sirovina nema VPC, pa se za nju VPC ne unosi niti šalje.
type VrstaKalkulacije = "sirovina" | "roba";

interface StavkaKalkulacije {
  id: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  cijena: number;
  rabat: number;
  akcijskiRabat: number;
  fakturnaCijena: number;
  vpc: number;
}

// Red sa erp.kalkulacija_zavisan_trosak_vrste
// (/api/kalkulacije/zavisni-troskovi/vrste).
interface VrstaTroska {
  sifra: number;
  naziv_zavisnog_troska: string;
}

// Tip dokumenta za elektronsku KUF (isti šifarnik kao TIP_DOKUMENTA_NAZIV u
// Kuf.tsx); u bazu ide šifra ("01"...).
const TIP_DOKUMENTA = [
  { sifra: "01", naziv: "Ulazne fakture za robu i usluge iz zemlje" },
  { sifra: "02", naziv: "Ulazna faktura za vlastitu potrošnju" },
  { sifra: "03", naziv: "Ulazna faktura – avansna (Dati avansi)" },
  { sifra: "04", naziv: "JCI (Uvoz)" },
  {
    sifra: "05",
    naziv: "Ostalo (Fakture za usluge primljene iz inostranstva itd)",
  },
];

// PDV na vezani trošak bira operater: bez PDV-a, domaći ili ino PDV.
type PdvTroska = "bez" | "domaci" | "ino";

// Vezani (zavisni) trošak — zaseban račun (prevoz, carinjenje, taksa...) koji
// povećava nabavnu cijenu proizvoda sa kalkulacije. Kalkulacija ih može imati
// više.
interface VezaniTrosak {
  id: number;
  sifraVrste: number;
  nazivVrste: string;
  partnerId: number;
  nazivPartnera: string;
  tipDokumenta: string;
  datum: string;
  brojRacuna: string;
  napomena: string;
  iznos: number;
  pdv: PdvTroska;
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6] disabled:opacity-50";
// Polja samo za čitanje (nabavna, zadnje fakturisano, zaključana VPC) —
// prozirna siva podloga bez okvira, da je jasno da se u njih ne unosi.
const samoCitanjeClass =
  "w-full px-3 py-2.5 text-sm rounded-xl border border-dashed border-white/50 bg-black/20 text-white/90 tabular-nums cursor-not-allowed select-none focus:outline-none";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";
const karticaClass =
  "bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3";

const broj = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

const formatBroj = (v: number, decimale = 2) =>
  v.toLocaleString("bs-BA", {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  });

const p2 = (n: number) => String(n).padStart(2, "0");

const preuzmiJson = (podaci: unknown, nazivFajla: string) => {
  const blob = new Blob([JSON.stringify(podaci, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nazivFajla;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Datum valute = datum kalkulacije + dogovorena valuta partnera (dani).
const dodajDane = (datum: string, dani: number) => {
  const d = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dani);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// Vrste (vidi VRSTA_OPCIJE u ArtikliUnos): 0 sirovina, 1 proizvodi, 2 roba,
// 3 usluga.
const jeSirovina = (a: Artikal) =>
  Number(a.vrsta_proizvoda) === 0 || Number(a.sirovina ?? 0) === 1;

const imaStanje = (a: Artikal) => broj(a.kolicina_proizvoda) > 0;

// Rabati se obračunavaju kaskadno: prvo redovni, pa akcijski na ostatak.
const fakturnaCijena = (cijena: number, rabat: number, akcijski: number) =>
  round4(cijena * (1 - rabat / 100) * (1 - akcijski / 100));

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

const formatDatumDMY = (iso: string) => {
  const [g, m, d] = iso.split("-");
  return g && m && d ? `${d}.${m}.${g}` : null;
};

// Datum se uvijek prikazuje kao dd.MM.yyyy, a klik bilo gdje u polju otvara
// kalendar (isti obrazac kao filteri u KalkulacijePregled).
function DatumPolje({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const otvoriPicker = () => {
    const input = ref.current;
    if (!input || disabled) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };
  return (
    <div
      className={`relative ${disabled ? "" : "cursor-pointer"}`}
      onClick={otvoriPicker}
    >
      <input
        ref={ref}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: "transparent" }}
        className={`${inputClass} ${disabled ? "" : "cursor-pointer"}`}
      />
      <div
        className={`absolute inset-0 flex items-center px-3 text-sm tabular-nums pointer-events-none ${
          value
            ? "text-gray-800 dark:text-[#ede9f6]"
            : "text-gray-400 dark:text-[#6f6890]"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {formatDatumDMY(value) ?? "dd.mm.gggg"}
      </div>
    </div>
  );
}

const Znacka = ({ tekst, boja }: { tekst: string; boja: string }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold text-white"
    style={{ background: boja }}
  >
    {tekst}
  </span>
);

const TH = ({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-1.5 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ backgroundColor: PRIMARY, borderBottom: `2px solid ${ACCENT}` }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) => (
  <td
    className={`px-1.5 py-1.5 text-sm whitespace-nowrap border-b border-gray-200 dark:border-[#453a68] text-gray-700 dark:text-[#c5bfd8] ${right ? "text-right tabular-nums" : ""} ${className}`}
  >
    {children}
  </td>
);

const pdvTroska = (t: Pick<VezaniTrosak, "iznos" | "pdv">) =>
  t.pdv === "bez" ? 0 : round2(t.iznos * PDV_STOPA);

const PDV_TROSKA_NAZIV: Record<PdvTroska, string> = {
  bez: "Bez PDV",
  domaci: "Domaći PDV",
  ino: "INO PDV",
};

const izborDugmeClass = (aktivno: boolean) =>
  `px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
    aktivno
      ? "text-white"
      : "text-gray-600 dark:text-[#c5bfd8] border-gray-200 dark:border-[#3a3158]"
  }`;
const izborDugmeStyle = (aktivno: boolean, boja = PRIMARY) =>
  aktivno ? { background: boja, borderColor: boja } : {};

function VezaniTrosakModal({
  partneri,
  vrste,
  pocetni,
  onSacuvaj,
  onZatvori,
}: {
  partneri: Partner[];
  vrste: VrstaTroska[];
  pocetni: VezaniTrosak | null;
  onSacuvaj: (t: Omit<VezaniTrosak, "id">) => void;
  onZatvori: () => void;
}) {
  const [sifraVrste, setSifraVrste] = useState(
    pocetni ? String(pocetni.sifraVrste) : "",
  );
  const [partner, setPartner] = useState<Partner | null>(
    pocetni
      ? (partneri.find((p) => p.partner_id === pocetni.partnerId) ?? null)
      : null,
  );
  const [pretraga, setPretraga] = useState(pocetni?.nazivPartnera ?? "");
  const [lista, setLista] = useState(false);
  const [oznacen, setOznacen] = useState(0);
  const [tipDokumenta, setTipDokumenta] = useState(
    pocetni?.tipDokumenta ?? "",
  );
  const [datum, setDatum] = useState(pocetni?.datum ?? "");
  const [brojRacuna, setBrojRacuna] = useState(pocetni?.brojRacuna ?? "");
  const [napomena, setNapomena] = useState(pocetni?.napomena ?? "");
  const [iznos, setIznos] = useState(pocetni ? String(pocetni.iznos) : "");
  const [saPdv, setSaPdv] = useState(!!pocetni && pocetni.pdv !== "bez");
  // Kad se PDV obračunava, operater mora izričito izabrati domaći ili ino.
  const [vrstaPdv, setVrstaPdv] = useState<"domaci" | "ino" | null>(
    pocetni && pocetni.pdv !== "bez" ? pocetni.pdv : null,
  );
  const [greska, setGreska] = useState<string | null>(null);
  const brojRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZatvori();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onZatvori]);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    const l = q
      ? partneri.filter(
          (p) =>
            String(p.partner_id) === q ||
            p.naziv?.toLowerCase().includes(q) ||
            (p.jib && p.jib.includes(q)) ||
            (p.pib && p.pib.includes(q)),
        )
      : partneri;
    return l.slice(0, 60);
  }, [partneri, pretraga]);

  const odaberi = (p: Partner) => {
    setPartner(p);
    setPretraga(p.naziv);
    setLista(false);
    setGreska(null);
  };

  const iznosBroj = round2(broj(iznos));
  const pdv: PdvTroska = saPdv ? (vrstaPdv ?? "bez") : "bez";
  const iznosPdv = saPdv ? round2(iznosBroj * PDV_STOPA) : 0;

  const sacuvaj = () => {
    const vrsta = vrste.find((v) => String(v.sifra) === sifraVrste);
    if (!vrsta) return setGreska("Izaberite vrstu troška.");
    if (!partner) return setGreska("Izaberite partnera.");
    if (!tipDokumenta) return setGreska("Izaberite tip dokumenta.");
    if (!datum) return setGreska("Unesite datum računa.");
    if (!brojRacuna.trim()) return setGreska("Unesite broj računa.");
    if (!(iznosBroj > 0)) return setGreska("Unesite ukupan iznos.");
    if (saPdv && !vrstaPdv)
      return setGreska("Izaberite da li je PDV domaći ili INO.");
    onSacuvaj({
      sifraVrste: Number(vrsta.sifra),
      nazivVrste: vrsta.naziv_zavisnog_troska,
      partnerId: partner.partner_id,
      nazivPartnera: partner.naziv,
      tipDokumenta,
      datum,
      brojRacuna: brojRacuna.trim(),
      napomena: napomena.trim(),
      iznos: iznosBroj,
      pdv,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={onZatvori}
    >
      <div
        className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-2xl p-6 space-y-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
            {pocetni ? "Izmjena vezanog troška" : "Novi vezani trošak"}
          </h3>
          <button
            type="button"
            onClick={onZatvori}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2d2648]"
          >
            <X size={18} />
          </button>
        </div>

        <Field label="Vrsta troška">
          <select
            autoFocus
            value={sifraVrste}
            onChange={(e) => setSifraVrste(e.target.value)}
            className={inputClass}
          >
            <option value="">-- Izaberi vrstu troška --</option>
            {vrste.map((v) => (
              <option key={v.sifra} value={v.sifra}>
                {v.naziv_zavisnog_troska}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Partner">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={pretraga}
              placeholder="Naziv, šifra, JIB ili PIB partnera..."
              onChange={(e) => {
                setPretraga(e.target.value);
                setPartner(null);
                setLista(true);
                setOznacen(0);
              }}
              onFocus={() => {
                if (!partner) setLista(true);
              }}
              onBlur={() => setTimeout(() => setLista(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setLista(true);
                  setOznacen((i) => Math.min(i + 1, filtrirani.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setOznacen((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const p = filtrirani[oznacen];
                  if (p && !partner) odaberi(p);
                } else if (e.key === "Escape" && lista) {
                  e.stopPropagation();
                  setLista(false);
                }
              }}
              className={`${inputClass} pl-9`}
            />
            {lista && !partner && filtrirani.length > 0 && (
              <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                {filtrirani.map((p, i) => (
                  <button
                    key={p.partner_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      odaberi(p);
                    }}
                    onMouseEnter={() => setOznacen(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                      i === oznacen ? "bg-purple-50 dark:bg-[#2d2648]" : ""
                    } text-gray-700 dark:text-[#c5bfd8]`}
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs text-gray-400 mr-2">
                        {p.partner_id}
                      </span>
                      {p.naziv}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-500 dark:text-[#9e96b8]">
                      {[p.grad, p.drzava].filter(Boolean).join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="Tip dokumenta">
          <select
            value={tipDokumenta}
            onChange={(e) => setTipDokumenta(e.target.value)}
            className={inputClass}
          >
            <option value="">-- Izaberi tip dokumenta --</option>
            {TIP_DOKUMENTA.map((t) => (
              <option key={t.sifra} value={t.sifra}>
                {t.sifra} - {t.naziv}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum računa">
            <DatumPolje value={datum} onChange={setDatum} />
          </Field>
          <Field label="Broj računa">
            <input
              ref={brojRef}
              type="text"
              value={brojRacuna}
              onChange={(e) => setBrojRacuna(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Napomena">
          <input
            type="text"
            value={napomena}
            onChange={(e) => setNapomena(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Ukupan iznos">
          <input
            type="number"
            step="0.01"
            min="0"
            value={iznos}
            onChange={(e) => setIznos(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="PDV na iznos">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSaPdv(false)}
              className={izborDugmeClass(!saPdv)}
              style={izborDugmeStyle(!saPdv, "#6b7280")}
            >
              Ne obračunava se
            </button>
            <button
              type="button"
              onClick={() => setSaPdv(true)}
              className={izborDugmeClass(saPdv)}
              style={izborDugmeStyle(saPdv)}
            >
              Obračunava se
            </button>
          </div>
        </Field>

        {saPdv && (
          <Field label="Vrsta PDV-a">
            <div className="grid grid-cols-2 gap-2">
              {(["domaci", "ino"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVrstaPdv(v)}
                  className={izborDugmeClass(vrstaPdv === v)}
                  style={izborDugmeStyle(
                    vrstaPdv === v,
                    v === "ino" ? SIROVINA_BOJA : PRIMARY,
                  )}
                >
                  {PDV_TROSKA_NAZIV[v]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="rounded-xl px-3 py-2 bg-[#f4f1f9] dark:bg-[#1c1828] text-sm text-gray-700 dark:text-[#c5bfd8] space-y-1">
          <div className="flex justify-between gap-4">
            <span>Iznos</span>
            <span className="tabular-nums">{formatBroj(iznosBroj)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>PDV {saPdv ? `${PDV_STOPA * 100} %` : ""}</span>
            <span className="tabular-nums">{formatBroj(iznosPdv)}</span>
          </div>
          <div className="flex justify-between gap-4 font-bold text-gray-800 dark:text-[#ede9f6]">
            <span>Ukupno</span>
            <span className="tabular-nums">
              {formatBroj(round2(iznosBroj + iznosPdv))}
            </span>
          </div>
        </div>

        {greska && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <AlertTriangle size={15} className="flex-shrink-0" />
            {greska}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onZatvori}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8]"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={sacuvaj}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: PRIMARY }}
          >
            {pocetni ? "Sačuvaj izmjenu" : "Dodaj trošak"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KalkulacijaUnos() {
  const [partneri, setPartneri] = useState<Partner[]>([]);
  const [drzave, setDrzave] = useState<Drzava[]>([]);
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);

  // Partner
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerPretraga, setPartnerPretraga] = useState("");
  const [partnerLista, setPartnerLista] = useState(false);
  const [partnerOznacen, setPartnerOznacen] = useState(0);

  // Zaglavlje — podaci sa dobavljačevog dokumenta, upisuje ih operater.
  const [brojKalkulacije, setBrojKalkulacije] = useState("");
  const [datumKalkulacije, setDatumKalkulacije] = useState("");
  const [datumValute, setDatumValute] = useState("");
  // Kad operater ručno upiše valutu, više se ne preračunava iz datuma.
  const [valutaRucno, setValutaRucno] = useState(false);
  const [vrsta, setVrsta] = useState<VrstaKalkulacije>("sirovina");

  // Unos stavke
  const [pretraga, setPretraga] = useState("");
  const [listaOtvorena, setListaOtvorena] = useState(false);
  const [oznacen, setOznacen] = useState(0);
  const [odabrani, setOdabrani] = useState<Artikal | null>(null);
  const [kolicina, setKolicina] = useState("");
  const [cijena, setCijena] = useState("");
  const [rabat, setRabat] = useState("");
  const [akcijskiRabat, setAkcijskiRabat] = useState("");
  const [vpc, setVpc] = useState("");
  const [zadnjaCijena, setZadnjaCijena] = useState<
    | { fakturisana_cijena: number | string; nasa_ulazna_cijena: number | string }
    | "ucitavanje"
    | null
  >(null);
  // Stavka koja se trenutno mijenja (klik na red u tabeli); null = nova.
  const [izmjenaId, setIzmjenaId] = useState<number | null>(null);

  const [stavke, setStavke] = useState<StavkaKalkulacije[]>([]);
  const [zadnjaDodana, setZadnjaDodana] = useState<number | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [zakljucivanje, setZakljucivanje] = useState(false);
  // Pitanje za potvrdu — prikazuje se kao modal na sredini ekrana.
  const [potvrda, setPotvrda] = useState<{
    naslov: string;
    poruka: string;
    dugme: string;
    akcija: () => void;
  } | null>(null);

  useEffect(() => {
    if (!potvrda) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPotvrda(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [potvrda]);

  // Vezani troškovi
  const [vrsteTroska, setVrsteTroska] = useState<VrstaTroska[]>([]);
  const [troskovi, setTroskovi] = useState<VezaniTrosak[]>([]);
  // Modal za trošak: "novi", postojeći trošak (izmjena) ili zatvoren (null).
  const [trosakModal, setTrosakModal] = useState<VezaniTrosak | "novi" | null>(
    null,
  );

  const sljedeciId = useRef(1);
  const partnerRef = useRef<HTMLInputElement>(null);
  const brojRef = useRef<HTMLInputElement>(null);
  const pretragaRef = useRef<HTMLInputElement>(null);
  const kolicinaRef = useRef<HTMLInputElement>(null);
  const cijenaRef = useRef<HTMLInputElement>(null);
  const rabatRef = useRef<HTMLInputElement>(null);
  const akcijskiRef = useRef<HTMLInputElement>(null);
  const vpcRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dohvati = async <T,>(putanja: string, poruka: string) => {
      const res = await fetch(`${API_URL}${putanja}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(poruka);
      const json = await res.json();
      return (json.data ?? []) as T[];
    };
    Promise.all([
      dohvati<Partner>(
        "/api/partneri/lista-sve",
        "Greška pri učitavanju partnera",
      ),
      dohvati<Drzava>("/api/partneri/drzave", "Greška pri učitavanju država"),
      dohvati<Artikal>(
        "/api/artikli/pregled-sve",
        "Greška pri učitavanju artikala",
      ),
    ])
      .then(([p, d, a]) => {
        setPartneri(p.filter((x) => Number(x.aktivan ?? 1) === 1));
        setDrzave(d);
        setArtikli(a);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setUcitavanje(false));
    // Odvojeno od ostalog — greška ovdje ne smije blokirati unos kalkulacije.
    dohvati<VrstaTroska>(
      "/api/kalkulacije/zavisni-troskovi/vrste",
      "Greška pri učitavanju vrsta vezanog troška",
    )
      .then(setVrsteTroska)
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      );
  }, []);

  // Partnerova država stiže kao slobodan tekst — prevodi se u šifru preko
  // liste država (isti princip kao u racuniZiralni). Partner bez upisane ili
  // prepoznate države tretira se kao domaći.
  const jeIno = useMemo(() => {
    if (!partner?.drzava) return false;
    const d = drzave.find((x) => x.naziv_drzave === partner.drzava);
    return !!d && Number(d.sifra_drzave) !== SIFRA_DRZAVE_BIH;
  }, [partner, drzave]);
  const uSistemuPdv = Number(partner?.pdv_obveznik ?? 0) === 1;
  // Ulazni PDV se obračunava samo za domaćeg dobavljača koji je u sistemu PDV.
  const obracunPdv = !!partner && !jeIno && uSistemuPdv;

  const partneriFiltrirani = useMemo(() => {
    const q = partnerPretraga.trim().toLowerCase();
    const lista = q
      ? partneri.filter(
          (p) =>
            String(p.partner_id) === q ||
            p.naziv?.toLowerCase().includes(q) ||
            (p.jib && p.jib.includes(q)) ||
            (p.pib && p.pib.includes(q)),
        )
      : partneri;
    return lista.slice(0, 60);
  }, [partneri, partnerPretraga]);

  const artikliVrste = useMemo(
    () => artikli.filter((a) => jeSirovina(a) === (vrsta === "sirovina")),
    [artikli, vrsta],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    const lista = q
      ? artikliVrste.filter(
          (a) =>
            String(a.sifra_proizvoda) === q ||
            a.naziv_proizvoda?.toLowerCase().includes(q) ||
            (a.barkod && String(a.barkod) === q),
        )
      : artikliVrste;
    return lista.slice(0, 60);
  }, [artikliVrste, pretraga]);

  // VPC robe operater smije mijenjati samo kad artikla nema na stanju; dok
  // ima robe, ostaje VPC iz šifarnika (erp.artikli_pregled_sve).
  const vpcZakljucana = vrsta === "roba" && !!odabrani && imaStanje(odabrani);

  // Ista boja kao izabrano dugme Sirovina/Roba u "Podacima o kalkulaciji".
  const bojaVrste = vrsta === "sirovina" ? SIROVINA_BOJA : PRIMARY;

  const fakturna = fakturnaCijena(
    broj(cijena),
    broj(rabat),
    broj(akcijskiRabat),
  );
  const vrijednostStavke = round2(broj(kolicina) * fakturna);

  const odaberiPartnera = (p: Partner) => {
    setPartner(p);
    setPartnerPretraga(p.naziv);
    setPartnerLista(false);
    setGreska(null);
    setUspjeh(null);
    if (!valutaRucno && datumKalkulacije)
      setDatumValute(
        dodajDane(datumKalkulacije, Number(p.valuta_placanja) || 0),
      );
    setTimeout(() => brojRef.current?.focus(), 0);
  };

  // Sve što je uneseno vezano je za izabranog partnera — promjena ili
  // brisanje partnera briše cijeli unos, uz potvrdu ako ima šta da se izgubi.
  const imaUnesenihPodataka =
    !!brojKalkulacije.trim() ||
    !!datumKalkulacije ||
    !!datumValute ||
    troskovi.length > 0 ||
    stavke.length > 0 ||
    !!odabrani;

  const promijeniPartnera = (nastavak: () => void) => {
    const izvrsi = () => {
      ponistiSve();
      nastavak();
      setTimeout(() => partnerRef.current?.focus(), 0);
    };
    if (!partner) return nastavak();
    if (!imaUnesenihPodataka) return izvrsi();
    setPotvrda({
      naslov: "Promjena partnera",
      poruka:
        "Promjenom ili brisanjem partnera biće obrisani svi uneseni podaci: podaci o kalkulaciji, vezani troškovi i stavke. Nastaviti?",
      dugme: "Obriši i promijeni",
      akcija: izvrsi,
    });
  };

  const ponistiPartnera = () => promijeniPartnera(() => {});

  const promjenaDatuma = (val: string) => {
    setDatumKalkulacije(val);
    if (!valutaRucno && val)
      setDatumValute(dodajDane(val, Number(partner?.valuta_placanja) || 0));
  };

  // Zadnja cijena izabranog proizvoda (erp.kalkulacija_zadnja_cijena_proizvoda)
  // — učitava se pri svakom izboru artikla; null = nikad nije kalkulisan.
  const sifraOdabranog = odabrani ? Number(odabrani.sifra_proizvoda) : null;
  useEffect(() => {
    if (sifraOdabranog === null) {
      setZadnjaCijena(null);
      return;
    }
    let ponisteno = false;
    setZadnjaCijena("ucitavanje");
    fetch(`${API_URL}/api/kalkulacije/zadnja-cijena/${sifraOdabranog}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ponisteno) setZadnjaCijena(json?.data ?? null);
      })
      .catch(() => {
        if (!ponisteno) setZadnjaCijena(null);
      });
    return () => {
      ponisteno = true;
    };
  }, [sifraOdabranog]);

  const ponistiOdabir = (fokusNaPretragu = true) => {
    setOdabrani(null);
    setPretraga("");
    setKolicina("");
    setCijena("");
    setRabat("");
    setAkcijskiRabat("");
    setVpc("");
    setIzmjenaId(null);
    if (fokusNaPretragu) setTimeout(() => pretragaRef.current?.focus(), 0);
  };

  const odaberiArtikal = (a: Artikal) => {
    setOdabrani(a);
    setPretraga(`${a.sifra_proizvoda} – ${a.naziv_proizvoda}`);
    setListaOtvorena(false);
    setIzmjenaId(null);
    setKolicina("");
    setCijena("");
    setRabat("");
    setAkcijskiRabat("");
    setVpc(vrsta === "roba" && broj(a.vpc) > 0 ? broj(a.vpc).toFixed(2) : "");
    setGreska(null);
    setUspjeh(null);
    setTimeout(() => kolicinaRef.current?.focus(), 0);
  };

  const izmijeniStavku = (s: StavkaKalkulacije) => {
    const a = artikli.find(
      (x) => Number(x.sifra_proizvoda) === s.sifra_proizvoda,
    );
    if (!a) return;
    setOdabrani(a);
    setPretraga(`${a.sifra_proizvoda} – ${a.naziv_proizvoda}`);
    setListaOtvorena(false);
    setIzmjenaId(s.id);
    setKolicina(String(s.kolicina));
    setCijena(String(s.cijena));
    setRabat(s.rabat ? String(s.rabat) : "");
    setAkcijskiRabat(s.akcijskiRabat ? String(s.akcijskiRabat) : "");
    setVpc(
      vrsta !== "roba"
        ? ""
        : imaStanje(a)
          ? broj(a.vpc).toFixed(2)
          : s.vpc.toFixed(2),
    );
    setGreska(null);
    setUspjeh(null);
    setTimeout(() => kolicinaRef.current?.select(), 0);
  };

  const dodajStavku = () => {
    if (!odabrani) return;
    const kol = round3(broj(kolicina));
    const cij = round4(broj(cijena));
    const rab = round2(broj(rabat));
    const akc = round2(broj(akcijskiRabat));
    // Roba sa stanjem zadržava VPC iz šifarnika — operater je ne mijenja.
    const vp = round2(broj(vpcZakljucana ? odabrani.vpc : vpc));
    if (vpcZakljucana && !(vp > 0)) {
      setGreska(
        "Artikal ima stanje na zalihi, a VPC u šifarniku je 0 — VPC se ne može mijenjati dok ima robe. Ispravite artikal.",
      );
      return;
    }
    if (!(kol > 0)) {
      setGreska("Unesite količinu.");
      kolicinaRef.current?.focus();
      return;
    }
    if (!(cij > 0)) {
      setGreska("Unesite cijenu.");
      cijenaRef.current?.focus();
      return;
    }
    if (rab < 0 || rab > 100 || akc < 0 || akc > 100) {
      setGreska("Rabat i akcijski rabat moraju biti između 0 i 100 %.");
      return;
    }
    if (vrsta === "roba" && !(vp > 0)) {
      setGreska("Za robu je obavezan unos VPC.");
      vpcRef.current?.focus();
      return;
    }

    const stavka: StavkaKalkulacije = {
      id: izmjenaId ?? sljedeciId.current++,
      sifra_proizvoda: Number(odabrani.sifra_proizvoda),
      naziv_proizvoda: odabrani.naziv_proizvoda,
      jm: odabrani.jm,
      kolicina: kol,
      cijena: cij,
      rabat: rab,
      akcijskiRabat: akc,
      fakturnaCijena: fakturnaCijena(cij, rab, akc),
      vpc: vrsta === "roba" ? vp : 0,
    };
    setStavke((prev) =>
      izmjenaId === null
        ? [...prev, stavka]
        : prev.map((s) => (s.id === izmjenaId ? stavka : s)),
    );
    setZadnjaDodana(stavka.id);
    setGreska(null);
    setUspjeh(null);
    ponistiOdabir();
  };

  const ukloniStavku = (id: number) => {
    setStavke((prev) => prev.filter((s) => s.id !== id));
    if (izmjenaId === id) ponistiOdabir(false);
  };

  const promjenaVrste = (nova: VrstaKalkulacije) => {
    if (nova === vrsta) return;
    const primijeni = () => {
      setVrsta(nova);
      setStavke([]);
      ponistiOdabir(false);
    };
    if (stavke.length === 0) return primijeni();
    setPotvrda({
      naslov: "Promjena vrste kalkulacije",
      poruka: "Promjena vrste kalkulacije briše sve unesene stavke. Nastaviti?",
      dugme: "Promijeni vrstu",
      akcija: primijeni,
    });
  };

  const vrijednost = (s: StavkaKalkulacije) =>
    round2(s.kolicina * s.fakturnaCijena);

  const ukupnoBruto = round2(
    stavke.reduce((z, s) => z + s.kolicina * s.cijena, 0),
  );
  const ukupnoOsnovica = round2(stavke.reduce((z, s) => z + vrijednost(s), 0));
  const ukupnoRabat = round2(ukupnoBruto - ukupnoOsnovica);
  const ukupnoPdv = obracunPdv ? round2(ukupnoOsnovica * PDV_STOPA) : 0;
  const ukupnoVp = round2(stavke.reduce((z, s) => z + s.kolicina * s.vpc, 0));

  const sacuvajTrosak = (t: Omit<VezaniTrosak, "id">) => {
    setTroskovi((prev) =>
      trosakModal && trosakModal !== "novi"
        ? prev.map((x) => (x.id === trosakModal.id ? { ...t, id: x.id } : x))
        : [...prev, { ...t, id: sljedeciId.current++ }],
    );
    setTrosakModal(null);
  };

  const ukupnoTroskovi = round2(troskovi.reduce((z, t) => z + t.iznos, 0));
  const ukupnoPdvTroskova = round2(
    troskovi.reduce((z, t) => z + pdvTroska(t), 0),
  );

  const ponistiSve = () => {
    setTroskovi([]);
    setPartner(null);
    setPartnerPretraga("");
    setBrojKalkulacije("");
    setDatumKalkulacije("");
    setDatumValute("");
    setValutaRucno(false);
    setStavke([]);
    setGreska(null);
    ponistiOdabir(false);
  };

  // Podaci koji idu u proceduru za zaključenje. Nazivi polja prate
  // erp.kalkulacija_gl_pregled / kalkulacija_po_pregled i privremeni su dok se
  // procedura ne definiše.
  const pripremiPodatke = () => ({
    sifra_dobavljaca: partner!.partner_id,
    broj_racuna: brojKalkulacije.trim(),
    datum_kalkulacije: datumKalkulacije,
    valuta: datumValute,
    // kalkulacija_gl.kalkulacija_robe: 0 zavisni trošak, 1 sirovina, 2 roba.
    kalkulacija_robe: vrsta === "roba" ? 2 : 1,
    ino_dobavljac: jeIno ? 1 : 0,
    u_sistemu_pdv: uSistemuPdv ? 1 : 0,
    ukupno_km: ukupnoOsnovica,
    ukupno_rab: ukupnoRabat,
    ukupno_pdv: ukupnoPdv,
    vp_vrednost: ukupnoVp,
    stavke: stavke.map((s) => ({
      sifra_proizvoda: s.sifra_proizvoda,
      kolicina: s.kolicina,
      cijena: s.cijena,
      rabat: s.rabat,
      akcijski_rabat: s.akcijskiRabat,
      fakturisana_cijena: s.fakturnaCijena,
      vpc: s.vpc,
    })),
    zavisni_troskovi: troskovi.map((t) => ({
      kalkulacija_robe: 0,
      sifra_vrste_troska: t.sifraVrste,
      sifra_dobavljaca: t.partnerId,
      tip_dokumenta_el_kuf: t.tipDokumenta,
      datum: t.datum,
      broj_racuna: t.brojRacuna,
      napomena: t.napomena,
      iznos: t.iznos,
      obracun_pdv: t.pdv === "bez" ? 0 : 1,
      ino_pdv: t.pdv === "ino" ? 1 : 0,
      iznos_pdv: pdvTroska(t),
    })),
  });

  const zakljuci = () => {
    if (zakljucivanje) return;
    setUspjeh(null);
    if (!partner) return setGreska("Izaberite partnera.");
    if (!brojKalkulacije.trim()) return setGreska("Unesite broj kalkulacije.");
    if (!datumKalkulacije) return setGreska("Unesite datum kalkulacije.");
    if (!datumValute) return setGreska("Unesite datum valute plaćanja.");
    if (datumValute < datumKalkulacije)
      return setGreska("Datum valute ne može biti prije datuma kalkulacije.");
    if (stavke.length === 0) return setGreska("Kalkulacija nema stavki.");
    setPotvrda({
      naslov: "Zaključenje kalkulacije",
      poruka: `Zaključiti kalkulaciju br. ${brojKalkulacije.trim()} (${stavke.length} stavki)?`,
      dugme: "Zaključi",
      akcija: () => void izvrsiZakljucenje(),
    });
  };

  const izvrsiZakljucenje = async () => {
    setZakljucivanje(true);
    setGreska(null);
    try {
      const podaci = pripremiPodatke();
      if (TEST_SAMO_JSON) {
        preuzmiJson(
          podaci,
          `kalkulacija_${brojKalkulacije.trim().replace(/[^\w-]+/g, "_")}_${datumKalkulacije}.json`,
        );
        // Unos se prazni i ekran je spreman za novu kalkulaciju.
        ponistiSve();
        setUspjeh(
          "TEST: JSON za proceduru je preuzet — ništa nije upisano u bazu.",
        );
        setTimeout(() => partnerRef.current?.focus(), 0);
        return;
      }
      // TODO: poziv procedure za zaključenje kalkulacije (POST na backend) —
      // dodaje se kad procedura i nazivi polja budu definisani.
      setGreska(
        "Zaključenje još nije povezano sa bazom — ništa nije snimljeno.",
      );
    } finally {
      setZakljucivanje(false);
    }
  };

  // Enter prebacuje na sljedeće polje; na zadnjem dodaje stavku.
  const naEnter =
    (sljedece?: React.RefObject<HTMLInputElement>) =>
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (sljedece?.current) sljedece.current.select();
      else dodajStavku();
    };

  return (
    <div className="space-y-4">
      {potvrda && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50"
          onMouseDown={() => setPotvrda(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] border border-gray-100 dark:border-[#2d2648] shadow-2xl p-6 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                <AlertTriangle size={20} style={{ color: PRIMARY }} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
                {potvrda.naslov}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
              {potvrda.poruka}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPotvrda(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8]"
              >
                Odustani
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const { akcija } = potvrda;
                  setPotvrda(null);
                  akcija();
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: PRIMARY }}
              >
                {potvrda.dugme}
              </button>
            </div>
          </div>
        </div>
      )}

      {trosakModal && (
        <VezaniTrosakModal
          partneri={partneri}
          vrste={vrsteTroska}
          pocetni={trosakModal === "novi" ? null : trosakModal}
          onSacuvaj={sacuvajTrosak}
          onZatvori={() => setTrosakModal(null)}
        />
      )}

      {/* Red 1: partner | podaci o kalkulaciji | vezani troškovi (iste visine)
          Red 2: nova stavka ispod partnera | unesene stavke ispod podataka */}
      <div className="grid grid-cols-1 xl:grid-cols-[500px_minmax(0,1fr)_minmax(0,1fr)] gap-4">
          {/* Partner */}
          <div className={karticaClass}>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Partner (dobavljač)
            </span>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={partnerRef}
                type="text"
                value={partnerPretraga}
                placeholder={
                  ucitavanje
                    ? "Učitavanje partnera..."
                    : "Naziv, šifra, JIB ili PIB partnera..."
                }
                disabled={ucitavanje}
                onChange={(e) => {
                  const v = e.target.value;
                  promijeniPartnera(() => {
                    setPartnerPretraga(v);
                    setPartner(null);
                    setPartnerLista(true);
                    setPartnerOznacen(0);
                  });
                }}
                onFocus={() => {
                  if (!partner) setPartnerLista(true);
                }}
                onBlur={() => setTimeout(() => setPartnerLista(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPartnerLista(true);
                    setPartnerOznacen((i) =>
                      Math.min(i + 1, partneriFiltrirani.length - 1),
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPartnerOznacen((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const p = partneriFiltrirani[partnerOznacen];
                    if (p && !partner) odaberiPartnera(p);
                  } else if (e.key === "Escape") {
                    setPartnerLista(false);
                  }
                }}
                className={`${inputClass} pl-9 pr-9`}
              />
              {partnerPretraga && (
                <button
                  type="button"
                  onClick={ponistiPartnera}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}

              {partnerLista && !partner && partneriFiltrirani.length > 0 && (
                <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                  {partneriFiltrirani.map((p, i) => (
                    <button
                      key={p.partner_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        odaberiPartnera(p);
                      }}
                      onMouseEnter={() => setPartnerOznacen(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === partnerOznacen
                          ? "bg-purple-50 dark:bg-[#2d2648]"
                          : ""
                      } text-gray-700 dark:text-[#c5bfd8]`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {p.partner_id}
                        </span>
                        {p.naziv}
                      </span>
                      <span className="flex-shrink-0 text-xs text-gray-500 dark:text-[#9e96b8]">
                        {[p.grad, p.drzava].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {partner && (
              <div className="rounded-xl px-3 py-2.5 bg-[#f4f1f9] dark:bg-[#1c1828] space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Znacka
                    tekst={jeIno ? "INO partner" : "Domaći partner"}
                    boja={jeIno ? SIROVINA_BOJA : PRIMARY}
                  />
                  <Znacka
                    tekst={uSistemuPdv ? "U sistemu PDV" : "Nije u sistemu PDV"}
                    boja={uSistemuPdv ? ACCENT : "#6b7280"}
                  />
                </div>
                <div className="text-xs text-gray-600 dark:text-[#9e96b8]">
                  {[partner.adresa, partner.grad, partner.drzava]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
                <div className="text-xs tabular-nums text-gray-600 dark:text-[#9e96b8]">
                  JIB: {partner.jib || "—"} · PIB: {partner.pib || "—"}
                  {Number(partner.valuta_placanja) > 0 &&
                    ` · valuta ${partner.valuta_placanja} dana`}
                </div>
              </div>
            )}
          </div>

          {/* Zaglavlje kalkulacije */}
          <div className={karticaClass}>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Podaci o kalkulaciji
            </span>
            {!partner && (
              <p className="text-xs text-gray-500 dark:text-[#9e96b8]">
                Prvo izaberite partnera.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Broj kalkulacije" className="sm:col-span-2">
                <input
                  ref={brojRef}
                  type="text"
                  value={brojKalkulacije}
                  disabled={!partner}
                  onChange={(e) => setBrojKalkulacije(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Datum kalkulacije">
                <DatumPolje
                  value={datumKalkulacije}
                  disabled={!partner}
                  onChange={promjenaDatuma}
                />
              </Field>
              <Field label="Datum valute">
                <DatumPolje
                  value={datumValute}
                  disabled={!partner}
                  onChange={(v) => {
                    setDatumValute(v);
                    setValutaRucno(!!v);
                  }}
                />
              </Field>
            </div>

            <Field label="Vrsta kalkulacije">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { kod: "sirovina", naziv: "Sirovina", boja: SIROVINA_BOJA },
                    { kod: "roba", naziv: "Roba", boja: PRIMARY },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.kod}
                    type="button"
                    disabled={!partner}
                    onClick={() => promjenaVrste(v.kod)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
                      vrsta === v.kod
                        ? "text-white"
                        : "text-gray-600 dark:text-[#c5bfd8] border-gray-200 dark:border-[#3a3158]"
                    }`}
                    style={
                      vrsta === v.kod
                        ? { background: v.boja, borderColor: v.boja }
                        : {}
                    }
                  >
                    {v.naziv}
                  </button>
                ))}
              </div>
            </Field>
          </div>


          {/* Vezani troškovi */}
          <div className={karticaClass}>
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: PRIMARY }}
              >
                Vezani troškovi
              </span>
              <button
                type="button"
                disabled={!partner}
                onClick={() => setTrosakModal("novi")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: PRIMARY }}
              >
                <Plus size={13} />
                Dodaj trošak
              </button>
            </div>

            {troskovi.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-[#9e96b8]">
                Nema vezanih troškova (prevoz, carinjenje, takse...).
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {troskovi.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setTrosakModal(t)}
                      title="Klik za izmjenu troška"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer bg-[#f4f1f9] dark:bg-[#1c1828] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate text-gray-800 dark:text-[#ede9f6]">
                          {t.nazivVrste}
                        </div>
                        <div className="text-xs truncate text-gray-500 dark:text-[#9e96b8]">
                          {t.nazivPartnera} · rn. {t.brojRacuna} ·{" "}
                          {formatDatumDMY(t.datum)} · tip {t.tipDokumenta}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm font-bold tabular-nums text-gray-800 dark:text-[#ede9f6]">
                          <span className="mr-1.5 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                            Ukupno
                          </span>
                          {formatBroj(t.iznos)}
                          <span className="ml-3 mr-1.5 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                            PDV
                          </span>
                          {formatBroj(pdvTroska(t))}
                        </div>
                        <div
                          className="text-[11px] font-semibold"
                          style={{
                            color:
                              t.pdv === "bez"
                                ? "#9ca3af"
                                : t.pdv === "ino"
                                  ? SIROVINA_BOJA
                                  : PRIMARY,
                          }}
                        >
                          {PDV_TROSKA_NAZIV[t.pdv]}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTroskovi((prev) =>
                            prev.filter((x) => x.id !== t.id),
                          );
                        }}
                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Ukloni trošak"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-4 text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                  <span>Ukupno troškovi</span>
                  <span className="tabular-nums">
                    {formatBroj(ukupnoTroskovi)}
                    {ukupnoPdvTroskova > 0 && (
                      <span className="ml-1 text-xs font-normal text-gray-500 dark:text-[#9e96b8]">
                        + PDV {formatBroj(ukupnoPdvTroskova)}
                      </span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
        {/* Nova stavka — iste širine kao partner */}
        <div className="space-y-4 self-start">
          {/* Stavka — pozadina u boji izabrane vrste (dugme Sirovina/Roba) */}
          <div
            className="rounded-2xl shadow-sm p-5 space-y-3 [&_label]:!text-white [&_p]:!text-white"
            style={{ background: bojaVrste }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {izmjenaId !== null ? "Izmjena stavke" : "Nova stavka"} —{" "}
              {vrsta === "sirovina" ? "sirovina" : "roba"}
            </span>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={pretragaRef}
                type="text"
                value={pretraga}
                placeholder={
                  ucitavanje
                    ? "Učitavanje artikala..."
                    : `Šifra, naziv ili barkod ${vrsta === "sirovina" ? "sirovine" : "robe"}...`
                }
                disabled={ucitavanje || !partner}
                onChange={(e) => {
                  setPretraga(e.target.value);
                  setOdabrani(null);
                  setIzmjenaId(null);
                  setListaOtvorena(true);
                  setOznacen(0);
                }}
                onFocus={() => {
                  if (!odabrani) setListaOtvorena(true);
                }}
                onBlur={() => setTimeout(() => setListaOtvorena(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setListaOtvorena(true);
                    setOznacen((i) => Math.min(i + 1, filtrirani.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setOznacen((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const a = filtrirani[oznacen];
                    if (a && !odabrani) odaberiArtikal(a);
                  } else if (e.key === "Escape") {
                    setListaOtvorena(false);
                  }
                }}
                className={`${inputClass} pl-9 pr-9`}
              />
              {pretraga && (
                <button
                  type="button"
                  onClick={() => ponistiOdabir()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              )}

              {listaOtvorena && !odabrani && filtrirani.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1c1828] shadow-xl">
                  {filtrirani.map((a, i) => (
                    <button
                      key={String(a.sifra_proizvoda)}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        odaberiArtikal(a);
                      }}
                      onMouseEnter={() => setOznacen(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === oznacen ? "bg-purple-50 dark:bg-[#2d2648]" : ""
                      } text-gray-700 dark:text-[#c5bfd8]`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-xs text-gray-400 mr-2">
                          {String(a.sifra_proizvoda)}
                        </span>
                        {a.naziv_proizvoda}
                      </span>
                      <span className="flex-shrink-0 text-xs tabular-nums text-gray-500 dark:text-[#9e96b8]">
                        {a.jm}
                        {vrsta === "roba" &&
                          ` · VPC ${formatBroj(broj(a.vpc))}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {odabrani && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Količina (${odabrani.jm ?? ""})`}>
                    <input
                      ref={kolicinaRef}
                      type="number"
                      step="any"
                      min="0"
                      value={kolicina}
                      onChange={(e) => setKolicina(e.target.value)}
                      onKeyDown={naEnter(cijenaRef)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Cijena">
                    <input
                      ref={cijenaRef}
                      type="number"
                      step="any"
                      min="0"
                      value={cijena}
                      onChange={(e) => setCijena(e.target.value)}
                      onKeyDown={naEnter(rabatRef)}
                      className={inputClass}
                    />
                  </Field>
                  {/* Rabat i akcijski rabat dijele jednu kolonu */}
                  <div className="grid grid-cols-2 gap-2">
                  <Field label="Rabat %">
                    <input
                      ref={rabatRef}
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={rabat}
                      onChange={(e) => setRabat(e.target.value)}
                      onKeyDown={naEnter(akcijskiRef)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Akc. rabat %">
                    <input
                      ref={akcijskiRef}
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={akcijskiRabat}
                      onChange={(e) => setAkcijskiRabat(e.target.value)}
                      onKeyDown={naEnter(
                        vrsta === "roba" && !vpcZakljucana ? vpcRef : undefined,
                      )}
                      className={inputClass}
                    />
                  </Field>
                  </div>

                  {/* Informativno, samo za čitanje */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nabavna cijena">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formatBroj(broj(odabrani.nabavna_cijena), 3)}
                        className={samoCitanjeClass}
                      />
                    </Field>
                    <Field label="Zadnje fakturisano">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={
                          zadnjaCijena === "ucitavanje"
                            ? "..."
                            : zadnjaCijena
                              ? formatBroj(
                                  broj(zadnjaCijena.fakturisana_cijena),
                                  3,
                                )
                              : "—"
                        }
                        title={
                          zadnjaCijena && zadnjaCijena !== "ucitavanje"
                            ? `Fakturna cijena sa zadnje kalkulacije · naša ulazna cijena ${formatBroj(broj(zadnjaCijena.nasa_ulazna_cijena), 3)}`
                            : "Proizvod još nije ulazio kroz kalkulaciju"
                        }
                        className={samoCitanjeClass}
                      />
                    </Field>
                  </div>
                  {vrsta === "roba" && (
                    <Field
                      label={
                        vpcZakljucana
                          ? `VPC — zaključana (na stanju ${formatBroj(broj(odabrani.kolicina_proizvoda), 3)} ${odabrani.jm ?? ""})`
                          : "VPC"
                      }
                      className="col-span-2"
                    >
                      <input
                        ref={vpcRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={vpc}
                        readOnly={vpcZakljucana}
                        tabIndex={vpcZakljucana ? -1 : undefined}
                        title={
                          vpcZakljucana
                            ? "VPC se može mijenjati samo kad artikla nema na stanju"
                            : undefined
                        }
                        onChange={(e) => setVpc(e.target.value)}
                        onKeyDown={naEnter()}
                        className={vpcZakljucana ? samoCitanjeClass : inputClass}
                      />
                    </Field>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Fakturna cijena",
                      vrijednost: formatBroj(fakturna, 4),
                    },
                    {
                      label: "Vrijednost",
                      vrijednost: formatBroj(vrijednostStavke),
                    },
                  ].map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl px-3 py-2 bg-[#f4f1f9] dark:bg-[#1c1828]"
                    >
                      <div className="text-xs text-gray-500 dark:text-[#9e96b8]">
                        {p.label}
                      </div>
                      <div className="text-base font-bold tabular-nums text-gray-800 dark:text-[#ede9f6]">
                        {p.vrijednost}
                      </div>
                    </div>
                  ))}
                </div>

                {vrsta === "roba" &&
                  broj(vpc) > 0 &&
                  fakturna > 0 &&
                  broj(vpc) < fakturna && (
                    <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                      <AlertTriangle size={12} />
                      VPC je ispod fakturne cijene.
                    </p>
                  )}

                <button
                  type="button"
                  onClick={dodajStavku}
                  className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-gray-50"
                  style={{ color: bojaVrste }}
                >
                  <Plus size={15} />
                  {izmjenaId !== null ? "Sačuvaj izmjenu" : "Dodaj stavku"}
                </button>
              </>
            )}
          </div>

          {greska && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <AlertTriangle size={15} className="flex-shrink-0" />
              {greska}
            </div>
          )}
          {uspjeh && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              {uspjeh}
            </div>
          )}
        </div>

        {/* Unesene stavke */}
        <div className="xl:col-span-2 min-w-0 space-y-4 self-start">
          <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead>
                  <tr>
                    <TH>#</TH>
                    <TH>Šifra</TH>
                    <TH>Naziv</TH>
                    <TH right>Količina</TH>
                    <TH right>Cijena</TH>
                    <TH right>Rabat %</TH>
                    <TH right>Akc. rabat %</TH>
                    <TH right>Fakturna cijena</TH>
                    <TH right>Vrijednost</TH>
                    {vrsta === "roba" && <TH right>VPC</TH>}
                    <TH />
                  </tr>
                </thead>
                <tbody>
                  {stavke.length === 0 && (
                    <tr>
                      <td
                        colSpan={vrsta === "roba" ? 11 : 10}
                        className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[#6f6890]"
                      >
                        Nema stavki — izaberite partnera, pa artikal i unesite
                        količinu i cijenu.
                      </td>
                    </tr>
                  )}
                  {stavke.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => izmijeniStavku(s)}
                      className={`cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${
                        s.id === izmjenaId
                          ? "bg-purple-50 dark:bg-[#2d2648]"
                          : s.id === zadnjaDodana
                            ? "bg-green-50 dark:bg-green-900/20"
                            : ""
                      }`}
                      title="Klik za izmjenu stavke"
                    >
                      <TD>{i + 1}</TD>
                      <TD className="font-mono text-xs">{s.sifra_proizvoda}</TD>
                      <TD>{s.naziv_proizvoda}</TD>
                      <TD right>
                        {formatBroj(s.kolicina, 3)} {s.jm}
                      </TD>
                      <TD right>{formatBroj(s.cijena, 4)}</TD>
                      <TD right>{formatBroj(s.rabat)}</TD>
                      <TD right>{formatBroj(s.akcijskiRabat)}</TD>
                      <TD right>{formatBroj(s.fakturnaCijena, 4)}</TD>
                      <TD right className="font-bold">
                        {formatBroj(vrijednost(s))}
                      </TD>
                      {vrsta === "roba" && <TD right>{formatBroj(s.vpc)}</TD>}
                      <TD>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            ukloniStavku(s.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Ukloni stavku"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rekapitulacija */}
          {stavke.length > 0 && (
            <div className="flex justify-end">
              <div className="w-full sm:w-80 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-1.5 text-sm text-gray-700 dark:text-[#c5bfd8]">
                {[
                  { label: "Vrijednost bez rabata", iznos: ukupnoBruto },
                  { label: "Rabat", iznos: ukupnoRabat },
                  { label: "Fakturna vrijednost", iznos: ukupnoOsnovica },
                  {
                    label: obracunPdv
                      ? `PDV ${PDV_STOPA * 100} %`
                      : jeIno
                        ? "PDV (ino partner)"
                        : "PDV (nije u sistemu PDV)",
                    iznos: ukupnoPdv,
                  },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between gap-4">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{formatBroj(r.iznos)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4 pt-1.5 border-t border-gray-200 dark:border-[#453a68] text-base font-bold text-gray-800 dark:text-[#ede9f6]">
                  <span>Ukupno</span>
                  <span className="tabular-nums">
                    {formatBroj(round2(ukupnoOsnovica + ukupnoPdv))}
                  </span>
                </div>
                {vrsta === "roba" && (
                  <div className="flex justify-between gap-4 text-xs text-gray-500 dark:text-[#9e96b8]">
                    <span>VP vrijednost</span>
                    <span className="tabular-nums">{formatBroj(ukupnoVp)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                setPotvrda({
                  naslov: "Poništavanje unosa",
                  poruka: "Poništiti cijeli unos kalkulacije?",
                  dugme: "Poništi unos",
                  akcija: ponistiSve,
                })
              }
              disabled={(!partner && stavke.length === 0) || zakljucivanje}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] disabled:opacity-40"
            >
              Poništi
            </button>
            <button
              type="button"
              onClick={zakljuci}
              disabled={stavke.length === 0 || zakljucivanje}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {zakljucivanje ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCheck size={15} />
              )}
              Zaključi kalkulaciju
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
