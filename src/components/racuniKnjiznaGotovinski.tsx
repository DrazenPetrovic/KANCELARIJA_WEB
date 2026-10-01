import ReactDOM from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Package,
  Search,
  X,
} from "lucide-react";
import {
  ESIR_SLIP_PRESET_58MM,
  izdajFiskalniRacun,
  izdvojiFiskalnePodatke,
  jeEsirZakljucanZbogPina,
  jePotrebanPin,
  preuzmiStatusEsira,
  proveriFiskalizacijuPoRequestId,
  type EsirInvoiceRequest,
  type EsirInvoiceResponse,
} from "./fiskalniRacuni";
import {
  preuzmiOriginalniFiskalniRacun,
  pripremiRefundZahtjev,
} from "./fiskalniStorno";
import { getCurrentUser } from "../utils/auth";
import { usePrint } from "../context/PrintContext";
import { RacunA5 } from "../print/templates/RacunA5";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const DANGER = "#ef4444";

// Storno je uvijek za cijeli gotovinski (MP) račun — vidi racuniGotovinski.tsx
// (VRSTA_RACUNA_NOVI=1 za normalan unos, 3 = storno MP po racuniPregled.tsx).
// Upis storna radi erp.racuni_unos_storno (POST /api/racuni/storno) na
// serveru: kopija sa količinom * -1, povrat na lager i storniran_racun=1 na
// originalu u jednoj transakciji. Zatim ide ESIR refundacija (transactionType
// "Refund", sadržaj originala preuzet sa ESIR-a — vidi fiskalniStorno.ts) i
// upis fiskalnog broja na storno red.
const VRSTA_RACUNA_NOVI_MP = 1;

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDatumIso = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
const imaVrijednost = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";
// Fallback na "stornirano" isto kao u racuniPregled.tsx (procedura zna
// vratiti kolonu i pod tim imenom).
const jeStorniran = (r: { storniran_racun?: unknown; stornirano?: unknown }) =>
  Number(r.storniran_racun ?? r.stornirano) === 1;

// Red vraćen sa erp.sp_racuni_gl_pregled (GET /api/pregledi/racuna) — isti
// izvor kao racuniPregled.tsx i racuniKnjiznaVirmanski.tsx.
interface RacunPregledRed {
  sifra_tabele: number;
  broj_racuna: number | string;
  vrsta_racuna_novi: number | string;
  vrsta_racuna_novo?: string;
  vrsta_racuna_pod: number | string;
  datum_racuna: string;
  sifra_partnera: number | string;
  naziv_partnera: string;
  br_fiskalnog?: string | number | null;
  datum_vreme_fiskalnog?: string | null;
  ukupno: number | string;
  storniran_racun?: number | string | null;
  [key: string]: unknown;
}

// Red sa erp.sp_racuni_po_pregled (GET /api/racuni/pregled-stavke) — samo
// polja potrebna za A5 štampu storna.
interface StavkaStorna {
  sifra_proizvoda: number | string;
  naziv_proizvoda?: string;
  jm?: string;
  kolicina: number | string;
  prodajna_cijena: number | string;
  [key: string]: unknown;
}

export function KnjiznaGotovinski() {
  const [racuni, setRacuni] = useState<RacunPregledRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [ucitavaStarije, setUcitavaStarije] = useState(false);
  const [greskaStarije, setGreskaStarije] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [odabraniRacun, setOdabraniRacun] = useState<RacunPregledRed | null>(
    null,
  );
  const [storniranjeLoading, setStorniranjeLoading] = useState(false);
  const [storniranjeGreska, setStorniranjeGreska] = useState<string | null>(
    null,
  );
  const [storniranjeUspjeh, setStorniranjeUspjeh] = useState<string | null>(
    null,
  );
  const [storniranjeUpozorenje, setStorniranjeUpozorenje] = useState<
    string | null
  >(null);
  const [storniranjeKorak, setStorniranjeKorak] = useState<string | null>(null);
  // Storno je upisan u bazu, ali ESIR refundacija (ili upis fiskalnog broja)
  // nije završena — čuva se zahtjev da se može ponoviti sa ISTIM RequestId-em.
  const [esirNedovrsen, setEsirNedovrsen] = useState<{
    sifraStorna: number | string;
    brojStorna: number | string | null;
    zahtjev: EsirInvoiceRequest;
    original: RacunPregledRed;
  } | null>(null);
  const { openPrint } = usePrint();

  // Pregled za štampu storno računa na istom A5 šablonu kao gotovinski unos
  // (racuniGotovinski.tsx) — stavke se čitaju iz baze za STORNO zapis
  // (negativne količine), partner sa originala, a PFR broj/datum/QR iz ESIR
  // odgovora refundacije (bez njih ako refundacija još nije prošla).
  const otvoriStampuStorna = async (
    original: RacunPregledRed,
    sifraStorna: number | string,
    brojStorna: number | string | null,
    invoiceResponse: EsirInvoiceResponse | null,
  ) => {
    let stavke: StavkaStorna[] = [];
    try {
      const res = await fetch(
        `${API_URL}/api/racuni/pregled-stavke?sifraTabele=${sifraStorna}`,
        { credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      stavke = json.data ?? [];
    } catch (error) {
      setStorniranjeUpozorenje(
        `Storno je sačuvan, ali stavke za štampu nisu učitane: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const sada = new Date();
    const brojRacunaZaStampu = `STORNO-${original.vrsta_racuna_pod ?? 0}-${
      brojStorna ?? "-"
    } / ${String(sada.getFullYear()).slice(-2)}`;
    openPrint({
      title: `Račun ${brojRacunaZaStampu}`,
      format: "A5",
      component: (
        <RacunA5
          racun={{
            broj_racuna: brojRacunaZaStampu,
            datum_racuna: formatDatumIso(sada),
            naziv_partnera: original.naziv_partnera,
            sifra_partnera: original.sifra_partnera,
            adresa_partnera: (original.adresa_partnera as string | null) ?? null,
            naziv_grada: (original.naziv_grada as string | null) ?? null,
            // Isti tekst koji upisuje erp.racuni_unos_storno u napomenu.
            napomena: `STORNO racuna br. ${original.broj_racuna} (sifra_tabele ${original.sifra_tabele})`,
            ukupno: -Math.abs(Number(original.ukupno) || 0),
            br_fiskalnog: invoiceResponse?.invoiceNumber ?? null,
            datum_vreme_fiskalnog: invoiceResponse?.sdcDateTime ?? null,
            verifikacioni_qr: invoiceResponse?.verificationQRCode ?? null,
            sifra_tabele: sifraStorna,
          }}
          stavke={stavke.map((s) => {
            const kolicina = Number(s.kolicina) || 0;
            const mpc = Number(s.prodajna_cijena) || 0;
            return {
              sifra_proizvoda: s.sifra_proizvoda,
              naziv_proizvoda: String(s.naziv_proizvoda ?? ""),
              jm: String(s.jm ?? ""),
              kolicina,
              prodajna_cijena: mpc,
              // MP: ukupno stavke iz MPC-a (vidi jeMpRacun u racuniPregled.tsx).
              prodajna_vrednost: Math.round(mpc * kolicina * 100) / 100,
            };
          })}
        />
      ),
    });
  };

  const resetujStanjeStorna = () => {
    setStorniranjeGreska(null);
    setStorniranjeUspjeh(null);
    setStorniranjeUpozorenje(null);
    setStorniranjeKorak(null);
    setEsirNedovrsen(null);
  };

  const otvoriModal = (r: RacunPregledRed) => {
    if (jeStorniran(r)) return;
    setOdabraniRacun(r);
    resetujStanjeStorna();
  };

  const zatvoriModal = () => {
    if (storniranjeLoading) return;
    setOdabraniRacun(null);
    resetujStanjeStorna();
  };

  // ESIR refundacija + upis br_fiskalnog/datum_vreme_fiskalnog na STORNO red.
  // RequestId = sifra_tabele storna (isti obrazac kao racuniGotovinski.tsx), pa
  // je ponovni pokušaj idempotentan; kod ponavljanja se prvo provjerava da li
  // je ESIR refundaciju već izvršio (npr. odgovor se izgubio na mreži).
  const fiskalizujIUpisi = async (
    sifraStorna: number | string,
    zahtjev: EsirInvoiceRequest,
    provjeriPrvo: boolean,
  ) => {
    const requestId = String(sifraStorna);
    let invoiceResponse: EsirInvoiceResponse | null = null;
    let upozorenje: string | null = null;

    if (provjeriPrvo) {
      setStorniranjeKorak("Provjera da li je refundacija već izvršena...");
      invoiceResponse = await proveriFiskalizacijuPoRequestId(
        "gotovinski",
        requestId,
      ).catch(() => null);
    }

    if (!invoiceResponse) {
      setStorniranjeKorak("Slanje refundacije na ESIR...");
      const rezultat = await izdajFiskalniRacun(
        "gotovinski",
        zahtjev,
        {
          print: true,
          renderReceiptImage: true,
          receiptLayout: "Slip",
          receiptImageFormat: "Png",
          ...ESIR_SLIP_PRESET_58MM,
        },
        requestId,
      );
      invoiceResponse = rezultat.invoiceResponse;
      upozorenje = rezultat.upozorenje;
    }

    const { brFiskalnog, datumVremeFiskalnog } =
      izdvojiFiskalnePodatke(invoiceResponse);

    setStorniranjeKorak("Upis fiskalnog broja storna u bazu...");
    const res = await fetch(`${API_URL}/api/racuni/azuriraj-fiskalne-podatke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sifra_tabele: sifraStorna,
        br_fiskalnog: brFiskalnog,
        datum_vreme_fiskalnog: datumVremeFiskalnog,
      }),
    });
    if (!res.ok) {
      const g = await res.json().catch(() => null);
      throw new Error(
        `ESIR refundacija je izvršena (fiskalni broj ${brFiskalnog}), ali upis u bazu nije uspio: ${
          g?.error || `HTTP ${res.status}`
        }`,
      );
    }
    return { brFiskalnog, upozorenje, invoiceResponse };
  };

  const handlePotvrdiStorno = async () => {
    if (!odabraniRacun || storniranjeLoading) return;
    const sifraOriginala = odabraniRacun.sifra_tabele;
    const brFiskalnogOriginala = String(odabraniRacun.br_fiskalnog ?? "").trim();
    setStorniranjeLoading(true);
    resetujStanjeStorna();

    // Faza 1 — sve provjere PRIJE upisa u bazu: ako ESIR nije spreman ili
    // original nije na uređaju, ništa se ne upisuje.
    let zahtjev: EsirInvoiceRequest;
    try {
      if (!brFiskalnogOriginala) {
        throw new Error(
          "Račun nema broj fiskalnog računa — ESIR refundacija nije moguća.",
        );
      }
      if (jeEsirZakljucanZbogPina("gotovinski")) {
        throw new Error(
          "ESIR gotovinski je zaključan zbog neuspjelih pokušaja PIN-a — unesite PIN ručno pa pokušajte ponovo.",
        );
      }
      setStorniranjeKorak("Provjera ESIR uređaja...");
      const status = await preuzmiStatusEsira("gotovinski");
      if (jePotrebanPin(status)) {
        throw new Error(
          "ESIR gotovinski traži PIN — unesite PIN (ekran Gotovinski račun) pa pokušajte ponovo.",
        );
      }
      setStorniranjeKorak("Preuzimanje originalnog fiskalnog računa...");
      const original = await preuzmiOriginalniFiskalniRacun(
        "gotovinski",
        brFiskalnogOriginala,
      );
      zahtjev = pripremiRefundZahtjev(
        original,
        (getCurrentUser()?.username ?? "").toUpperCase(),
      );
    } catch (error) {
      setStorniranjeGreska(
        `Storno nije urađen (ništa nije upisano): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
      return;
    }

    // Faza 2 — upis storna u bazu (erp.racuni_unos_storno).
    let sifraStorna: number | string;
    let brojStorna: number | string | null;
    try {
      setStorniranjeKorak("Upis storna u bazu...");
      const res = await fetch(`${API_URL}/api/racuni/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sifra_tabele: sifraOriginala }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || `Greška pri storniranju računa (HTTP ${res.status})`,
        );
      }
      if (!imaVrijednost(json.sifra_tabele)) {
        throw new Error("Procedura storna nije vratila šifru tabele storna.");
      }
      sifraStorna = json.sifra_tabele;
      brojStorna = imaVrijednost(json.broj_racuna) ? json.broj_racuna : null;
      // Procedura je već postavila storniran_racun=1 na originalu — lokalno
      // isto, da red odmah nestane iz liste kandidata.
      setRacuni((prev) =>
        prev.map((r) =>
          r.sifra_tabele === sifraOriginala ? { ...r, storniran_racun: 1 } : r,
        ),
      );
    } catch (error) {
      setStorniranjeGreska(
        error instanceof Error ? error.message : "Greška pri storniranju računa.",
      );
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
      return;
    }

    // Faza 3 — ESIR refundacija + upis fiskalnog broja na storno. A5 se
    // otvara u svakom slučaju (storno je u bazi), sa QR/PFR podacima ako je
    // refundacija prošla.
    const original = odabraniRacun;
    try {
      const { brFiskalnog, upozorenje, invoiceResponse } = await fiskalizujIUpisi(
        sifraStorna,
        zahtjev,
        false,
      );
      void otvoriStampuStorna(original, sifraStorna, brojStorna, invoiceResponse);
      setStorniranjeUspjeh(
        `Račun je storniran${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""} i refundacija je fiskalizovana (fiskalni broj ${brFiskalnog}).`,
      );
      if (upozorenje) {
        setStorniranjeUpozorenje(
          `Refundacija je fiskalizovana, ali uređaj javlja: ${upozorenje}`,
        );
      }
    } catch (error) {
      setEsirNedovrsen({ sifraStorna, brojStorna, zahtjev, original });
      void otvoriStampuStorna(original, sifraStorna, brojStorna, null);
      setStorniranjeGreska(
        `Storno je upisan u bazu${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""}, ali ESIR refundacija nije završena: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
    }
  };

  const handlePonoviEsir = async () => {
    if (!esirNedovrsen || storniranjeLoading) return;
    const { sifraStorna, brojStorna, zahtjev, original } = esirNedovrsen;
    setStorniranjeLoading(true);
    setStorniranjeGreska(null);
    setStorniranjeUpozorenje(null);
    try {
      const { brFiskalnog, upozorenje, invoiceResponse } = await fiskalizujIUpisi(
        sifraStorna,
        zahtjev,
        true,
      );
      setEsirNedovrsen(null);
      void otvoriStampuStorna(original, sifraStorna, brojStorna, invoiceResponse);
      setStorniranjeUspjeh(
        `Račun je storniran${brojStorna !== null ? ` (storno br. ${brojStorna})` : ""} i refundacija je fiskalizovana (fiskalni broj ${brFiskalnog}).`,
      );
      if (upozorenje) {
        setStorniranjeUpozorenje(
          `Refundacija je fiskalizovana, ali uređaj javlja: ${upozorenje}`,
        );
      }
    } catch (error) {
      setStorniranjeGreska(
        `ESIR refundacija i dalje nije završena: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setStorniranjeKorak(null);
      setStorniranjeLoading(false);
    }
  };

  // GET /api/pregledi/racuna (sp_racuni_gl_pregled) vraća samo zadnjih 200
  // računa SVIH vrsta — zato isto dvofazno učitavanje kao racuniPregled.tsx
  // (vidi docs/sp_racuni_gl_nit_glavna_pozadina.sql): stats -> granica =
  // max_sifra - 200 -> "glavna" (najnoviji, odmah prikazani) pa "pozadina"
  // (svi stariji, dopisuju se kad stignu). U state ulaze samo MP računi.
  const samoMp = (redovi: RacunPregledRed[]) =>
    redovi.filter((r) => Number(r.vrsta_racuna_novi) === VRSTA_RACUNA_NOVI_MP);

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
      setRacuni(samoMp(glavnaJson.data ?? []));
      setLoading(false);

      setUcitavaStarije(true);
      try {
        const pozadinaRes = await fetch(
          `${API_URL}/api/pregledi/racuna/pozadina?granica=${granica}`,
          { credentials: "include" },
        );
        const pozadinaJson = await pozadinaRes.json();
        if (pozadinaRes.ok && pozadinaJson.success) {
          setRacuni((prev) => [...prev, ...samoMp(pozadinaJson.data ?? [])]);
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

  // Prikazuju se svi MP računi — i već stornirani, ali zaključani (katanac,
  // klik ne otvara storno). Procedura erp.racuni_unos_storno ionako odbija
  // ponovni storno ("Racun je vec storniran."), ovo je samo da se ne pokušava.
  const mpRacuni = useMemo(
    () =>
      racuni.filter(
        (r) => Number(r.vrsta_racuna_novi) === VRSTA_RACUNA_NOVI_MP,
      ),
    [racuni],
  );
  const brojStorniranih = useMemo(
    () => mpRacuni.filter(jeStorniran).length,
    [mpRacuni],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return mpRacuni;
    return mpRacuni.filter((r) =>
      [r.naziv_partnera, r.broj_racuna, r.vrsta_racuna_novo, r.br_fiskalnog]
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [mpRacuni, pretraga]);

  const th =
    "px-4 py-2.5 font-semibold border-b border-gray-200 dark:border-[#2d2648] whitespace-nowrap";

  return (
    <div className="flex flex-col items-center">
      <div className="w-fit max-w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <BookOpen size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
              Knjižna gotovinski
            </h2>
            {!loading && !greska && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878] flex items-center gap-1.5">
                MP računi: {filtrirani.length} / {mpRacuni.length} · stornirano:{" "}
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

        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
          <div className="relative max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraži MP račune..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
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
              <span className="text-sm">Nema MP računa</span>
            </div>
          ) : (
            <table className="w-auto text-sm border-collapse">
              <thead>
                <tr className="bg-[#f4f1f9] dark:bg-[#1e1a2d] text-gray-500 dark:text-[#7d7498]">
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
                  const imaFiskalni = imaVrijednost(r.br_fiskalnog);
                  const storniran = jeStorniran(r);
                  return (
                    <tr
                      key={r.sifra_tabele}
                      onClick={storniran ? undefined : () => otvoriModal(r)}
                      title={
                        storniran
                          ? "Račun je već storniran — ne može se ponovo stornirati"
                          : undefined
                      }
                      className={`border-b border-gray-100 dark:border-[#2a2340] transition-colors ${
                        storniran
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-[#f4f1f9] dark:hover:bg-[#2d2648]"
                      } ${
                        i % 2 === 0
                          ? "bg-white dark:bg-[#1a1528]"
                          : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                      }`}
                    >
                      <td
                        className="px-4 py-2 font-semibold whitespace-nowrap"
                        style={{ color: storniran ? DANGER : PRIMARY }}
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

      {odabraniRacun &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) zatvoriModal();
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
                    {odabraniRacun.vrsta_racuna_novo ?? odabraniRacun.broj_racuna}
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
                ) : esirNedovrsen ? null : (
                  <p className="text-sm text-gray-600 dark:text-[#c5bfd8]">
                    Da li ste sigurni da želite stornirati CIJELI račun br.{" "}
                    <strong>
                      {odabraniRacun.vrsta_racuna_novo ?? odabraniRacun.broj_racuna}
                    </strong>{" "}
                    od <strong>{formatDatumDMY(odabraniRacun.datum_racuna)}</strong>{" "}
                    (partner <strong>{odabraniRacun.naziv_partnera}</strong>, iznos{" "}
                    <strong>{Number(odabraniRacun.ukupno).toFixed(2)}</strong>)?
                    Djelimično storniranje nije moguće, a akcija se ne može
                    poništiti.
                  </p>
                )}

                {!storniranjeUspjeh && !imaVrijednost(odabraniRacun.br_fiskalnog) && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Ovaj račun nema broj fiskalnog računa — ESIR refundacija nije
                      moguća, pa se ne može ni stornirati.
                    </span>
                  </div>
                )}

                {!storniranjeUspjeh && !esirNedovrsen && (
                  <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-[#7d7498] bg-gray-50 dark:bg-[#1e1a2d] rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Storno se upisuje u bazu i odmah se šalje ESIR refundacija
                      na kasu gotovinski (isti sadržaj kao originalni fiskalni
                      račun).
                    </span>
                  </div>
                )}

                {storniranjeKorak && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#7d7498]">
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    <span>{storniranjeKorak}</span>
                  </div>
                )}

                {storniranjeUpozorenje && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{storniranjeUpozorenje}</span>
                  </div>
                )}

                {esirNedovrsen && !storniranjeLoading && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Ako zatvorite prozor bez ponovnog pokušaja, storno ostaje u
                      bazi bez fiskalnog broja.
                    </span>
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
                      {esirNedovrsen ? "Zatvori" : "Otkaži"}
                    </button>
                    {esirNedovrsen ? (
                      <button
                        onClick={handlePonoviEsir}
                        disabled={storniranjeLoading}
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60"
                        style={{ background: PRIMARY }}
                      >
                        {storniranjeLoading && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        Ponovi ESIR refundaciju
                      </button>
                    ) : (
                      <button
                        onClick={handlePotvrdiStorno}
                        disabled={
                          storniranjeLoading ||
                          !imaVrijednost(odabraniRacun.br_fiskalnog)
                        }
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: DANGER }}
                      >
                        {storniranjeLoading && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        Potvrdi storno
                      </button>
                    )}
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
