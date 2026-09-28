import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Landmark,
  Loader2,
  LockOpen,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  formatDatum,
  formatDatumVrijeme,
  formatKM,
  redoslijedStavke,
  stavkaInfo,
  type IzvodRed,
  type UplataRed,
} from "./IzvodiPregled";
import { IzvodiUnosForma } from "./IzvodiUnosForma";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Unos uplata/isplata na izvod — prvi korak: izbor jednog od OTVORENIH
// izvoda (izvod_zatvoren != 1 u erp.izvodi_pregled), zatim ekran izvoda sa
// stavkama koje već ima i formom za unos novih (IzvodiUnosForma →
// erp.izvodi_uplate_unos).

export function IzvodiUnos() {
  const [izvodi, setIzvodi] = useState<IzvodRed[]>([]);
  const [uplate, setUplate] = useState<UplataRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [izabraniRedniBroj, setIzabraniRedniBroj] = useState<number | null>(
    null,
  );

  const ucitaj = async () => {
    setLoading(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/izvodi/pregled-sa-uplatama`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Greška pri učitavanju izvoda");
      const json = await res.json();
      setIzvodi(json.izvodi ?? []);
      setUplate(json.uplate ?? []);
    } catch (e: unknown) {
      setGreska(e instanceof Error ? e.message : "Nepoznata greška");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ucitaj();
  }, []);

  const otvoreniIzvodi = useMemo(
    () =>
      izvodi
        .filter((i) => Number(i.izvod_zatvoren) !== 1)
        .sort((a, b) =>
          (a.naziv_banke ?? "").localeCompare(b.naziv_banke ?? "", "bs") ||
          b.redni_broj - a.redni_broj,
        ),
    [izvodi],
  );

  // Ako je izabrani izvod u međuvremenu zatvoren (nakon osvježavanja), više
  // nije u listi otvorenih — ekran se vraća na izbor.
  const izabrani =
    otvoreniIzvodi.find((i) => i.redni_broj === izabraniRedniBroj) ?? null;

  const stavkeIzabranog = useMemo(() => {
    if (!izabrani) return [];
    return uplate
      .filter((u) => String(u.sifra_blagajne) === String(izabrani.redni_broj))
      .sort((a, b) => {
        const tipA = redoslijedStavke(a);
        const tipB = redoslijedStavke(b);
        if (tipA !== tipB) return tipA - tipB;
        return (Number(b.uplaceno) || 0) - (Number(a.uplaceno) || 0);
      });
  }, [uplate, izabrani]);

  const brojStavki = (redniBroj: number) =>
    uplate.filter((u) => String(u.sifra_blagajne) === String(redniBroj))
      .length;

  const obracunato = (i: IzvodRed) =>
    (Number(i.pocetno_stanje) || 0) +
    (Number(i.ukupno_uplata) || 0) -
    (Number(i.ukupno_isplata) || 0);

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        {izabrani && (
          <button
            type="button"
            onClick={() => setIzabraniRedniBroj(null)}
            title="Nazad na izbor izvoda"
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
          <Wallet size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
            Unos uplata / isplata
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            {izabrani
              ? `${izabrani.naziv_banke ?? `Banka #${izabrani.sifra_banke}`} · Izvod #${izabrani.sifra_izvoda}`
              : "Izaberite otvoren izvod na koji unosite stavke"}
          </p>
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

      {loading && izvodi.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2
            size={26}
            className="animate-spin"
            style={{ color: PRIMARY }}
          />
          <span className="text-sm text-gray-400 dark:text-[#5f5878]">
            Učitavanje izvoda...
          </span>
        </div>
      ) : greska ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm text-red-500 dark:text-red-400">{greska}</p>
          <button
            type="button"
            onClick={() => void ucitaj()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
          >
            Pokušaj ponovo
          </button>
        </div>
      ) : !izabrani ? (
        /* KORAK 1 — izbor otvorenog izvoda */
        otvoreniIzvodi.length === 0 ? (
          <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm flex flex-col items-center gap-2 py-16">
            <Landmark size={28} className="text-gray-300 dark:text-[#3a3158]" />
            <p className="text-sm text-gray-500 dark:text-[#7d7498]">
              Nema otvorenih izvoda.
            </p>
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Otvorite izvod u meniju Izvodi → Status izvoda.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {otvoreniIzvodi.map((i) => (
              <button
                key={i.redni_broj}
                type="button"
                onClick={() => setIzabraniRedniBroj(i.redni_broj)}
                className="text-left bg-white dark:bg-[#261f38] rounded-2xl border-2 shadow-sm px-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ borderColor: `${ACCENT}80` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#ede8f5] dark:bg-[#312a50]">
                    <Landmark size={16} style={{ color: PRIMARY }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      {i.naziv_banke ?? `Banka #${i.sifra_banke}`}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                      Izvod #{i.sifra_izvoda} · {formatDatum(i.datum_izvoda)}
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: "#e9f7df", color: ACCENT }}
                  >
                    <LockOpen size={10} />
                    OTVOREN
                  </span>
                  <ChevronRight
                    size={16}
                    className="flex-shrink-0"
                    style={{ color: PRIMARY }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <div className="text-gray-400 dark:text-[#5f5878]">
                      Uplate
                    </div>
                    <div className="font-semibold" style={{ color: ACCENT }}>
                      {formatKM(i.ukupno_uplata)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 dark:text-[#5f5878]">
                      Isplate
                    </div>
                    <div className="font-semibold text-red-500">
                      {formatKM(i.ukupno_isplata)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 dark:text-[#5f5878]">
                      Stanje
                    </div>
                    <div className="font-semibold" style={{ color: PRIMARY }}>
                      {formatKM(obracunato(i))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400 dark:text-[#5f5878]">
                  {brojStavki(i.redni_broj)} stavki · otvoren{" "}
                  {formatDatumVrijeme(i.izvod_unos_otvoren)}
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        /* KORAK 2 — unos na izabrani izvod */
        <div className="space-y-4">
          {/* Sažetak izvoda */}
          <div className="flex flex-wrap gap-3">
            {[
              { naziv: "Početno stanje", v: izabrani.pocetno_stanje, boja: undefined },
              { naziv: "Uplate", v: izabrani.ukupno_uplata, boja: ACCENT },
              { naziv: "Isplate", v: izabrani.ukupno_isplata, boja: "#ef4444" },
              { naziv: "Obračunato stanje", v: obracunato(izabrani), boja: PRIMARY },
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
          </div>

          {/* Forma za unos — key resetuje formu i listu pri promjeni izvoda */}
          <IzvodiUnosForma
            key={izabrani.redni_broj}
            izvod={izabrani}
            onSpremljeno={() => void ucitaj()}
          />

          {/* Postojeće stavke */}
          <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
            <div
              className="px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase"
              style={{ background: `${PRIMARY}0a`, color: PRIMARY }}
            >
              Stavke izvoda ({stavkeIzabranog.length})
            </div>
            {stavkeIzabranog.length === 0 ? (
              <div className="flex items-center justify-center gap-1.5 py-8 text-gray-400 dark:text-[#5f5878]">
                <Wallet size={16} className="text-gray-300 dark:text-[#3a3158]" />
                <span className="text-xs">Na izvodu još nema stavki</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: PRIMARY }}>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                        Partner
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                        Datum
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-green-200">
                        Uplate
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-200">
                        Isplate
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                        Opis
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                        Vrsta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stavkeIzabranog.map((u) => {
                      const vrsta = stavkaInfo(u);
                      const boja = vrsta.transfer
                        ? "#2563eb"
                        : vrsta.tip === "isplata"
                          ? "#ef4444"
                          : ACCENT;
                      return (
                        <tr
                          key={
                            vrsta.transfer
                              ? `T-${u.sifra_transfera}-${u.smjer}`
                              : `U-${u.sifra_uplate}`
                          }
                          className="border-t border-gray-50 dark:border-[#2d2648] hover:bg-purple-50/60 dark:hover:bg-[#271f40]/60"
                        >
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
                            {u.naziv_partnera ?? `Partner #${u.sifra_partnera}`}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 dark:text-[#a99fc2] whitespace-nowrap">
                            {formatDatum(u.datum_uplate ?? izabrani.datum_izvoda)}
                          </td>
                          <td
                            className="px-3 py-2 text-sm text-right font-semibold whitespace-nowrap"
                            style={{ color: ACCENT }}
                          >
                            {vrsta.tip === "uplata" ? formatKM(u.uplaceno) : ""}
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-red-500 whitespace-nowrap">
                            {vrsta.tip === "isplata" ? formatKM(u.uplaceno) : ""}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-[#c5bfd8]">
                            {u.opis || "–"}
                          </td>
                          <td
                            className="px-3 py-2 text-sm text-right font-medium whitespace-nowrap"
                            style={{ color: boja }}
                          >
                            {vrsta.naziv}
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
      )}
    </div>
  );
}
