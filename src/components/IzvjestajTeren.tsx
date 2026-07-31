import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  MapPin,
  MapPinOff,
  Printer,
  RotateCcw,
  ScanBarcode,
  Trash2,
} from "lucide-react";
import { usePrint } from "../context/PrintContext";
import { IzvjestajTerenA4 } from "../print/templates/IzvjestajTerenA4";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Isti oblik kao u racuniZiralni.tsx/racuniGotovinski.tsx (GET /api/teren/terena-po-danima).
interface Teren {
  sifra_terena_dostava: number;
  sifra_terena: number;
  naziv_dana: string;
  datum_dostave?: string;
  zavrsena_dostava?: number;
}

// Red vraćen sa erp.sp_racuni_gl_pregled (GET /api/pregledi/racuna) — samo
// polja koja su ovdje potrebna, ostatak je zanemaren.
interface RacunRed {
  sifra_tabele: number | string;
  broj_racuna?: number | string;
  vrsta_racuna_novo?: string;
  vrsta_racuna_novi?: number | string;
  naziv_partnera?: string;
  sifra_partnera?: number | string;
  ukupno?: number | string;
  sifra_terena?: number | string;
  storniran_racun?: number | string;
  napomena?: string | null;
  sifra_radnika?: number | string;
  naziv_radnika?: string;
}

interface IzvjestajStavka {
  sifra_tabele: number;
  broj_racuna_prikaz: string;
  naziv_partnera: string;
  ukupno: number;
  napomena: string | null;
  radnik: string;
  // vrsta_racuna_novi === 1 -> MP (gotovinski), sve ostalo -> VP (žiralni) —
  // stornirani (vrsta 3) se ionako nikad ne pojavljuju u ovoj listi.
  jeMp: boolean;
  // sifra_partnera === 300 -> generički "Razni kupci" zapis (vidi
  // racuniGotovinski.tsx) — vizuelno se posebno ističe unutar MP grupe.
  jeRazniKupac: boolean;
  rucnoDodano: boolean;
}

const jeMpVrsta = (v: unknown) => Number(v) === 1;
const jeRazniKupacVrijednost = (v: unknown) => Number(v) === 300;

const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const jeStorniran = (v: unknown) => Number(v) === 1;

// Zvučna potvrda skeniranja — fajlovi su u public/zvuk/, vidi RacunA4.tsx za
// isti obrazac učitavanja statičkih fajlova preko import.meta.env.BASE_URL.
const pustiZvuk = (naziv: string) => {
  const audio = new Audio(`${import.meta.env.BASE_URL}zvuk/${naziv}`);
  void audio.play().catch(() => {});
};
const ZVUK_PRONADJEN = "ERP_Barkod_Pronadjen.wav";
const ZVUK_NIJE_PRONADJEN = "ERP_Barkod_Nije_Pronadjen.wav";

// Napomena dolazi iz baze (unesena pri kreiranju računa) — prazan string se
// tretira kao "nema napomene", isto kao null.
const napomenaVrijednost = (v: string | null | undefined): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

export function IzvjestajTeren() {
  const { openPrint } = usePrint();

  const [tereni, setTereni] = useState<Teren[]>([]);
  const [loadingTereni, setLoadingTereni] = useState(true);
  const [odabraniTeren, setOdabraniTeren] = useState<Teren | null>(null);
  // true čim je operater ili izabrao teren ili svjesno krenuo "bez terena" —
  // razlikuje se od (odabraniTeren !== null) da bi ostatak ekrana (skeniranje,
  // Poništi, Štampaj, tabela) radio i bez izabranog terena.
  const [sesijaAktivna, setSesijaAktivna] = useState(false);
  const [pokaziDropdownTeren, setPokazuiDropdownTeren] = useState(false);
  const terenRef = useRef<HTMLDivElement>(null);

  const [sviRacuni, setSviRacuni] = useState<RacunRed[]>([]);
  const [loadingRacuni, setLoadingRacuni] = useState(true);

  const [stavke, setStavke] = useState<IzvjestajStavka[]>([]);
  const [unosBarkoda, setUnosBarkoda] = useState("");
  const [greskaSkeniranje, setGreskaSkeniranje] = useState<string | null>(
    null,
  );
  const inputBarkodaRef = useRef<HTMLInputElement>(null);

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
    const fetchSviRacuni = async () => {
      try {
        const res = await fetch(`${API_URL}/api/pregledi/racuna`, {
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          setSviRacuni(d.data ?? []);
        }
      } finally {
        setLoadingRacuni(false);
      }
    };
    void fetchSviRacuni();
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (terenRef.current && !terenRef.current.contains(e.target as Node))
        setPokazuiDropdownTeren(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Promjena terena resetuje listu na automatski nađene račune za taj teren
  // (bez storniranih) — svaki ručno dodat račun iz prethodnog terena se briše,
  // da ne bi ostao "zalutali" račun iz drugog terena u izvještaju.
  const izaberiTeren = (teren: Teren) => {
    setOdabraniTeren(teren);
    setSesijaAktivna(true);
    setPokazuiDropdownTeren(false);
    setGreskaSkeniranje(null);
    setUnosBarkoda("");
    const auto: IzvjestajStavka[] = sviRacuni
      .filter(
        (r) =>
          Number(r.sifra_terena) === teren.sifra_terena_dostava &&
          !jeStorniran(r.storniran_racun),
      )
      .map((r) => ({
        sifra_tabele: Number(r.sifra_tabele),
        broj_racuna_prikaz: String(r.vrsta_racuna_novo ?? r.broj_racuna ?? ""),
        naziv_partnera: String(r.naziv_partnera ?? ""),
        ukupno: Number(r.ukupno) || 0,
        napomena: napomenaVrijednost(r.napomena),
        radnik: String(r.naziv_radnika ?? r.sifra_radnika ?? ""),
        jeMp: jeMpVrsta(r.vrsta_racuna_novi),
        jeRazniKupac: jeRazniKupacVrijednost(r.sifra_partnera),
        rucnoDodano: false,
      }));
    setStavke(auto);
    setTimeout(() => inputBarkodaRef.current?.focus(), 0);
  };

  // "Bez terena" — dozvoljava rad bez izabranog terena: lista kreće prazna i
  // popunjava se isključivo skeniranjem barkoda (nema automatske liste jer
  // nema terena po kome bi se računi filtrirali).
  const izaberiBezTerena = () => {
    setOdabraniTeren(null);
    setSesijaAktivna(true);
    setPokazuiDropdownTeren(false);
    setGreskaSkeniranje(null);
    setUnosBarkoda("");
    setStavke([]);
    setTimeout(() => inputBarkodaRef.current?.focus(), 0);
  };

  const handleSkeniraj = () => {
    const vrijednost = unosBarkoda.trim();
    setUnosBarkoda("");
    if (!vrijednost || !sesijaAktivna) return;

    const pronadjen = sviRacuni.find(
      (r) => String(r.sifra_tabele) === vrijednost,
    );
    const oznaka = (r: RacunRed) =>
      String(r.vrsta_racuna_novo ?? r.broj_racuna ?? vrijednost);

    if (!pronadjen) {
      pustiZvuk(ZVUK_NIJE_PRONADJEN);
      setGreskaSkeniranje(`Račun sa šifrom "${vrijednost}" nije pronađen.`);
      return;
    }
    pustiZvuk(ZVUK_PRONADJEN);
    if (jeStorniran(pronadjen.storniran_racun)) {
      setGreskaSkeniranje(
        `Račun ${oznaka(pronadjen)} je storniran — ne može se dodati.`,
      );
      return;
    }
    if (stavke.some((s) => s.sifra_tabele === Number(pronadjen.sifra_tabele))) {
      setGreskaSkeniranje(`Račun ${oznaka(pronadjen)} je već u listi.`);
      return;
    }
    setStavke((prev) => [
      ...prev,
      {
        sifra_tabele: Number(pronadjen.sifra_tabele),
        broj_racuna_prikaz: oznaka(pronadjen),
        naziv_partnera: String(pronadjen.naziv_partnera ?? ""),
        ukupno: Number(pronadjen.ukupno) || 0,
        napomena: napomenaVrijednost(pronadjen.napomena),
        radnik: String(pronadjen.naziv_radnika ?? pronadjen.sifra_radnika ?? ""),
        jeMp: jeMpVrsta(pronadjen.vrsta_racuna_novi),
        jeRazniKupac: jeRazniKupacVrijednost(pronadjen.sifra_partnera),
        rucnoDodano: true,
      },
    ]);
    setGreskaSkeniranje(null);
  };

  const ukloniStavku = (sifraTabele: number) => {
    setStavke((prev) => prev.filter((s) => s.sifra_tabele !== sifraTabele));
  };

  const terenLabel = odabraniTeren
    ? `${odabraniTeren.naziv_dana}${
        formatDatumDMY(odabraniTeren.datum_dostave)
          ? ` (${formatDatumDMY(odabraniTeren.datum_dostave)})`
          : ""
      }`
    : sesijaAktivna
      ? "Bez terena"
      : "";

  const ukupnoSvi = stavke.reduce((s, r) => s + r.ukupno, 0);
  const brojMp = stavke.filter((s) => s.jeMp).length;
  const brojVp = stavke.length - brojMp;

  const handleStampaj = () => {
    if (!sesijaAktivna || stavke.length === 0) return;
    openPrint({
      title: `Izvještaj teren — ${terenLabel}`,
      format: "A4",
      component: (
        <IzvjestajTerenA4
          terenLabel={terenLabel}
          redovi={stavke.map((s) => ({
            sifra_tabele: s.sifra_tabele,
            broj_racuna_prikaz: s.broj_racuna_prikaz,
            naziv_partnera: s.naziv_partnera,
            ukupno: s.ukupno,
            napomena: s.napomena,
            radnik: s.radnik,
            jeMp: s.jeMp,
          }))}
        />
      ),
    });
  };

  const spremno = !loadingTereni && !loadingRacuni;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <MapPin size={20} style={{ color: PRIMARY }} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Izvještaj teren
          </h2>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          {/* Teren */}
          <div ref={terenRef} className="relative" style={{ minWidth: 220 }}>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Teren
            </span>
            <button
              onClick={() => setPokazuiDropdownTeren((v) => !v)}
              disabled={!spremno}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left disabled:opacity-60 transition-all ${
                odabraniTeren
                  ? "border-transparent"
                  : "border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d]"
              }`}
              style={odabraniTeren ? { background: PRIMARY } : undefined}
            >
              <span
                className={`text-sm font-semibold truncate ${odabraniTeren ? "text-white" : "text-gray-700 dark:text-[#ede9f6]"}`}
              >
                {!spremno ? (
                  "Učitavanje..."
                ) : odabraniTeren ? (
                  terenLabel
                ) : (
                  "Izaberite teren"
                )}
              </span>
              <ChevronDown
                size={14}
                className={odabraniTeren ? "text-white/80" : "text-gray-400"}
              />
            </button>

            {pokaziDropdownTeren && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#261f38] border border-gray-200 dark:border-[#3a3158] rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                {tereni.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs text-gray-400 dark:text-[#5f5878]">
                    Nema aktivnih terena
                  </div>
                ) : (
                  tereni.map((t) => (
                    <button
                      key={t.sifra_terena_dostava}
                      onClick={() => izaberiTeren(t)}
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
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bez terena — dozvoljava rad i bez izabranog terena, samo preko skeniranja */}
          <button
            onClick={izaberiBezTerena}
            disabled={!spremno}
            title="Kreni bez terena — dodaj račune isključivo skeniranjem barkoda"
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              sesijaAktivna && !odabraniTeren
                ? "text-white"
                : "border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648]"
            }`}
            style={
              sesijaAktivna && !odabraniTeren ? { background: PRIMARY } : undefined
            }
          >
            <MapPinOff size={14} />
            Bez terena
          </button>

          {/* Skeniraj barkod */}
          <div className="flex-1" style={{ minWidth: 180 }}>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878] mb-1">
              Dodaj račun (skeniraj barkod)
            </span>
            <div className="relative">
              <ScanBarcode
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
              />
              <input
                ref={inputBarkodaRef}
                type="text"
                value={unosBarkoda}
                onChange={(e) => setUnosBarkoda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSkeniraj();
                }}
                disabled={!sesijaAktivna}
                placeholder={
                  sesijaAktivna
                    ? "Skenirajte ili unesite šifru tabele..."
                    : "Prvo izaberite teren ili kliknite Bez terena"
                }
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-300 dark:placeholder:text-[#5f5878] focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 disabled:opacity-60 transition-all"
              />
            </div>
          </div>

          {sesijaAktivna && (
            <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d]">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                Broj računa
              </span>
              <span
                className="text-sm font-bold leading-tight"
                style={{ color: PRIMARY }}
              >
                {stavke.length}
              </span>
            </div>
          )}

          {sesijaAktivna && (
            <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d]">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                MP
              </span>
              <span
                className="text-sm font-bold leading-tight"
                style={{ color: PRIMARY }}
              >
                {brojMp}
              </span>
            </div>
          )}

          {sesijaAktivna && (
            <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-[#f4f1f9] dark:bg-[#1e1a2d]">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#5f5878]">
                VP
              </span>
              <span
                className="text-sm font-bold leading-tight"
                style={{ color: ACCENT }}
              >
                {brojVp}
              </span>
            </div>
          )}

          <button
            onClick={() => {
              if (odabraniTeren) izaberiTeren(odabraniTeren);
              else if (sesijaAktivna) izaberiBezTerena();
            }}
            disabled={!sesijaAktivna}
            title="Poništi ručno dodate račune i vrati automatsku listu za ovaj teren (ili praznu listu ako je bez terena)"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: PRIMARY }}
          >
            <RotateCcw size={14} />
            Poništi
          </button>

          <button
            onClick={handleStampaj}
            disabled={!sesijaAktivna || stavke.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: ACCENT }}
          >
            <Printer size={15} />
            Štampaj
          </button>
        </div>

        {greskaSkeniranje && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {greskaSkeniranje}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2d2648] overflow-hidden">
        {!spremno ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin" style={{ color: PRIMARY }} />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">
              Učitavanje...
            </span>
          </div>
        ) : !sesijaAktivna ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400 dark:text-[#5f5878]">
              Izaberite teren (ili kliknite Bez terena) da biste počeli
            </span>
          </div>
        ) : stavke.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400 dark:text-[#5f5878]">
              {odabraniTeren
                ? "Nema računa za ovaj teren — dodajte skeniranjem barkoda"
                : "Dodajte račune skeniranjem barkoda"}
            </span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f4f1f9] dark:bg-[#1e1a2d] border-b border-gray-100 dark:border-[#2d2648]">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#7d7498]">
                    Broj računa
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#7d7498]">
                    Naziv partnera
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#7d7498]">
                    Napomena
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[#7d7498]">
                    Ukupno
                  </th>
                  <th className="px-4 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {stavke.map((s, i) => (
                  <tr
                    key={s.sifra_tabele}
                    className={`border-b border-gray-100 dark:border-[#2a2340] ${
                      s.jeRazniKupac
                        ? "bg-amber-50/60 dark:bg-amber-950/10"
                        : i % 2 === 0
                          ? "bg-white dark:bg-[#1a1528]"
                          : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                    }`}
                    style={{ borderLeft: `4px solid ${s.jeMp ? PRIMARY : ACCENT}` }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap font-semibold text-gray-700 dark:text-[#c5bfd8]">
                      <div className="flex items-center gap-1.5">
                        {s.broj_racuna_prikaz}
                        {s.rucnoDodano && (
                          <span
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                            style={{ background: ACCENT }}
                            title="Ručno dodat skeniranjem"
                          >
                            <ScanBarcode size={9} />
                            Ručno
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-[#c5bfd8]">
                      <div className="flex items-center gap-1.5">
                        {s.naziv_partnera}
                        {s.jeRazniKupac && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-amber-500"
                            title="Razni kupac (generički partner 300)"
                          >
                            Razni
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-[#a89fc2] italic">
                      {s.napomena ?? "—"}
                    </td>
                    <td
                      className="px-4 py-2 whitespace-nowrap text-right font-bold"
                      style={{ color: PRIMARY }}
                    >
                      {s.ukupno.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center">
                      <button
                        onClick={() => ukloniStavku(s.sifra_tabele)}
                        title="Ukloni iz izvještaja"
                        className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-end px-4 py-3 border-t-2 border-gray-100 dark:border-[#2d2648] bg-[#f4f1f9] dark:bg-[#1e1a2d]">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-[#7d7498] uppercase tracking-wide">
                Ukupno
                <span className="text-lg font-bold" style={{ color: PRIMARY }}>
                  {ukupnoSvi.toFixed(2)} KM
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
