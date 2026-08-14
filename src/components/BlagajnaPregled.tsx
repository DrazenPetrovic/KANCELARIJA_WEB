import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Receipt,
  RefreshCcw,
  Search,
  Wallet,
} from "lucide-react";

// Tolerancija za poređenje novčanih iznosa (zaokruživanje na 2 decimale).
const TOLERANCIJA_SALDA = 0.01;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red iz erp.blagajna_pregled.
interface BlagajnaRed {
  sifra: number;
  datum_otvaranja: string | null;
  datum_zatvaranja: string | null;
  pocetno_stanje: number | string | null;
  krajnje_stanje: number | string | null;
  nalog_zatvoren: number | string | null;
}

// Red iz erp.blagajna_uplate_pregled — sifra_blagajne se poklapa sa
// sifra iz blagajna_pregled.
interface UplataRed {
  sifra_uplate: number;
  vrsta_uplate: string | number | null;
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
  datum_uplate: string | null;
  vreme_uplate: string | null;
  uplaceno: number | string | null;
  opis: string | null;
  napomena: string | null;
  sifra_radnika: number | string | null;
  Naziv_radnika: string | null;
  gotovinska_uplata: number | string | null;
  sifra_blagajne: number | string;
}

// Red iz erp.blagajna_isplate_pregled — broj_naloga se poklapa sa
// sifra iz blagajna_pregled. Isplate dobavljačima (računi) sa PDV podacima.
interface IsplataRed {
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

// 1000 -> "1 000.00", 1000000 -> "1 000 000.00" — razmak kao separator hiljada.
function formatBroj(n: number) {
  const [cijeliDio, decimalniDio] = n.toFixed(2).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const saSeparatorom = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negativan ? "-" : ""}${saSeparatorom}.${decimalniDio}`;
}

// Šifarnik vrsta_uplate — "uplata" = novac ulazi (zeleno), "isplata" = novac
// izlazi (crveno).
const VRSTA_UPLATE: Record<number, { naziv: string; tip: "uplata" | "isplata" }> = {
  0: { naziv: "Dugovanja kupcu", tip: "isplata" },
  1: { naziv: "Uplate kupaca", tip: "uplata" },
  2: { naziv: "Uplata dobavljačima (kalk)", tip: "isplata" },
  3: { naziv: "Uplata (KUF)", tip: "isplata" },
  4: { naziv: "Dugovanja (dobavljaču)", tip: "isplata" },
  5: { naziv: "Davanje pozajmice", tip: "isplata" },
  6: { naziv: "Vraćanje date pozajmice", tip: "uplata" },
  7: { naziv: "Primanje pozajmice", tip: "uplata" },
  8: { naziv: "Vraćanje primljene pozajmice", tip: "isplata" },
  9: { naziv: "Povrat pretplate dobavljaču", tip: "isplata" },
  10: { naziv: "Prijem pretplate (povrat od kupca)", tip: "uplata" },
  11: { naziv: "Prijem pretplate dobavljača", tip: "uplata" },
  12: { naziv: "Povrat pretplate kupcu", tip: "isplata" },
};

function vrstaUplateInfo(v: string | number | null | undefined) {
  const kod = Number(v);
  return (
    VRSTA_UPLATE[kod] ?? {
      naziv: v === null || v === undefined || v === "" ? "–" : String(v),
      tip: "uplata" as const,
    }
  );
}

function formatKM(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return "–";
  return `${formatBroj(n)} KM`;
}

// Iz opisa uplate (npr. "MP - 10-4157-G") izvlači broj računa iza "MP -".
function izvuciBrojRacunaIzOpisa(opis: string | null | undefined): string {
  if (!opis) return "–";
  const match = opis.trim().match(/^MP\s*-\s*(.+)$/i);
  return match ? match[1].trim() : "–";
}

// Boje za PDV kolonu (iskazani/ulazni):
// - oba 0 -> siva (trenutno stanje)
// - ulazni 0, iskazani nije -> primarna boja samo za iskazani
// - isti (nenulti) -> crvena za oba
// - ulazni veći od iskazanog -> narandžasta za oba
// - inače (iskazani veći od ulaznog) -> siva
function pdvBoje(iskazani: number, ulazni: number) {
  const SIVA = "#9ca3af";
  const CRVENA = "#ef4444";
  const NARANDZASTA = "#f59e0b";
  if (iskazani === 0 && ulazni === 0) return { iskazani: SIVA, ulazni: SIVA };
  if (ulazni === 0) return { iskazani: PRIMARY, ulazni: SIVA };
  if (iskazani === ulazni) return { iskazani: CRVENA, ulazni: CRVENA };
  if (ulazni > iskazani)
    return { iskazani: NARANDZASTA, ulazni: NARANDZASTA };
  return { iskazani: SIVA, ulazni: SIVA };
}

function formatDatum(v: string | null | undefined) {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
}

// datum_otvaranja / datum_zatvaranja — datum i vrijeme otvaranja/zatvaranja naloga blagajne.
function formatDatumVrijeme(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}:${ss}`;
}

function BlagajnaStatusBadge({ v }: { v: number | string | null }) {
  const zatvoren = Number(v) === 1;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={
        zatvoren
          ? { background: "#9ca3af26", color: "#6b7280" }
          : { background: `${ACCENT}26`, color: ACCENT }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: zatvoren ? "#6b7280" : ACCENT }}
      />
      {zatvoren ? "Zatvoren" : "Otvoren"}
    </span>
  );
}

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string | number;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-4 py-3 flex-1 min-w-[150px]">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-gray-800 dark:text-[#ede9f6]">
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 dark:text-[#5f5878] truncate">
          {naziv}
        </div>
      </div>
    </div>
  );
}

export function BlagajnaPregled() {
  const [blagajne, setBlagajne] = useState<BlagajnaRed[]>([]);
  const [uplate, setUplate] = useState<UplataRed[]>([]);
  const [isplate, setIsplate] = useState<IsplataRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const [pretraga, setPretraga] = useState("");
  const [prosireno, setProsireno] = useState<Set<number>>(new Set());

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/blagajna/pregled-sa-uplatama`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju blagajne");
        return res.json();
      })
      .then((json) => {
        setBlagajne(json.blagajne ?? []);
        setUplate(json.uplate ?? []);
        setIsplate(json.isplate ?? []);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  // Uplate grupisane po sifra_blagajne — poklapa se sa sifra iz blagajni.
  const uplatePoBlagajni = useMemo(() => {
    const map = new Map<string, UplataRed[]>();
    uplate.forEach((u) => {
      const kljuc = String(u.sifra_blagajne);
      const niz = map.get(kljuc) ?? [];
      niz.push(u);
      map.set(kljuc, niz);
    });
    return map;
  }, [uplate]);

  // Isplate dobavljačima grupisane po broj_naloga — poklapa se sa sifra iz blagajni.
  const isplatePoBlagajni = useMemo(() => {
    const map = new Map<string, IsplataRed[]>();
    isplate.forEach((i) => {
      const kljuc = String(i.broj_naloga);
      const niz = map.get(kljuc) ?? [];
      niz.push(i);
      map.set(kljuc, niz);
    });
    return map;
  }, [isplate]);

  const filtrirane = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return blagajne;
    return blagajne.filter((b) => String(b.sifra).includes(q));
  }, [blagajne, pretraga]);

  const sortirane = useMemo(
    () => [...filtrirane].sort((a, b) => b.sifra - a.sifra),
    [filtrirane],
  );

  const brojOtvorenih = useMemo(
    () => blagajne.filter((b) => Number(b.nalog_zatvoren) !== 1).length,
    [blagajne],
  );
  const sumaUplata = useMemo(
    () =>
      uplate.reduce((acc, u) => {
        const vrsta = vrstaUplateInfo(u.vrsta_uplate);
        return vrsta.tip === "uplata" ? acc + (Number(u.uplaceno) || 0) : acc;
      }, 0),
    [uplate],
  );
  // Isplate = isplate iz uplata (vrsta_uplate) + isplate dobavljačima (računi).
  const sumaIsplata = useMemo(() => {
    const izUplata = uplate.reduce((acc, u) => {
      const vrsta = vrstaUplateInfo(u.vrsta_uplate);
      return vrsta.tip === "isplata" ? acc + (Number(u.uplaceno) || 0) : acc;
    }, 0);
    const izIsplataDobavljacima = isplate.reduce(
      (acc, i) => acc + (Number(i.ukupno) || 0),
      0,
    );
    return izUplata + izIsplataDobavljacima;
  }, [uplate, isplate]);

  // Kontinuitet salda — krajnje stanje prethodnog (hronološki) naloga mora
  // biti početno stanje sljedećeg. Računa se nad SVIM nalozima (ne dira ih
  // tekstualna pretraga), da poredak ostane ispravan bez obzira na upit.
  const neusaglasenKontinuitet = useMemo(() => {
    const skup = new Set<number>();
    const hronoloski = [...blagajne].sort((a, b) => a.sifra - b.sifra);
    for (let i = 1; i < hronoloski.length; i++) {
      const prethodnoKrajnje = Number(hronoloski[i - 1].krajnje_stanje) || 0;
      const trenutnoPocetno = Number(hronoloski[i].pocetno_stanje) || 0;
      if (Math.abs(prethodnoKrajnje - trenutnoPocetno) > TOLERANCIJA_SALDA) {
        skup.add(hronoloski[i].sifra);
      }
    }
    return skup;
  }, [blagajne]);

  const prekidacProsirenja = (sifra: number) => {
    setProsireno((prev) => {
      const novi = new Set(prev);
      if (novi.has(sifra)) novi.delete(sifra);
      else novi.add(sifra);
      return novi;
    });
  };

  const prosiriSve = () =>
    setProsireno(new Set(sortirane.map((b) => b.sifra)));
  const skupiSve = () => setProsireno(new Set());
  const sveProsireno =
    sortirane.length > 0 && prosireno.size >= sortirane.length;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Banknote size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Pregled blagajne
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Nalozi blagajne i uplate po nalogu
          </p>
        </div>
        <button
          type="button"
          onClick={ucitaj}
          disabled={loading}
          title="Osvježi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {/* Statistika */}
      {!loading && !greska && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<Receipt size={16} />}
            vrijednost={blagajne.length}
            naziv="Naloga ukupno"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Banknote size={16} />}
            vrijednost={brojOtvorenih}
            naziv="Otvorenih naloga"
            boja={brojOtvorenih > 0 ? "#f59e0b" : "#9ca3af"}
          />
          <StatTile
            icon={<Wallet size={16} />}
            vrijednost={formatKM(sumaUplata)}
            naziv="Ukupno uplata"
            boja={ACCENT}
          />
          <StatTile
            icon={<Wallet size={16} />}
            vrijednost={formatKM(sumaIsplata)}
            naziv="Ukupno isplata"
            boja="#ef4444"
          />
        </div>
      )}

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraga po šifri blagajne..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <button
            type="button"
            onClick={sveProsireno ? skupiSve : prosiriSve}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
          >
            {sveProsireno ? (
              <ChevronsDownUp size={14} />
            ) : (
              <ChevronsUpDown size={14} />
            )}
            {sveProsireno ? "Skupi sve" : "Proširi sve"}
          </button>
        </div>

        {!loading && !greska && (
          <p className="mt-3 text-xs text-gray-400 dark:text-[#5f5878]">
            Prikazano {sortirane.length} / {blagajne.length} naloga
          </p>
        )}
      </div>

      {/* Lista naloga blagajne */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: PRIMARY }}
            />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">
              Učitavanje...
            </span>
          </div>
        )}

        {greska && (
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
            <button
              type="button"
              onClick={ucitaj}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
            >
              Pokušaj ponovo
            </button>
          </div>
        )}

        {!loading && !greska && sortirane.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300 dark:text-[#3a3158]">
            <Banknote size={28} />
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              {pretraga.trim()
                ? "Nema rezultata za tu pretragu."
                : "Nema naloga blagajne za prikaz."}
            </p>
          </div>
        )}

        {!loading &&
          !greska &&
          sortirane.map((blagajna, i) => {
            const otvoreno = prosireno.has(blagajna.sifra);
            const uplateBlagajne =
              uplatePoBlagajni.get(String(blagajna.sifra)) ?? [];
            const isplateBlagajne =
              isplatePoBlagajni.get(String(blagajna.sifra)) ?? [];

            const ukupnoUplata = uplateBlagajne.reduce((acc, u) => {
              const vrsta = vrstaUplateInfo(u.vrsta_uplate);
              return vrsta.tip === "uplata"
                ? acc + (Number(u.uplaceno) || 0)
                : acc;
            }, 0);
            const ukupnoIsplataIzUplata = uplateBlagajne.reduce((acc, u) => {
              const vrsta = vrstaUplateInfo(u.vrsta_uplate);
              return vrsta.tip === "isplata"
                ? acc + (Number(u.uplaceno) || 0)
                : acc;
            }, 0);
            const ukupnoIsplataDobavljacima = isplateBlagajne.reduce(
              (acc, isp) => acc + (Number(isp.ukupno) || 0),
              0,
            );
            const ukupnoIsplata =
              ukupnoIsplataIzUplata + ukupnoIsplataDobavljacima;

            // (početno + uplate) - isplate (uplate + dobavljači) mora dati krajnje stanje.
            const izracunatoKrajnje =
              (Number(blagajna.pocetno_stanje) || 0) +
              ukupnoUplata -
              ukupnoIsplata;
            // Objedinjena lista transakcija (uplate + isplate dobavljačima),
            // sortirana hronološki unazad.
            const transakcije = [
              ...uplateBlagajne.map((u) => ({
                key: `u-${u.sifra_uplate}`,
                partner: u.naziv_partnera ?? `Partner #${u.sifra_partnera}`,
                datum: u.datum_uplate,
                brojRacuna: izvuciBrojRacunaIzOpisa(u.opis),
                uplata: Number(u.uplaceno) || 0,
                isplata: null as number | null,
                pdv: null as {
                  iskazani: number | string | null;
                  ulazni: number | string | null;
                } | null,
                napomena: u.napomena ?? "–",
                vrsta: "UPLATE" as const,
              })),
              ...isplateBlagajne.map((isp) => ({
                key: `i-${isp.sifra}`,
                partner:
                  isp.naziv_dobavljaca ?? `Dobavljač #${isp.sifra_dobavljaca}`,
                datum: isp.datum_racuna,
                brojRacuna: isp.broj_racuna ?? "–",
                uplata: null as number | null,
                isplata: Number(isp.ukupno) || 0,
                pdv: { iskazani: isp.iskazani_pdv, ulazni: isp.ulazni_pdv },
                napomena: isp.opis ?? "–",
                vrsta: "ISPLATE" as const,
              })),
            ].sort((a, b) => {
              const da = a.datum ? new Date(a.datum).getTime() : 0;
              const db = b.datum ? new Date(b.datum).getTime() : 0;
              return db - da;
            });

            const neslaganjeSalda =
              Math.abs(
                izracunatoKrajnje - (Number(blagajna.krajnje_stanje) || 0),
              ) > TOLERANCIJA_SALDA;
            const neslaganjeKontinuiteta = neusaglasenKontinuitet.has(
              blagajna.sifra,
            );

            return (
              <div
                key={blagajna.sifra}
                className={`border-b last:border-b-0 ${
                  otvoreno
                    ? "border-l-4 border-gray-100 dark:border-[#2d2648]"
                    : `border-gray-100 dark:border-[#2d2648] ${i % 2 === 1 ? "bg-[#faf9fc] dark:bg-[#221c34]" : ""}`
                }`}
                style={otvoreno ? { borderLeftColor: PRIMARY } : undefined}
              >
                <button
                  type="button"
                  onClick={() => prekidacProsirenja(blagajna.sifra)}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    otvoreno
                      ? "bg-[#e3d9f7] dark:bg-[#3d3163] hover:bg-[#dbcdf3] dark:hover:bg-[#463a70]"
                      : "hover:bg-purple-50/60 dark:hover:bg-[#271f40]/60"
                  }`}
                >
                  <ChevronRight
                    size={14}
                    className="transition-transform duration-200 flex-shrink-0"
                    style={{
                      color: PRIMARY,
                      transform: otvoreno ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                    <Banknote size={14} style={{ color: PRIMARY }} />
                  </div>
                  <div className="min-w-0 w-48 flex-shrink-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      Blagajna #{blagajna.sifra}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-[#5f5878]">
                      {formatDatum(blagajna.datum_otvaranja)}
                    </div>
                  </div>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 pointer-events-none whitespace-nowrap">
                    <div className="flex flex-col items-center">
                      <div className="text-base font-bold text-gray-800 dark:text-[#ede9f6]">
                        Blagajna #{blagajna.sifra}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                        {formatDatum(blagajna.datum_otvaranja)}
                      </div>
                    </div>
                    <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
                      <span
                        title={
                          neslaganjeSalda
                            ? "Početno + uplate - isplate ne odgovara krajnjem stanju"
                            : "Saldo se slaže: početno + uplate - isplate = krajnje stanje"
                        }
                      >
                        {neslaganjeSalda ? (
                          <AlertTriangle size={16} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={16} style={{ color: ACCENT }} />
                        )}
                      </span>
                      <span
                        title={
                          neslaganjeKontinuiteta
                            ? "Početno stanje se ne poklapa sa krajnjim stanjem prethodne blagajne"
                            : "Kontinuitet salda sa prethodnom blagajnom je ispravan"
                        }
                      >
                        {neslaganjeKontinuiteta ? (
                          <AlertTriangle size={16} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={16} style={{ color: ACCENT }} />
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 dark:text-[#9e96b8] flex-shrink-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-[#5f5878] w-14">
                          Krajnje
                        </span>
                        <span className="font-semibold" style={{ color: PRIMARY }}>
                          {formatKM(blagajna.krajnje_stanje)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-[#5f5878] w-14">
                          Početno
                        </span>
                        <span className="font-semibold text-red-500">
                          {formatKM(blagajna.pocetno_stanje)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-[#5f5878] w-12">
                          Uplata
                        </span>
                        <span className="font-semibold" style={{ color: ACCENT }}>
                          {formatKM(ukupnoUplata)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-[#5f5878] w-12">
                          Isplata
                        </span>
                        <span className="font-semibold text-red-500">
                          {formatKM(ukupnoIsplata)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <div className="hidden lg:flex flex-col items-end leading-tight text-[10px]">
                      <span className="text-green-600 dark:text-green-400">
                        Otvoren: {formatDatumVrijeme(blagajna.datum_otvaranja)}
                      </span>
                      <span className="text-red-500 dark:text-red-400">
                        Zatvoren: {formatDatumVrijeme(blagajna.datum_zatvaranja)}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${ACCENT}1f`, color: ACCENT }}
                    >
                      {uplateBlagajne.length} uplata
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500">
                      {isplateBlagajne.length} isplata
                    </span>
                    <BlagajnaStatusBadge v={blagajna.nalog_zatvoren} />
                  </div>
                </button>

                {otvoreno && (
                  <div className="px-4 pb-3">
                    {transakcije.length === 0 ? (
                      <div className="flex items-center justify-center gap-1.5 py-6 text-gray-400 dark:text-[#5f5878]">
                        <Wallet size={16} className="text-gray-300 dark:text-[#3a3158]" />
                        <span className="text-xs">Nema transakcija za ovaj nalog</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-[#2d2648]">
                        <table className="w-full">
                          <thead>
                            <tr style={{ background: `${PRIMARY}1f` }}>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Partner
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Datum
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Broj računa
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: ACCENT }}>
                                Uplate
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-red-500">
                                Isplate
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                PDV
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Napomena
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: PRIMARY }}>
                                Vrsta
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {transakcije.map((t, idx) => {
                              const boja = t.vrsta === "ISPLATE" ? "#ef4444" : ACCENT;
                              return (
                                <tr
                                  key={t.key}
                                  className={`transition-colors hover:bg-purple-50/60 dark:hover:bg-[#271f40]/50 ${
                                    idx % 2 === 1
                                      ? "bg-[#f4f1f9]/60 dark:bg-[#241d3a]/40"
                                      : ""
                                  }`}
                                >
                                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                    {t.partner}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                                    {formatDatum(t.datum)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#a99fc2] border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                                    {t.brojRacuna}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right font-semibold border-t border-gray-50 dark:border-[#2d2648]" style={{ color: ACCENT }}>
                                    {t.uplata !== null ? formatKM(t.uplata) : ""}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right font-semibold text-red-500 border-t border-gray-50 dark:border-[#2d2648]">
                                    {t.isplata !== null ? formatKM(t.isplata) : ""}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-right border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap">
                                    {t.pdv ? (
                                      (() => {
                                        const iskazani = Number(t.pdv.iskazani) || 0;
                                        const ulazni = Number(t.pdv.ulazni) || 0;
                                        const boje = pdvBoje(iskazani, ulazni);
                                        // Ulazni veći od iskazanog = greška — istakni većim fontom.
                                        const greska = ulazni > iskazani;
                                        const velicina = greska
                                          ? "text-sm font-semibold"
                                          : "text-xs";
                                        return (
                                          <>
                                            <div
                                              className={velicina}
                                              style={{ color: boje.iskazani }}
                                            >
                                              Iskazani: {formatKM(iskazani)}
                                            </div>
                                            <div
                                              className={velicina}
                                              style={{ color: boje.ulazni }}
                                            >
                                              Ulazni: {formatKM(ulazni)}
                                            </div>
                                          </>
                                        );
                                      })()
                                    ) : (
                                      ""
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-600 dark:text-[#c5bfd8] border-t border-gray-50 dark:border-[#2d2648]">
                                    {t.napomena}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right font-medium border-t border-gray-50 dark:border-[#2d2648] whitespace-nowrap" style={{ color: boja }}>
                                    {t.vrsta}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
