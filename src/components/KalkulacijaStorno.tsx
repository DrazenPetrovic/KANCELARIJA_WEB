import ReactDOM from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Package,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const DANGER = "#ef4444";
const ZT_BOJA = "#E0913A";

// Storno kalkulacije: lista samo KALK zapisa (ZT i KO se ne prikazuju, a ni
// storno kalkulacije — one imaju veza = šifra originala). Klik otvara modal
// sa stavkama i pripadajućim ZT-ovima; potvrda šalje samo šifru na
// POST /api/kalkulacije/storno (erp.kalkulacija_unos_storno), koja sama čita
// original iz baze, upisuje storno KALK i ZT-ove sa okrenutim predznacima,
// skida robu sa lagera i postavlja kalkulacija_stornirana = 1 na originalu.

// Red sa erp.kalkulacija_gl_pregled() (GET /api/kalkulacije/glavni).
interface KalkulacijaGlavni {
  sifra_kalkulacije: number;
  datum_kalkulacije: string;
  sifra_dobavljaca: number;
  naziv_dobavljaca: string | null;
  broj_racuna: string | null;
  ukupno_km: number;
  duzi_se_za_iznos: number;
  vrsta_kalkulacije: string | null;
  valuta: string | null;
  veza: string | number | null;
  vp_vrednost: number;
  // 0 = kalkulacija, 1 = stornirana.
  kalkulacija_stornirana: string | number | null;
}

// Red sa erp.kalkulacija_po_pregled() (GET /api/kalkulacije/stavke).
interface KalkulacijaStavka {
  sifra_kalkulacije: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string | null;
  jm: string | null;
  kolicina: number;
  cijena: number;
  rabat: number;
  fakturisana_cijena: number;
  vpc: number;
  nasa_ulazna_cijena: number;
}

// Red sa erp.kalkulacija_zavisni_trosak_pregled(). sifra_kalkulacije = KALK,
// sifra_zavisnog_troska = ZT red u kalkulacija_gl.
interface ZavisniTrosak {
  sifra_kalkulacije: number;
  naziv_troska: string | null;
  ukupno_km: number;
  ukupno_pdv: number;
  sifra_zavisnog_troska: number;
  vrsta_pdv: string | number | null;
}

interface ZtDokument {
  zaglavlje: KalkulacijaGlavni | null;
  sifra: number;
  troskovi: ZavisniTrosak[];
}

const vrsta = (k: { vrsta_kalkulacije: string | null }) =>
  (k.vrsta_kalkulacije ?? "").trim().toUpperCase();
const jeStornirana = (k: KalkulacijaGlavni) =>
  Number(k.kalkulacija_stornirana) === 1;
// Storno kalkulacija nosi šifru originala u polju veza (obične imaju '0').
const jeStornoDokument = (k: KalkulacijaGlavni) => {
  const v = String(k.veza ?? "").trim();
  return v !== "" && v !== "0";
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDatumDMY = (v: string | null | undefined): string => {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "–";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const formatBroj = (v: number | null | undefined, decimale = 2) =>
  Number(v ?? 0)
    .toLocaleString("en-US", {
      minimumFractionDigits: decimale,
      maximumFractionDigits: decimale,
    })
    .replace(/,/g, " ");

const TH = ({
  children,
  right,
  boja = PRIMARY,
}: {
  children: React.ReactNode;
  right?: boolean;
  boja?: string;
}) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: boja }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  right,
  bold,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
}) => (
  <td
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

export function KalkulacijaStorno() {
  const [kalkulacije, setKalkulacije] = useState<KalkulacijaGlavni[]>([]);
  const [stavke, setStavke] = useState<KalkulacijaStavka[]>([]);
  const [zavisniTroskovi, setZavisniTroskovi] = useState<ZavisniTrosak[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [odabrana, setOdabrana] = useState<KalkulacijaGlavni | null>(null);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoGreska, setStornoGreska] = useState<string | null>(null);
  const [stornoUspjeh, setStornoUspjeh] = useState<string | null>(null);

  const dohvati = async <T,>(putanja: string, poruka: string): Promise<T[]> => {
    const res = await fetch(`${API_URL}${putanja}`, { credentials: "include" });
    if (!res.ok) throw new Error(poruka);
    const json = await res.json();
    return json.data ?? [];
  };

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    Promise.all([
      dohvati<KalkulacijaGlavni>(
        "/api/kalkulacije/glavni",
        "Greška pri učitavanju kalkulacija",
      ),
      dohvati<KalkulacijaStavka>(
        "/api/kalkulacije/stavke",
        "Greška pri učitavanju stavki kalkulacija",
      ),
      dohvati<ZavisniTrosak>(
        "/api/kalkulacije/zavisni-troskovi",
        "Greška pri učitavanju zavisnih troškova",
      ),
    ])
      .then(([gl, po, zt]) => {
        setKalkulacije(gl);
        setStavke(po);
        setZavisniTroskovi(zt);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  const zatvori = () => {
    if (stornoLoading) return;
    setOdabrana(null);
    setStornoGreska(null);
    setStornoUspjeh(null);
  };

  useEffect(() => {
    if (!odabrana) return;
    const naTipku = (e: KeyboardEvent) => {
      if (e.key === "Escape") zatvori();
    };
    window.addEventListener("keydown", naTipku);
    return () => window.removeEventListener("keydown", naTipku);
  });

  const poSifri = useMemo(() => {
    const m = new Map<number, KalkulacijaGlavni>();
    for (const k of kalkulacije) m.set(Number(k.sifra_kalkulacije), k);
    return m;
  }, [kalkulacije]);

  const stavkePoKalkulaciji = useMemo(() => {
    const m = new Map<number, KalkulacijaStavka[]>();
    for (const s of stavke) {
      const kljuc = Number(s.sifra_kalkulacije);
      const lista = m.get(kljuc);
      if (lista) lista.push(s);
      else m.set(kljuc, [s]);
    }
    return m;
  }, [stavke]);

  // ZT dokumenti po KALK-u — veza iz zavisan_trosak (sifra_kalkulacije),
  // grupisano po sifra_zavisnog_troska (jedan ZT = jedan red u kalkulacija_gl).
  // Ista veza po kojoj procedura storna bira ZT-ove.
  const ztPoKalkulaciji = useMemo(() => {
    const m = new Map<number, Map<number, ZavisniTrosak[]>>();
    for (const t of zavisniTroskovi) {
      const kalk = Number(t.sifra_kalkulacije);
      const zt = Number(t.sifra_zavisnog_troska);
      let poZt = m.get(kalk);
      if (!poZt) m.set(kalk, (poZt = new Map()));
      const lista = poZt.get(zt);
      if (lista) lista.push(t);
      else poZt.set(zt, [t]);
    }
    return m;
  }, [zavisniTroskovi]);

  const ztZaKalk = (sifra: number): ZtDokument[] =>
    [...(ztPoKalkulaciji.get(sifra) ?? new Map<number, ZavisniTrosak[]>())]
      .map(([ztSifra, troskovi]) => ({
        sifra: ztSifra,
        zaglavlje: poSifri.get(ztSifra) ?? null,
        troskovi,
      }))
      .sort((a, b) => a.sifra - b.sifra);

  const samoKalk = useMemo(
    () =>
      kalkulacije
        .filter((k) => vrsta(k) === "KALK" && !jeStornoDokument(k))
        .sort((a, b) => Number(b.sifra_kalkulacije) - Number(a.sifra_kalkulacije)),
    [kalkulacije],
  );
  const brojStorniranih = useMemo(
    () => samoKalk.filter(jeStornirana).length,
    [samoKalk],
  );

  const filtrirane = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    if (!q) return samoKalk;
    return samoKalk.filter(
      (k) =>
        String(k.sifra_kalkulacije).includes(q) ||
        (k.broj_racuna ?? "").toLowerCase().includes(q) ||
        (k.naziv_dobavljaca ?? "").toLowerCase().includes(q),
    );
  }, [samoKalk, pretraga]);

  const odabraneStavke = odabrana
    ? (stavkePoKalkulaciji.get(Number(odabrana.sifra_kalkulacije)) ?? [])
    : [];
  const odabraniZt = odabrana ? ztZaKalk(Number(odabrana.sifra_kalkulacije)) : [];

  const otvori = (k: KalkulacijaGlavni) => {
    if (jeStornirana(k)) return;
    setStornoGreska(null);
    setStornoUspjeh(null);
    setOdabrana(k);
  };

  const potvrdiStorno = async () => {
    if (!odabrana || stornoLoading) return;
    const sifra = Number(odabrana.sifra_kalkulacije);
    setStornoLoading(true);
    setStornoGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/kalkulacije/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sifra_kalkulacije: sifra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || `Greška pri storniranju kalkulacije (HTTP ${res.status})`,
        );
      }
      const d = json.data ?? {};
      setStornoUspjeh(
        `Kalkulacija ${sifra} je stornirana${
          d.storno_kalkulacija ? ` (storno br. ${d.storno_kalkulacija})` : ""
        }. Stavki: ${d.broj_storniranih_stavki ?? "-"}, ZT: ${
          d.broj_storniranih_zt ?? 0
        }.`,
      );
      ucitaj();
    } catch (error) {
      setStornoGreska(
        error instanceof Error ? error.message : "Greška pri storniranju kalkulacije",
      );
    } finally {
      setStornoLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-fit max-w-full space-y-4">
        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderLeftColor: DANGER }}
        >
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Pretraži kalkulacije..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>
          {!loading && !greska && (
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Kalkulacije (KALK): {filtrirane.length} / {samoKalk.length} ·
              stornirano: {brojStorniranih}
            </p>
          )}
        </div>

        <div
          className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] border-l-4 shadow-sm overflow-hidden"
          style={{ borderLeftColor: DANGER }}
        >
          {loading && kalkulacije.length === 0 ? (
            <div className="flex items-center justify-center py-10 px-16 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Učitavanje...</span>
            </div>
          ) : greska ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-red-500">
              <AlertTriangle size={24} />
              <span className="text-sm">{greska}</span>
            </div>
          ) : filtrirane.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-16 gap-2 text-gray-400 dark:text-[#5f5878]">
              <Package size={24} className="text-gray-300 dark:text-[#3a3158]" />
              <span className="text-sm">Nema kalkulacija</span>
            </div>
          ) : (
            <table className="w-auto text-sm border-collapse">
              <thead>
                <tr>
                  <TH>Šifra</TH>
                  <TH>Datum</TH>
                  <TH>Dobavljač</TH>
                  <TH>Broj računa</TH>
                  <TH right>Ukupno KM</TH>
                  <TH right>VP vrijednost</TH>
                  <TH>ZT</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirane.map((k, i) => {
                  const brojZt =
                    ztPoKalkulaciji.get(Number(k.sifra_kalkulacije))?.size ?? 0;
                  const stornirana = jeStornirana(k);
                  return (
                    <tr
                      key={k.sifra_kalkulacije}
                      onClick={stornirana ? undefined : () => otvori(k)}
                      title={
                        stornirana
                          ? "Kalkulacija je već stornirana — ne može se ponovo stornirati"
                          : undefined
                      }
                      className={`border-b border-gray-100 dark:border-[#2a2340] transition-colors ${
                        stornirana
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                      } ${
                        i % 2 === 0
                          ? "bg-white dark:bg-[#1a1528]"
                          : "bg-[#faf9fc] dark:bg-[#1e1a2d]"
                      }`}
                    >
                      <td
                        className={`px-3 py-2.5 whitespace-nowrap font-bold ${
                          stornirana
                            ? "text-red-500"
                            : "text-gray-800 dark:text-[#ede9f6]"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {stornirana && <Lock size={13} className="flex-shrink-0" />}
                          {k.sifra_kalkulacije}
                        </span>
                      </td>
                      <TD>{formatDatumDMY(k.datum_kalkulacije)}</TD>
                      <td className="px-3 py-2.5 text-gray-800 dark:text-[#ede9f6]">
                        {k.naziv_dobavljaca ?? "–"}
                      </td>
                      <TD>{k.broj_racuna || "–"}</TD>
                      <TD right bold>
                        {formatBroj(k.ukupno_km)}
                      </TD>
                      <TD right>{formatBroj(k.vp_vrednost)}</TD>
                      <TD>
                        {brojZt > 0 ? (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: `${ZT_BOJA}1f`, color: ZT_BOJA }}
                          >
                            ZT × {brojZt}
                          </span>
                        ) : null}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {odabrana &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) zatvori();
            }}
          >
            <div
              className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border-2 w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
              style={{ borderColor: stornoUspjeh ? ACCENT : DANGER }}
            >
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: stornoUspjeh ? PRIMARY : DANGER }}
              >
                <RotateCcw size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Storno kalkulacije {odabrana.sifra_kalkulacije}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {odabrana.naziv_dobavljaca ?? "–"} · račun{" "}
                    {odabrana.broj_racuna || "–"} ·{" "}
                    {formatDatumDMY(odabrana.datum_kalkulacije)}
                  </div>
                </div>
                <button
                  onClick={zatvori}
                  disabled={stornoLoading}
                  className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all flex-shrink-0 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-auto space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-[#c5bfd8]">
                  <span>
                    Ukupno KM:{" "}
                    <strong className="text-gray-800 dark:text-[#ede9f6]">
                      {formatBroj(odabrana.ukupno_km)}
                    </strong>
                  </span>
                  <span>
                    Duži se za:{" "}
                    <strong className="text-gray-800 dark:text-[#ede9f6]">
                      {formatBroj(odabrana.duzi_se_za_iznos)}
                    </strong>
                  </span>
                  <span>
                    VP vrijednost:{" "}
                    <strong className="text-gray-800 dark:text-[#ede9f6]">
                      {formatBroj(odabrana.vp_vrednost)}
                    </strong>
                  </span>
                  <span>
                    Valuta:{" "}
                    <strong className="text-gray-800 dark:text-[#ede9f6]">
                      {formatDatumDMY(odabrana.valuta)}
                    </strong>
                  </span>
                </div>

                <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <TH>#</TH>
                        <TH>Artikal</TH>
                        <TH right>Količina</TH>
                        <TH right>Cijena</TH>
                        <TH right>Rabat %</TH>
                        <TH right>Fakt. cijena</TH>
                        <TH right>Ulazna cijena</TH>
                        <TH right>VPC</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {odabraneStavke.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                          >
                            Nema stavki.
                          </td>
                        </tr>
                      )}
                      {odabraneStavke.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1"
                        >
                          <TD>{i + 1}</TD>
                          <TD>
                            <span className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                              {s.naziv_proizvoda ?? "—"}
                            </span>
                            <span className="ml-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                              {s.sifra_proizvoda}
                              {s.jm ? ` · ${s.jm}` : ""}
                            </span>
                          </TD>
                          <TD right bold>
                            {formatBroj(s.kolicina, 3)}
                          </TD>
                          <TD right>{formatBroj(s.cijena, 5)}</TD>
                          <TD right>{formatBroj(s.rabat, 3)}</TD>
                          <TD right>{formatBroj(s.fakturisana_cijena, 5)}</TD>
                          <TD right>{formatBroj(s.nasa_ulazna_cijena, 5)}</TD>
                          <TD right>{formatBroj(s.vpc)}</TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {odabraniZt.map((zt) => (
                  <div
                    key={zt.sifra}
                    className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto"
                  >
                    <div
                      className="px-3 py-1.5 text-xs font-bold"
                      style={{ background: `${ZT_BOJA}1f`, color: ZT_BOJA }}
                    >
                      ZT {zt.sifra}
                      {zt.zaglavlje
                        ? ` · ${zt.zaglavlje.naziv_dobavljaca ?? "–"} · račun ${zt.zaglavlje.broj_racuna || "–"} · ${formatDatumDMY(zt.zaglavlje.datum_kalkulacije)} · ukupno ${formatBroj(zt.zaglavlje.ukupno_km)}`
                        : " · zaglavlje ZT-a nije pronađeno"}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <TH boja={ZT_BOJA}>#</TH>
                          <TH boja={ZT_BOJA}>Naziv troška</TH>
                          <TH boja={ZT_BOJA}>Vrsta PDV</TH>
                          <TH boja={ZT_BOJA} right>
                            PDV
                          </TH>
                          <TH boja={ZT_BOJA} right>
                            Ukupno
                          </TH>
                        </tr>
                      </thead>
                      <tbody>
                        {zt.troskovi.map((t, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1"
                          >
                            <TD>{i + 1}</TD>
                            <TD>
                              <span className="font-semibold text-gray-800 dark:text-[#ede9f6]">
                                {t.naziv_troska || "—"}
                              </span>
                            </TD>
                            <TD>{t.vrsta_pdv ?? "—"}</TD>
                            <TD right>{formatBroj(t.ukupno_pdv)}</TD>
                            <TD right bold>
                              {formatBroj(t.ukupno_km)}
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {stornoUspjeh ? (
                  <div className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{stornoUspjeh}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-[#7d7498] bg-gray-50 dark:bg-[#1e1a2d] rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Stornira se CIJELA kalkulacija
                      {odabraniZt.length > 0
                        ? ` zajedno sa ${odabraniZt.length} ZT`
                        : ""}
                      : roba se skida sa lagera, a nabavna cijena se vraća.
                      Ako je na stanju manje od kalkulisane količine, storno
                      nije moguć. Akcija se ne može poništiti.
                    </span>
                  </div>
                )}

                {stornoGreska && (
                  <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{stornoGreska}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                {stornoUspjeh ? (
                  <button
                    onClick={zatvori}
                    className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all"
                    style={{ background: PRIMARY }}
                  >
                    Zatvori
                  </button>
                ) : (
                  <>
                    <button
                      onClick={zatvori}
                      disabled={stornoLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all disabled:opacity-50"
                    >
                      Otkaži
                    </button>
                    <button
                      onClick={() => void potvrdiStorno()}
                      disabled={stornoLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: DANGER }}
                    >
                      {stornoLoading && <Loader2 size={14} className="animate-spin" />}
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
