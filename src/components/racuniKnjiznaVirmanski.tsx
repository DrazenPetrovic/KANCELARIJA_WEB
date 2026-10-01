import ReactDOM from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Loader2,
  Lock,
  Package,
  Search,
  X,
} from "lucide-react";
import { brojUSlovima } from "../utils/brojUSlovima";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const DANGER = "#ef4444";
// Raspored je isti kao u racuniKnjiznaGotovinski.tsx (storno MP), ali je
// pregled namjerno u drugoj boji da operater odmah vidi da je na storno VP.
const VP_BOJA = "#0f766e";

// Storno je uvijek za cijeli žiralni (VP) račun — vidi
// racuniZiralni.tsx (VRSTA_RACUNA/VRSTA_RACUNA_NOVI=2 za normalan unos).
const VRSTA_RACUNA = "z";
const VRSTA_RACUNA_NOVI_VP = 2;
const VRSTA_RACUNA_NOVI_STORNO = 4;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDatumIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatVremeIso = (d: Date) =>
  `${formatDatumIso(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const formatDatumDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}.`;
};
const formatDatumVrijemeDMY = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${formatDatumDMY(v)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
// Fallback na "stornirano" isto kao u racuniPregled.tsx (procedura zna
// vratiti kolonu i pod tim imenom).
const jeStorniran = (r: { storniran_racun?: unknown; stornirano?: unknown }) =>
  Number(r.storniran_racun ?? r.stornirano) === 1;

// Red vraćen sa erp.sp_racuni_gl_pregled (GET /api/pregledi/racuna) — isti
// izvor kao racuniPregled.tsx. Polja ovdje su samo ona koja nam trebaju za
// listu kandidata i za sastavljanje storno header-a (vidi PODESAVANJA_PREGLED
// u racuniPregled.tsx za autoritativan spisak stvarnih naziva kolona).
interface RacunPregledRed {
  sifra_tabele: number;
  broj_racuna: number | string;
  vrsta_racuna_novi: number | string;
  vrsta_racuna_novo?: string;
  vrsta_racuna_pod: number | string;
  datum_racuna: string;
  datum_isporuke?: string;
  valuta?: string;
  sifra_partnera: number | string;
  naziv_partnera: string;
  sifra_radnika: number | string;
  sifra_terena?: number | string;
  napomena?: string;
  br_fiskalnog?: string | number | null;
  datum_vreme_fiskalnog?: string | null;
  ukupno: number | string;
  vrednost: number | string;
  vp1: number | string;
  vp2: number | string;
  rabat_km: number | string;
  storniran_racun?: number | string | null;
  [key: string]: unknown;
}

// Red vraćen sa erp.sp_racuni_po_pregled (GET /api/racuni/pregled-stavke) —
// jedina stavke-procedura koja vraća punu rabat-kaskadu potrebnu da se
// rekonstruiše unos (za razliku od GET /api/racuni/stavke, koja je
// pojednostavljena). Vidi PODESAVANJA_STAVKE u racuniPregled.tsx.
interface StavkaPregled {
  sifra_proizvoda: number | string;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number | string;
  cijena_sa_rab: number | string;
  prodajna_cijena: number | string;
  vpc_bez_rabata: number | string;
  vpc_rabat_1: number | string;
  vpc_sa_rab_2: number | string;
  rabat_proc: number | string;
  rabat_proc_2: number | string;
  rab_proc_3: number | string;
  rabat_km: number | string;
  rabat_km_2: number | string;
  rabat_km_3: number | string;
  pdv_po_artiklu: number | string;
  nabavna_cijena_proizvoda: number | string;
  prodajna_vrednost: number | string;
  [key: string]: unknown;
}

// Oblik stavke koji očekuje erp.sp_racuni_unos — isti oblik kao StavkaZaUnos
// u racuniZiralni.tsx (pripremiRacunZaUnos).
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

interface RacunHeaderStorno {
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
  storniran: number;
}

interface RacunZaUnos {
  header: RacunHeaderStorno;
  items: StavkaZaUnos[];
}

interface UnosOdgovor {
  success?: boolean;
  error?: string;
  broj_racuna?: number | string;
  affected_rows?: number | null;
  sifra_tabele?: number;
}

export function KnjiznaVirmanski() {
  const [racuni, setRacuni] = useState<RacunPregledRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [ucitavaStarije, setUcitavaStarije] = useState(false);
  const [greskaStarije, setGreskaStarije] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");

  const [odabraniRacun, setOdabraniRacun] = useState<RacunPregledRed | null>(
    null,
  );
  const [pokaziModal, setPokaziModal] = useState(false);
  const [storniranjeLoading, setStorniranjeLoading] = useState(false);
  const [storniranjeGreska, setStorniranjeGreska] = useState<string | null>(
    null,
  );
  const [storniranjeUpozorenje, setStorniranjeUpozorenje] = useState<
    string | null
  >(null);
  const [storniranjeUspjeh, setStorniranjeUspjeh] = useState<string | null>(
    null,
  );

  // GET /api/pregledi/racuna (sp_racuni_gl_pregled) vraća samo zadnjih 200
  // računa SVIH vrsta — zato isto dvofazno učitavanje kao racuniPregled.tsx i
  // racuniKnjiznaGotovinski.tsx: stats -> granica = max_sifra - 200 ->
  // "glavna" (najnoviji, odmah prikazani) pa "pozadina" (svi stariji, dopisuju
  // se kad stignu). U state ulaze samo VP računi.
  const samoVp = (redovi: RacunPregledRed[]) =>
    redovi.filter((r) => Number(r.vrsta_racuna_novi) === VRSTA_RACUNA_NOVI_VP);

  const ucitajRacune = async () => {
    setLoading(true);
    setGreska(null);
    setGreskaStarije(null);
    try {
      const statsRes = await fetch(`${API_URL}/api/pregledi/racuna/stats`, {
        credentials: "include",
      });
      const statsJson = await statsRes.json();
      if (!statsRes.ok || !statsJson.success) {
        setGreska(
          statsJson.error || statsJson.message || "Greška pri učitavanju računa",
        );
        setLoading(false);
        return;
      }
      const granica = (Number(statsJson.data?.max_sifra) || 0) - 200;

      const glavnaRes = await fetch(
        `${API_URL}/api/pregledi/racuna/glavna?granica=${granica}`,
        { credentials: "include" },
      );
      const glavnaJson = await glavnaRes.json();
      if (!glavnaRes.ok || !glavnaJson.success) {
        setGreska(
          glavnaJson.error || glavnaJson.message || "Greška pri učitavanju računa",
        );
        setLoading(false);
        return;
      }
      setRacuni(samoVp(glavnaJson.data ?? []));
      setLoading(false);

      setUcitavaStarije(true);
      try {
        const pozadinaRes = await fetch(
          `${API_URL}/api/pregledi/racuna/pozadina?granica=${granica}`,
          { credentials: "include" },
        );
        const pozadinaJson = await pozadinaRes.json();
        if (pozadinaRes.ok && pozadinaJson.success) {
          setRacuni((prev) => [...prev, ...samoVp(pozadinaJson.data ?? [])]);
        } else {
          setGreskaStarije(
            pozadinaJson.error ||
              pozadinaJson.message ||
              "Greška pri učitavanju starijih računa",
          );
        }
      } catch {
        setGreskaStarije("Greška pri učitavanju starijih računa");
      } finally {
        setUcitavaStarije(false);
      }
    } catch {
      setGreska("Greška pri učitavanju računa");
      setLoading(false);
    }
  };

  useEffect(() => {
    void ucitajRacune();
  }, []);

  // Prikazuju se svi VP računi — i već stornirani, ali zaključani (katanac,
  // klik ne otvara storno).
  const vpRacuni = racuni;
  const brojStorniranih = useMemo(
    () => vpRacuni.filter(jeStorniran).length,
    [vpRacuni],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return vpRacuni;
    return vpRacuni.filter((r) =>
      [r.naziv_partnera, r.broj_racuna, r.vrsta_racuna_novo, r.br_fiskalnog]
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [vpRacuni, pretraga]);

  const zatvoriModal = () => {
    setPokaziModal(false);
    setOdabraniRacun(null);
    setStorniranjeGreska(null);
    setStorniranjeUpozorenje(null);
    setStorniranjeUspjeh(null);
  };

  const handleKlikRacun = (r: RacunPregledRed) => {
    if (jeStorniran(r)) return;
    setOdabraniRacun(r);
    setPokaziModal(true);
    setStorniranjeGreska(null);
    setStorniranjeUpozorenje(null);
    setStorniranjeUspjeh(null);
  };

  const handlePotvrdiStorno = async () => {
    if (!odabraniRacun) return;
    setStorniranjeLoading(true);
    setStorniranjeGreska(null);
    setStorniranjeUpozorenje(null);
    try {
      const resStavke = await fetch(
        `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${odabraniRacun.sifra_tabele}`,
        { credentials: "include" },
      );
      const jsonStavke = await resStavke.json();
      if (!resStavke.ok || !jsonStavke.success) {
        throw new Error(
          jsonStavke.error || "Greška pri učitavanju stavki računa",
        );
      }
      const stavke: StavkaPregled[] = jsonStavke.data ?? [];
      if (stavke.length === 0) {
        throw new Error("Račun nema stavki — storno nije moguć.");
      }

      // Jedinične cijene ostaju POZITIVNE — samo količina i već-izračunati
      // iznosi rabata po stavci (rabat_km/_2/_3) mijenjaju predznak zajedno
      // sa količinom.
      const items: StavkaZaUnos[] = stavke.map((s) => {
        const sifraProizvoda = Number(String(s.sifra_proizvoda).trim());
        if (!Number.isFinite(sifraProizvoda)) {
          throw new Error(
            `Neispravna šifra proizvoda za storno: ${s.sifra_proizvoda} (${s.naziv_proizvoda})`,
          );
        }
        const kolicina = -Math.abs(Number(s.kolicina) || 0);
        const cijenaSaRab = round2(Number(s.cijena_sa_rab) || 0);
        return {
          sifra_proizvoda: sifraProizvoda,
          cijena_proizvoda: round2(Number(s.nabavna_cijena_proizvoda) || 0),
          prodajna_cijena: round2(Number(s.prodajna_cijena) || 0),
          kolicina,
          rabat_proc: round2(Number(s.rabat_proc) || 0),
          rabat_km: -Math.abs(round2(Number(s.rabat_km) || 0)),
          vpc: cijenaSaRab,
          vpc_bez_rabata: round2(Number(s.vpc_bez_rabata) || 0),
          rabat_proc_2: round2(Number(s.rabat_proc_2) || 0),
          rabat_km_2: -Math.abs(round2(Number(s.rabat_km_2) || 0)),
          vpc_sa_rabat_2: round2(Number(s.vpc_sa_rab_2) || 0),
          rabat_proc_3: round2(Number(s.rab_proc_3) || 0),
          rabat_km_3: -Math.abs(round2(Number(s.rabat_km_3) || 0)),
          vpc_rabat_1: round2(Number(s.vpc_rabat_1) || 0),
          pdv_po_artiklu: round2(Number(s.pdv_po_artiklu) || 0),
          nabavna_cijena_proizvoda: round2(
            Number(s.nabavna_cijena_proizvoda) || 0,
          ),
        };
      });

      const sada = new Date();
      const datumRacuna = formatDatumIso(sada);
      const ukupnoStorno = -Math.abs(round2(Number(odabraniRacun.ukupno) || 0));
      const oznakaOriginala =
        odabraniRacun.vrsta_racuna_novo ?? odabraniRacun.broj_racuna;

      const header: RacunHeaderStorno = {
        vrsta_racuna: VRSTA_RACUNA,
        sifra_kupca: Number(odabraniRacun.sifra_partnera) || 0,
        datum_racuna: datumRacuna,
        ukupno: ukupnoStorno,
        sifra_radnika: Number(odabraniRacun.sifra_radnika) || 0,
        slovima: `Storno: ${brojUSlovima(ukupnoStorno)}`,
        valuta: odabraniRacun.valuta
          ? String(odabraniRacun.valuta)
          : datumRacuna,
        datum_isporuke: odabraniRacun.datum_isporuke
          ? String(odabraniRacun.datum_isporuke)
          : datumRacuna,
        napomena: `Storno računa br. ${oznakaOriginala} od ${formatDatumDMY(odabraniRacun.datum_racuna)}`,
        rabat_km: -Math.abs(round2(Number(odabraniRacun.rabat_km) || 0)),
        vreme: formatVremeIso(sada),
        VP_vrednost: -Math.abs(round2(Number(odabraniRacun.vrednost) || 0)),
        vp_vrednost_original: -Math.abs(
          round2(Number(odabraniRacun.vrednost) || 0),
        ),
        VP_1: -Math.abs(round2(Number(odabraniRacun.vp1) || 0)),
        VP_2: -Math.abs(round2(Number(odabraniRacun.vp2) || 0)),
        vrsta_racuna_novi: VRSTA_RACUNA_NOVI_STORNO,
        vrsta_racuna_pod: Number(odabraniRacun.vrsta_racuna_pod) || 0,
        sifra_terena: Number(odabraniRacun.sifra_terena) || 0,
        storniran: 1,
      };

      const podaci: RacunZaUnos = { header, items };

      const res = await fetch(`${API_URL}/api/racuni/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(podaci),
      });
      const json: UnosOdgovor = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error || `Greška pri čuvanju storno računa (HTTP ${res.status})`,
        );
      }
      const imaBrojRacuna =
        json.broj_racuna !== undefined &&
        json.broj_racuna !== null &&
        String(json.broj_racuna).trim() !== "";
      const affectedRows = Number(json.affected_rows ?? 0);
      const imaAffectedRows = Number.isFinite(affectedRows) && affectedRows > 0;
      if (!imaBrojRacuna && !imaAffectedRows) {
        throw new Error("Upis storno računa nije pouzdano potvrđen.");
      }

      setStorniranjeUspjeh(
        `Storno je sačuvan${imaBrojRacuna ? ` (broj ${json.broj_racuna})` : ""}.`,
      );

      // Markiranje originala kao storniranog — best-effort. Storno je već
      // upisan i nepovratan, pa neuspjeh ovog koraka NIJE greška upisa, samo
      // upozorenje da original ostaje vidljiv u listi dok se ručno ne provjeri.
      if (json.sifra_tabele) {
        try {
          const resStorniraj = await fetch(`${API_URL}/api/racuni/storniraj`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              sifra_tabele_originala: odabraniRacun.sifra_tabele,
              sifra_tabele_storna: json.sifra_tabele,
            }),
          });
          const jsonStorniraj = await resStorniraj.json().catch(() => null);
          if (!resStorniraj.ok || !jsonStorniraj?.success) {
            throw new Error(
              jsonStorniraj?.error || `HTTP ${resStorniraj.status}`,
            );
          }
          const sifraOriginala = odabraniRacun.sifra_tabele;
          setRacuni((prev) =>
            prev.map((r) =>
              r.sifra_tabele === sifraOriginala
                ? { ...r, storniran_racun: 1 }
                : r,
            ),
          );
        } catch (markError) {
          setStorniranjeUpozorenje(
            `Storno je sačuvan, ali originalni račun nije markiran kao storniran: ${
              markError instanceof Error ? markError.message : String(markError)
            }`,
          );
        }
      }
    } catch (error) {
      setStorniranjeGreska(
        error instanceof Error
          ? error.message
          : "Greška pri storniranju računa.",
      );
    } finally {
      setStorniranjeLoading(false);
    }
  };

  const th =
    "px-4 py-2.5 font-semibold border-b border-teal-800 whitespace-nowrap";

  return (
    <div className="flex flex-col items-center">
      <div className="w-fit max-w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-50 dark:bg-teal-500/15">
            <BookMarked size={20} style={{ color: VP_BOJA }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6] flex items-center gap-2">
              Knjižna virmanski
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider text-white"
                style={{ background: VP_BOJA }}
              >
                VELEPRODAJA
              </span>
            </h2>
            {!loading && !greska && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878] flex items-center gap-1.5">
                VP računi: {filtrirani.length} / {vpRacuni.length} · stornirano:{" "}
                {brojStorniranih}
                {ucitavaStarije && (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    učitavanje starijih računa...
                  </>
                )}
              </p>
            )}
            {greskaStarije && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertTriangle size={11} />
                {greskaStarije} — prikazani su samo najnoviji računi.
              </p>
            )}
          </div>
        </div>

        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm p-4"
          style={{ borderLeftColor: VP_BOJA }}
        >
          <div className="relative max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraži VP račune..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-teal-600 transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
        </div>

        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm overflow-hidden"
          style={{ borderLeftColor: VP_BOJA }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-10 px-16 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Učitavanje...</span>
            </div>
          ) : greska ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-red-500">
              <AlertTriangle size={24} />
              <span className="text-sm">{greska}</span>
            </div>
          ) : filtrirani.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-gray-400 dark:text-[#5f5878]">
              <Package size={24} className="text-gray-300 dark:text-[#3a3158]" />
              <span className="text-sm">Nema VP računa</span>
            </div>
          ) : (
            <table className="w-auto text-sm border-collapse">
              <thead>
                <tr className="text-white" style={{ background: VP_BOJA }}>
                  <th className={`${th} text-left`}>Broj računa</th>
                  <th className={`${th} text-left`}>Datum</th>
                  <th className={`${th} text-left`}>Partner</th>
                  <th className={`${th} text-right`}>UKUPNO</th>
                  <th className={`${th} text-left`}>Br. fiskalnog</th>
                  <th className={`${th} text-left`}>Datum fiskalnog</th>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r, i) => {
                  const imaFiskalni =
                    r.br_fiskalnog !== null &&
                    r.br_fiskalnog !== undefined &&
                    String(r.br_fiskalnog).trim() !== "";
                  const storniran = jeStorniran(r);
                  return (
                    <tr
                      key={r.sifra_tabele}
                      onClick={storniran ? undefined : () => handleKlikRacun(r)}
                      title={
                        storniran
                          ? "Račun je već storniran — ne može se ponovo stornirati"
                          : undefined
                      }
                      className={`border-b border-gray-100 dark:border-[#2a2340] transition-colors ${
                        storniran
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-500/15"
                      } ${
                        i % 2 === 0
                          ? "bg-white dark:bg-[#1a1528]"
                          : "bg-[#f3faf9] dark:bg-[#1e1a2d]"
                      }`}
                    >
                      <td
                        className={`px-4 py-2 font-semibold whitespace-nowrap ${
                          storniran
                            ? "text-red-500"
                            : "text-teal-700 dark:text-teal-400"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {storniran && <Lock size={13} className="flex-shrink-0" />}
                          {r.vrsta_racuna_novo ?? r.broj_racuna}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-[#c5bfd8] whitespace-nowrap">
                        {formatDatumDMY(r.datum_racuna)}
                      </td>
                      <td className="px-4 py-2 text-gray-800 dark:text-[#ede9f6]">
                        {r.naziv_partnera}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-[#ede9f6] whitespace-nowrap">
                        {Number(r.ukupno).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {imaFiskalni ? (
                          <span className="text-gray-600 dark:text-[#c5bfd8]">
                            {r.br_fiskalnog}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500 text-xs">
                            <AlertTriangle size={12} />
                            Nema fiskalnog
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-[#c5bfd8] whitespace-nowrap">
                        {imaFiskalni
                          ? formatDatumVrijemeDMY(r.datum_vreme_fiskalnog)
                          : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pokaziModal &&
        odabraniRacun &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !storniranjeLoading) {
                zatvoriModal();
              }
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border-2 w-[480px] max-h-[80vh] flex flex-col overflow-hidden"
              style={{ borderColor: storniranjeUspjeh ? ACCENT : DANGER }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: storniranjeUspjeh ? PRIMARY : DANGER }}
              >
                <AlertTriangle size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Storno računa{" "}
                    {odabraniRacun.vrsta_racuna_novo ??
                      odabraniRacun.broj_racuna}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabraniRacun.naziv_partnera}
                  </div>
                </div>
                <button
                  onClick={zatvoriModal}
                  disabled={storniranjeLoading}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-auto space-y-3">
                {storniranjeUspjeh ? (
                  <div className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeUspjeh}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                    Da li ste sigurni da želite stornirati CIJELI račun br.{" "}
                    <strong>
                      {odabraniRacun.vrsta_racuna_novo ??
                        odabraniRacun.broj_racuna}
                    </strong>{" "}
                    (partner <strong>{odabraniRacun.naziv_partnera}</strong>,
                    iznos{" "}
                    <strong>{Number(odabraniRacun.ukupno).toFixed(2)}</strong>)?
                    Storniranje nije moguće djelimično, a akcija se ne može
                    poništiti.
                  </p>
                )}

                {!storniranjeUspjeh &&
                  (odabraniRacun.br_fiskalnog === null ||
                    odabraniRacun.br_fiskalnog === undefined ||
                    String(odabraniRacun.br_fiskalnog).trim() === "") && (
                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                      <AlertTriangle
                        size={14}
                        className="flex-shrink-0 mt-0.5"
                      />
                      <span>
                        Ovaj račun nema broj fiskalnog računa — fiskalni storno
                        kasnije neće biti moguć za njega.
                      </span>
                    </div>
                  )}

                {storniranjeUpozorenje && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeUpozorenje}</span>
                  </div>
                )}

                {storniranjeGreska && (
                  <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeGreska}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                {storniranjeUspjeh ? (
                  <button
                    onClick={zatvoriModal}
                    className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all"
                    style={{ background: PRIMARY }}
                  >
                    Zatvori
                  </button>
                ) : (
                  <>
                    <button
                      onClick={zatvoriModal}
                      disabled={storniranjeLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
                    >
                      Otkaži
                    </button>
                    <button
                      onClick={handlePotvrdiStorno}
                      disabled={storniranjeLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60"
                      style={{ background: DANGER }}
                    >
                      {storniranjeLoading && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      Potvrdi storno
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
