import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { formatDatum, formatKM } from "./IzvodiPregled";
import {
  kalkulacijaZaUplatu,
  oznakaKalkulacije,
  oznakaRacuna,
  type KalkulacijaDobavljaca,
  type RacunKupca,
} from "./IzvodiUnosForma";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red iz erp.racuni_neplaceni_pregled (GET /api/racuni/neplaceni).
interface RacunNeplacen extends RacunKupca {
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
}

// Dokument na listi za zatvaranje (klik na red ga dodaje ili skida). Tek dugme
// "Označi kao plaćeno" šalje listu u erp.izvodi_uplate_azuriranje_placenosti.
interface IzabraniDokument {
  tip_dokumenta: "RACUN" | "KALKULACIJA";
  sifra_dokumenta: number;
  naslov: string;
  partner: string | null;
  iznos: number | string | null | undefined;
}

const istiDokument = (
  a: Pick<IzabraniDokument, "tip_dokumenta" | "sifra_dokumenta">,
  b: Pick<IzabraniDokument, "tip_dokumenta" | "sifra_dokumenta">,
) =>
  a.tip_dokumenta === b.tip_dokumenta &&
  a.sifra_dokumenta === b.sifra_dokumenta;

const TH = ({
  children,
  right,
  siroka,
}: {
  children?: React.ReactNode;
  right?: boolean;
  siroka?: boolean;
}) => (
  <th
    className={`sticky top-0 px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"} ${siroka ? "w-full" : ""}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
  siroka,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  siroka?: boolean;
}) => (
  <td
    className={`px-2 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"} ${siroka ? "w-full" : ""}`}
  >
    {children}
  </td>
);

const Partner = ({
  naziv,
  maxSirina = "max-w-[180px]",
}: {
  naziv: string | null;
  maxSirina?: string;
}) => (
  <span className={`block truncate ${maxSirina}`} title={naziv ?? undefined}>
    {naziv ?? "–"}
  </span>
);

const redCls = (izabran: boolean) =>
  `border-b border-gray-200 dark:border-[#3a3158] cursor-pointer transition-colors ${
    izabran
      ? "bg-[#e3d9f7] dark:bg-[#3d3163]"
      : "hover:bg-purple-50 dark:hover:bg-[#2d2648]"
  }`;

const Oznaka = ({ izabran }: { izabran: boolean }) => (
  <td className="pl-2 py-2.5">
    <input
      type="checkbox"
      checked={izabran}
      readOnly
      tabIndex={-1}
      className="block pointer-events-none accent-[#785E9E]"
    />
  </td>
);

function KarticaListe({
  naslov,
  broj,
  loading,
  greska,
  prazno,
  children,
}: {
  naslov: string;
  broj: number;
  loading: boolean;
  greska: string | null;
  prazno: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="w-fit max-w-full min-w-[320px] bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]">
        <span className="flex-1 text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
          {naslov} ({broj})
        </span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400 dark:text-[#5f5878]">
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: PRIMARY }}
          />
          Učitavanje...
        </div>
      ) : greska ? (
        <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-red-500">
          <AlertCircle size={15} className="flex-shrink-0" />
          {greska}
        </div>
      ) : prazno ? (
        <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
          {prazno}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto">{children}</div>
      )}
    </div>
  );
}

const ucitajListu = async <T,>(putanja: string, greska: string) => {
  const res = await fetch(`${API_URL}${putanja}`, { credentials: "include" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.success === false) {
    throw new Error(d.error || d.message || greska);
  }
  return (d.data ?? []) as T[];
};

export function PlacenostRacuna() {
  const [racuni, setRacuni] = useState<RacunNeplacen[]>([]);
  const [kalkulacije, setKalkulacije] = useState<KalkulacijaDobavljaca[]>([]);
  const [racuniGreska, setRacuniGreska] = useState<string | null>(null);
  const [kalkulacijeGreska, setKalkulacijeGreska] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [pretraga, setPretraga] = useState("");

  const [izabrani, setIzabrani] = useState<IzabraniDokument[]>([]);
  const [cuvanje, setCuvanje] = useState(false);
  const [greskaCuvanja, setGreskaCuvanja] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);

  // Liste se učitavaju nezavisno — greška jedne ne skriva drugu.
  const ucitaj = async () => {
    setLoading(true);
    setIzabrani([]);
    setRacuniGreska(null);
    setKalkulacijeGreska(null);
    const [r, k] = await Promise.allSettled([
      ucitajListu<RacunNeplacen>(
        "/api/racuni/neplaceni",
        "Greška pri učitavanju računa",
      ),
      ucitajListu<KalkulacijaDobavljaca>(
        "/api/kalkulacije/glavni",
        "Greška pri učitavanju kalkulacija",
      ),
    ]);
    if (r.status === "fulfilled") {
      setRacuni(r.value);
    } else {
      setRacuni([]);
      setRacuniGreska(
        r.reason instanceof Error
          ? r.reason.message
          : "Greška pri učitavanju računa",
      );
    }
    if (k.status === "fulfilled") {
      setKalkulacije(
        k.value
          .filter(kalkulacijaZaUplatu)
          .sort((a, b) =>
            String(a.datum_kalkulacije ?? "").localeCompare(
              String(b.datum_kalkulacije ?? ""),
            ),
          ),
      );
    } else {
      setKalkulacije([]);
      setKalkulacijeGreska(
        k.reason instanceof Error
          ? k.reason.message
          : "Greška pri učitavanju kalkulacija",
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void ucitaj();
  }, []);

  const q = pretraga.trim().toLowerCase();

  const filtriraniRacuni = useMemo(
    () =>
      !q
        ? racuni
        : racuni.filter(
            (r) =>
              oznakaRacuna(r).toLowerCase().includes(q) ||
              (r.naziv_partnera ?? "").toLowerCase().includes(q),
          ),
    [racuni, q],
  );

  const filtriraneKalkulacije = useMemo(
    () =>
      !q
        ? kalkulacije
        : kalkulacije.filter(
            (k) =>
              oznakaKalkulacije(k).toLowerCase().includes(q) ||
              String(k.broj_racuna ?? "").toLowerCase().includes(q) ||
              (k.naziv_dobavljaca ?? "").toLowerCase().includes(q),
          ),
    [kalkulacije, q],
  );

  const jeIzabran = (
    tip: IzabraniDokument["tip_dokumenta"],
    sifra: number,
  ) =>
    izabrani.some((d) =>
      istiDokument(d, { tip_dokumenta: tip, sifra_dokumenta: sifra }),
    );

  const prekidacIzbora = (d: IzabraniDokument) => {
    setGreskaCuvanja(null);
    setUspjeh(null);
    setIzabrani((prev) =>
      prev.some((x) => istiDokument(x, d))
        ? prev.filter((x) => !istiDokument(x, d))
        : [...prev, d],
    );
  };

  // Sve ili ništa: ako jedan dokument ne prođe, procedura ne mijenja nijedan,
  // pa lista ostaje netaknuta i može se ponoviti.
  const oznaciPlaceno = async () => {
    if (izabrani.length === 0 || cuvanje) return;
    const zaSlanje = izabrani;
    setCuvanje(true);
    setGreskaCuvanja(null);
    setUspjeh(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/azuriranje-placenosti`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dokumenti: zaSlanje.map((d) => ({
            tip_dokumenta: d.tip_dokumenta,
            sifra_dokumenta: d.sifra_dokumenta,
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
      setRacuni((prev) =>
        prev.filter(
          (r) =>
            !zaSlanje.some((x) =>
              istiDokument(x, {
                tip_dokumenta: "RACUN",
                sifra_dokumenta: r.sifra_tabele,
              }),
            ),
        ),
      );
      setKalkulacije((prev) =>
        prev.filter(
          (k) =>
            !zaSlanje.some((x) =>
              istiDokument(x, {
                tip_dokumenta: "KALKULACIJA",
                sifra_dokumenta: k.sifra_kalkulacije,
              }),
            ),
        ),
      );
      setIzabrani([]);
      setUspjeh(
        `Označeno plaćenim — računa: ${d.brojRacuna ?? 0}, kalkulacija: ${d.brojKalkulacija ?? 0}`,
      );
    } catch (e: unknown) {
      setGreskaCuvanja(
        e instanceof Error ? e.message : "Greška pri ažuriranju plaćenosti",
      );
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
          />
          <input
            type="text"
            value={pretraga}
            onChange={(e) => setPretraga(e.target.value)}
            placeholder="Pretraga po partneru ili broju dokumenta..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]"
          />
        </div>
        <button
          type="button"
          onClick={() => void ucitaj()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
        >
          <RotateCcw size={12} className={loading ? "animate-spin" : ""} />
          Osvježi
        </button>
      </div>

      {uspjeh && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400">
          <CheckCircle2 size={13} className="flex-shrink-0" />
          <span className="flex-1">{uspjeh}</span>
          <button type="button" onClick={() => setUspjeh(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-start">
        <KarticaListe
          naslov="Neplaćeni računi"
          broj={filtriraniRacuni.length}
          loading={loading}
          greska={racuniGreska}
          prazno={
            filtriraniRacuni.length > 0
              ? null
              : q
                ? "Nema računa za tu pretragu."
                : "Nema neplaćenih računa."
          }
        >
          <table className="table-auto text-sm">
            <thead>
              <tr>
                <TH />
                <TH>Račun</TH>
                <TH>Kupac</TH>
                <TH>Datum</TH>
                <TH right>Ukupno</TH>
              </tr>
            </thead>
            <tbody>
              {filtriraniRacuni.map((r) => (
                <tr
                  key={r.sifra_tabele}
                  className={redCls(jeIzabran("RACUN", r.sifra_tabele))}
                  onClick={() =>
                    prekidacIzbora({
                      tip_dokumenta: "RACUN",
                      sifra_dokumenta: r.sifra_tabele,
                      naslov: `Račun ${oznakaRacuna(r)}`,
                      partner: r.naziv_partnera,
                      iznos: r.ukupno,
                    })
                  }
                >
                  <Oznaka izabran={jeIzabran("RACUN", r.sifra_tabele)} />
                  <TD bold>{oznakaRacuna(r)}</TD>
                  <TD>
                    <Partner naziv={r.naziv_partnera} />
                  </TD>
                  <TD>{formatDatum(r.datum_racuna)}</TD>
                  <TD right bold>
                    {formatKM(r.ukupno)}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </KarticaListe>

        <KarticaListe
          naslov="Neplaćene kalkulacije"
          broj={filtriraneKalkulacije.length}
          loading={loading}
          greska={kalkulacijeGreska}
          prazno={
            filtriraneKalkulacije.length > 0
              ? null
              : q
                ? "Nema kalkulacija za tu pretragu."
                : "Nema neplaćenih kalkulacija."
          }
        >
          <table className="table-auto text-sm">
            <thead>
              <tr>
                <TH />
                <TH>Kalkulacija</TH>
                <TH>Dobavljač</TH>
                <TH>Broj računa</TH>
                <TH>Datum</TH>
                <TH right>Duži se za</TH>
              </tr>
            </thead>
            <tbody>
              {filtriraneKalkulacije.map((k) => (
                <tr
                  key={k.sifra_kalkulacije}
                  className={redCls(
                    jeIzabran("KALKULACIJA", k.sifra_kalkulacije),
                  )}
                  onClick={() =>
                    prekidacIzbora({
                      tip_dokumenta: "KALKULACIJA",
                      sifra_dokumenta: k.sifra_kalkulacije,
                      naslov: `Kalkulacija ${oznakaKalkulacije(k)}`,
                      partner: k.naziv_dobavljaca ?? null,
                      iznos: k.duzi_se_za_iznos,
                    })
                  }
                >
                  <Oznaka
                    izabran={jeIzabran("KALKULACIJA", k.sifra_kalkulacije)}
                  />
                  <TD bold>{oznakaKalkulacije(k)}</TD>
                  <TD>
                    <Partner naziv={k.naziv_dobavljaca ?? null} />
                  </TD>
                  <TD>{k.broj_racuna ?? "–"}</TD>
                  <TD>{formatDatum(k.datum_kalkulacije)}</TD>
                  <TD right bold>
                    {formatKM(k.duzi_se_za_iznos)}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </KarticaListe>

        <div className="flex-1 min-w-[320px] bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-[#2d2648]">
            <span className="flex-1 whitespace-nowrap text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
              Lista za zatvaranje ({izabrani.length})
            </span>
            <button
              type="button"
              onClick={() => setIzabrani([])}
              disabled={cuvanje || izabrani.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
            >
              Isprazni listu
            </button>
            <button
              type="button"
              onClick={() => void oznaciPlaceno()}
              disabled={cuvanje || izabrani.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {cuvanje ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              Označi kao plaćeno ({izabrani.length})
            </button>
          </div>
          {greskaCuvanja && (
            <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={13} className="flex-shrink-0" />
              <span className="flex-1">
                Nijedan dokument nije označen: {greskaCuvanja}
              </span>
            </div>
          )}
          {izabrani.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
              Kliknite na račun ili kalkulaciju da je dodate na listu.
            </div>
          ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="table-auto w-full text-sm">
              <thead>
                <tr>
                  <TH>Dokument</TH>
                  <TH siroka>Partner</TH>
                  <TH right>Iznos</TH>
                  <TH />
                </tr>
              </thead>
              <tbody>
                {izabrani.map((d) => (
                  <tr
                    key={`${d.tip_dokumenta}-${d.sifra_dokumenta}`}
                    className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1"
                  >
                    <TD bold>{d.naslov}</TD>
                    <TD siroka>
                      <Partner naziv={d.partner} maxSirina="max-w-[420px]" />
                    </TD>
                    <TD right bold>
                      {formatKM(d.iznos)}
                    </TD>
                    <TD right>
                      <button
                        type="button"
                        onClick={() => prekidacIzbora(d)}
                        disabled={cuvanje}
                        title="Skini sa liste"
                        className="block ml-auto text-gray-400 hover:text-red-500 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

    </div>
  );
}
