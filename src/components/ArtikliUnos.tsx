import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  PackagePlus,
  Search,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface ArtikalGrupaOpcija {
  sifra_grupe: string | number;
  naziv_grupe: string;
  [key: string]: unknown;
}

// Jedinica mjere — sifra ide u JSON (polje "jm"), naziv_jm je tekst za operatera.
interface JedinicaMjereOpcija {
  sifra: string | number;
  naziv_jm: string;
  [key: string]: unknown;
}

// Za provjeru duplikata prilikom unosa — isti podaci koje vraća
// erp.sp_artikli_pregled() (pregled artikala, /api/artikli).
interface PostojeciArtikal {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  [key: string]: unknown;
}

// Vrsta "Nije definisano" (-1) je samo placeholder — forsira operatera da
// eksplicitno izabere pravu vrstu, forma se ne može sačuvati dok je izabrana.
// Vrsta "Sirovina" (0) automatski postavlja sirovina_da, bez posebnog checkboxa.
const VRSTA_NIJE_DEFINISANO = "-1";
const VRSTA_SIROVINA = "0";
const VRSTA_OPCIJE = [
  { value: VRSTA_NIJE_DEFINISANO, label: "Nije definisano" },
  { value: VRSTA_SIROVINA, label: "Sirovina" },
  { value: "1", label: "Proizvodi" },
  { value: "2", label: "Roba" },
  { value: "3", label: "Usluga" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

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

export function ArtikliUnos() {
  const [nazivProizvoda, setNazivProizvoda] = useState("");
  const [jm, setJm] = useState("");
  const [barkod, setBarkod] = useState("");
  const [grupaProizvoda, setGrupaProizvoda] = useState("0");
  const [vrsta, setVrsta] = useState(VRSTA_NIJE_DEFINISANO);
  const [marza, setMarza] = useState("");
  const [marzaZaKalkulaciju, setMarzaZaKalkulaciju] = useState("");
  const [minimalnaProdajna, setMinimalnaProdajna] = useState("");
  const [ogranicenaMarza, setOgranicenaMarza] = useState(false);
  const [koristitiZaPonudu, setKoristitiZaPonudu] = useState(true);

  const [grupe, setGrupe] = useState<ArtikalGrupaOpcija[]>([]);
  const [ucitavanjeGrupa, setUcitavanjeGrupa] = useState(true);

  const [jediniceMjere, setJediniceMjere] = useState<JedinicaMjereOpcija[]>(
    [],
  );
  const [ucitavanjeJm, setUcitavanjeJm] = useState(true);

  // Postojeći artikli — povučeni istom procedurom kao pregled artikala
  // (erp.sp_artikli_pregled), da se pri unosu izbjegne dupliranje proizvoda.
  const [postojeciArtikli, setPostojeciArtikli] = useState<PostojeciArtikal[]>(
    [],
  );
  const [ucitavanjeArtikala, setUcitavanjeArtikala] = useState(true);

  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [cuvanje, setCuvanje] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/artikli/grupe-unos`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => setGrupe(json.data ?? []))
      .catch(() => setGrupe([]))
      .finally(() => setUcitavanjeGrupa(false));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/artikli/jedinica-mjere`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        const podaci: JedinicaMjereOpcija[] = json.data ?? [];
        setJediniceMjere(podaci);
        if (podaci.length > 0) setJm(String(podaci[0].sifra));
      })
      .catch(() => setJediniceMjere([]))
      .finally(() => setUcitavanjeJm(false));
  }, []);

  const ucitajPostojeceArtikle = () => {
    setUcitavanjeArtikala(true);
    fetch(`${API_URL}/api/artikli`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => setPostojeciArtikli(json.data ?? []))
      .catch(() => setPostojeciArtikli([]))
      .finally(() => setUcitavanjeArtikala(false));
  };

  useEffect(() => {
    ucitajPostojeceArtikle();
  }, []);

  const nazivDuplikat = useMemo(() => {
    const naziv = nazivProizvoda.trim().toLowerCase();
    if (!naziv) return null;
    return (
      postojeciArtikli.find(
        (a) => a.naziv_proizvoda?.toLowerCase() === naziv,
      ) ?? null
    );
  }, [postojeciArtikli, nazivProizvoda]);

  const filtriraniPostojeci = useMemo(() => {
    const q = nazivProizvoda.trim().toLowerCase();
    if (!q) return [];
    return postojeciArtikli
      .filter(
        (a) =>
          a.naziv_proizvoda?.toLowerCase().includes(q) ||
          String(a.sifra_proizvoda).includes(q),
      )
      .slice(0, 50);
  }, [postojeciArtikli, nazivProizvoda]);

  const resetujFormu = () => {
    setNazivProizvoda("");
    setJm(jediniceMjere.length > 0 ? String(jediniceMjere[0].sifra) : "");
    setBarkod("");
    setGrupaProizvoda("0");
    setVrsta(VRSTA_NIJE_DEFINISANO);
    setMarza("");
    setMarzaZaKalkulaciju("");
    setMinimalnaProdajna("");
    setOgranicenaMarza(false);
    setKoristitiZaPonudu(true);
  };

  const handleSacuvaj = async () => {
    setGreska(null);
    setUspjeh(null);

    if (!nazivProizvoda.trim()) {
      setGreska("Naziv proizvoda je obavezan");
      return;
    }
    if (!Number.isFinite(Number(jm)) || Number(jm) <= 0) {
      setGreska("Jedinica mjere (JM) je obavezna");
      return;
    }
    if (vrsta === VRSTA_NIJE_DEFINISANO) {
      setGreska("Vrsta artikla je obavezna — izaberite jednu od opcija");
      return;
    }
    if (nazivDuplikat) {
      setGreska(
        `Artikal sa nazivom "${nazivProizvoda.trim()}" već postoji (šifra ${nazivDuplikat.sifra_proizvoda})`,
      );
      return;
    }

    const payload = {
      naziv_proizvoda: nazivProizvoda.trim(),
      jm: Number(jm),
      // Količina, nabavna cijena i VPC se ne unose ovim putem — dolaze kasnije
      // kroz nivelaciju/kalkulaciju, ne kroz unos novog artikla.
      kolicina_proizvoda: 0,
      cijena_bez: 0,
      vpc: 0,
      marza: Number(marza) || 0,
      sirovina_da: vrsta === VRSTA_SIROVINA ? 1 : 0,
      ogranicena_marza: ogranicenaMarza ? 1 : 0,
      marza_za_kalkulaciju: Number(marzaZaKalkulaciju) || 0,
      grupa_proizvoda: Number(grupaProizvoda) || 0,
      vrsta: Number(vrsta) || 0,
      minimalna_prodajna: Number(minimalnaProdajna) || 0,
      barkod: barkod.trim(),
      koristiti_za_ponudu: koristitiZaPonudu ? 1 : 0,
    };

    setCuvanje(true);
    try {
      const res = await fetch(`${API_URL}/api/artikli/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu artikla");
      }
      setUspjeh(`Artikal "${nazivProizvoda.trim()}" je sačuvan.`);
      resetujFormu();
      ucitajPostojeceArtikle();
    } catch (err) {
      setGreska(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <PackagePlus size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Unos artikla
        </h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start justify-center">
      <div className="min-w-0 space-y-4">

      {/* Osnovni podaci */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 max-w-5xl space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Package size={15} style={{ color: PRIMARY }} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: PRIMARY }}
          >
            Osnovni podaci
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Naziv proizvoda *" className="col-span-2">
            <input
              type="text"
              value={nazivProizvoda}
              onChange={(e) => setNazivProizvoda(e.target.value)}
              placeholder="EDAMER 45%"
              className={inputClass}
            />
            {nazivDuplikat && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertTriangle size={11} />
                Već postoji šifra {nazivDuplikat.sifra_proizvoda}
              </p>
            )}
          </Field>
          <Field label="JM *">
            <select
              value={jm}
              onChange={(e) => setJm(e.target.value)}
              className={inputClass}
              disabled={ucitavanjeJm}
            >
              {jediniceMjere.length === 0 && <option value="">–</option>}
              {jediniceMjere.map((j) => (
                <option key={j.sifra} value={String(j.sifra)}>
                  {j.naziv_jm}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Barkod">
            <input
              type="text"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
              placeholder="3871234567890"
              className={inputClass}
            />
          </Field>
          <Field label="Grupa proizvoda">
            <select
              value={grupaProizvoda}
              onChange={(e) => setGrupaProizvoda(e.target.value)}
              className={inputClass}
              disabled={ucitavanjeGrupa}
            >
              {grupe.map((g) => (
                <option key={g.sifra_grupe} value={String(g.sifra_grupe)}>
                  {g.naziv_grupe}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vrsta">
            <select
              value={vrsta}
              onChange={(e) => setVrsta(e.target.value)}
              className={inputClass}
            >
              {VRSTA_OPCIJE.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Marža i dodatne postavke */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 max-w-5xl space-y-3">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: PRIMARY }}
        >
          Marža i dodatne postavke
        </span>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Marža (%)">
            <input
              type="number"
              step="0.01"
              value={marza}
              onChange={(e) => setMarza(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Marža za kalkulaciju (%)">
            <input
              type="number"
              step="0.01"
              value={marzaZaKalkulaciju}
              onChange={(e) => setMarzaZaKalkulaciju(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Minimalna prodajna cijena">
            <input
              type="number"
              step="0.01"
              value={minimalnaProdajna}
              onChange={(e) => setMinimalnaProdajna(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ogranicenaMarza}
              onChange={(e) => setOgranicenaMarza(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: PRIMARY }}
            />
            Ograničena marža
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={koristitiZaPonudu}
              onChange={(e) => setKoristitiZaPonudu(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: PRIMARY }}
            />
            Koristiti za ponudu
          </label>
        </div>
      </div>

      <div className="max-w-5xl flex justify-center">
        <button
          onClick={() => void handleSacuvaj()}
          disabled={cuvanje}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: PRIMARY }}
        >
          {cuvanje ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <PackagePlus size={15} />
          )}
          Sačuvaj artikal
        </button>
      </div>

      </div>

      {/* Postojeći artikli — filtrira se dok kucaš naziv/šifru */}
      <div className="w-full xl:w-80 shrink-0 xl:sticky xl:top-4">
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search size={15} style={{ color: PRIMARY }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Postojeći artikli
            </span>
          </div>

          {ucitavanjeArtikala && (
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-[#5f5878]">
              <Loader2 size={13} className="animate-spin" />
              Učitavanje...
            </div>
          )}

          {!ucitavanjeArtikala && !nazivProizvoda.trim() && (
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Počni da kucaš naziv artikla da vidiš da li već postoji.
            </p>
          )}

          {!ucitavanjeArtikala &&
            nazivProizvoda.trim() &&
            filtriraniPostojeci.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Nema artikla sa tim nazivom.
              </p>
            )}

          {!ucitavanjeArtikala && filtriraniPostojeci.length > 0 && (
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
              {filtriraniPostojeci.map((a) => (
                <div
                  key={a.sifra_proizvoda}
                  className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      {a.naziv_proizvoda}
                    </span>
                    <span
                      className="font-mono text-xs shrink-0"
                      style={{ color: PRIMARY }}
                    >
                      {a.sifra_proizvoda}
                    </span>
                  </div>
                  {a.jm && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-[#5f5878]">
                      JM: {a.jm}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>

      {uspjeh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={40} style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {uspjeh}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setUspjeh(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {greska && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-red-300 p-6">
            <div className="flex justify-center mb-3">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <p className="text-base font-semibold text-red-700 dark:text-red-400 text-center">
              {greska}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setGreska(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: PRIMARY }}
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
