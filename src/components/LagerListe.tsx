import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import { usePrint } from "../context/PrintContext";
import {
  LagerListaTemplate,
  type LagerListaKolona,
} from "../print/templates/LagerListaTemplate";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

// Red lagera — zajednička polja; ostala zavise od izvora:
// - erp.artikli_pregled_sve (/api/artikli/pregled-sve): nabavna_cijena, vpc,
//   naziv_grupe, vrsta_proizvoda
// - erp.artikli_poluproizvodi_pregled (/api/artikli/poluproizvodi):
//   proizvodna_cijena, transferna_cijena, Proizvodna_vrijednost,
//   Transferna_vrijednos
interface Artikal {
  sifra_proizvoda: number | string;
  naziv_proizvoda: string;
  jm: string;
  kolicina_proizvoda: number | string;
  naziv_grupe?: string;
  vrsta_proizvoda?: number | string;
  [key: string]: unknown;
}

type LagerVrsta = "sirovine" | "proizvodi-m1" | "proizvodi-m2" | "roba";
type Izvor = "pregled-sve" | "poluproizvodi";

const IZVOR_URL: Record<Izvor, string> = {
  "pregled-sve": "/api/artikli/pregled-sve",
  poluproizvodi: "/api/artikli/poluproizvodi",
};

// Kolona iza "Količina". zbir = sabira se u red Ukupno.
interface KolonaDef {
  naslov: string;
  vrijednost: (a: Artikal) => number;
  decimale: number;
  bold?: boolean;
  zbir?: boolean;
}

// izvor null = lager još nije urađen. vrsta = filter po vrsta_proizvoda
// (samo za pregled-sve: 0 sirovina, 1 proizvodi, 2 roba).
interface LagerDef {
  id: LagerVrsta;
  naziv: string;
  izvor: Izvor | null;
  vrsta?: number;
  imaGrupu: boolean;
  kolone: KolonaDef[];
}

const br = (v: unknown) => Number(v) || 0;

const LAGERI: LagerDef[] = [
  {
    id: "sirovine",
    naziv: "Lager sirovine",
    izvor: "pregled-sve",
    vrsta: 0,
    imaGrupu: true,
    kolone: [
      {
        naslov: "Nabavna cijena",
        vrijednost: (a) => br(a.nabavna_cijena),
        decimale: 5,
      },
      {
        naslov: "Ukupno",
        vrijednost: (a) => br(a.kolicina_proizvoda) * br(a.nabavna_cijena),
        decimale: 2,
        bold: true,
        zbir: true,
      },
    ],
  },
  {
    id: "proizvodi-m1",
    naziv: "Lager proizvoda – magacin 1",
    izvor: "poluproizvodi",
    imaGrupu: false,
    kolone: [
      {
        naslov: "Proizvodna cijena",
        vrijednost: (a) => br(a.proizvodna_cijena),
        decimale: 5,
      },
      {
        naslov: "Transferna cijena",
        vrijednost: (a) => br(a.transferna_cijena),
        decimale: 5,
      },
      {
        naslov: "Proizvodna vrijednost",
        vrijednost: (a) => br(a.Proizvodna_vrijednost),
        decimale: 2,
        bold: true,
        zbir: true,
      },
      {
        naslov: "Transferna vrijednost",
        vrijednost: (a) => br(a.Transferna_vrijednos),
        decimale: 2,
        bold: true,
        zbir: true,
      },
    ],
  },
  {
    id: "proizvodi-m2",
    naziv: "Lager proizvoda – magacin 2",
    izvor: "pregled-sve",
    vrsta: 1,
    imaGrupu: true,
    kolone: [
      { naslov: "VPC", vrijednost: (a) => br(a.vpc), decimale: 2 },
      {
        naslov: "Ukupno",
        vrijednost: (a) => br(a.kolicina_proizvoda) * br(a.vpc),
        decimale: 2,
        bold: true,
        zbir: true,
      },
    ],
  },
  {
    id: "roba",
    naziv: "Lager robe",
    izvor: "pregled-sve",
    vrsta: 2,
    imaGrupu: true,
    kolone: [
      { naslov: "VPC", vrijednost: (a) => br(a.vpc), decimale: 2 },
      {
        naslov: "Ukupno",
        vrijednost: (a) => br(a.kolicina_proizvoda) * br(a.vpc),
        decimale: 2,
        bold: true,
        zbir: true,
      },
    ],
  },
];

const formatBroj = (v: number | string | undefined, decimale = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("bs-BA", {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  });
};

// Za CSV: bez razdvajača hiljada, decimalni zarez — Excel sa lokalnim
// (bs/sr) podešavanjima to čita kao broj.
const csvBroj = (v: number, decimale: number) =>
  v.toFixed(decimale).replace(".", ",");

const csvPolje = (v: string) =>
  /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const danasDMY = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

type SortPolje = "grupa" | "sifra" | "naziv" | "kolicina";

// sort = trenutni smjer ako je ova kolona aktivna, null ako nije; bez onSort
// kolona nije sortabilna.
const TH = ({
  children,
  right,
  onSort,
  sort,
}: {
  children: React.ReactNode;
  right?: boolean;
  onSort?: () => void;
  sort?: "asc" | "desc" | null;
}) => (
  <th
    onClick={onSort}
    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"} ${onSort ? "cursor-pointer select-none hover:brightness-110" : ""}`}
    style={{ background: PRIMARY }}
  >
    <span
      className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}
    >
      {children}
      {onSort &&
        (sort === "asc" ? (
          <ArrowUp size={11} />
        ) : sort === "desc" ? (
          <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="opacity-50" />
        ))}
    </span>
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
    className={`px-2 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

export function LagerListe() {
  const [aktivniLager, setAktivniLager] = useState<LagerVrsta>("sirovine");
  // Podaci po izvoru — svaki izvor se učitava kad prvi put zatreba.
  const [podaci, setPodaci] = useState<Partial<Record<Izvor, Artikal[]>>>({});
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [grupa, setGrupa] = useState("sve");
  // Podrazumijevano: po grupi pa po nazivu.
  const [sortPolje, setSortPolje] = useState<SortPolje>("grupa");
  const [sortSmjer, setSortSmjer] = useState<"asc" | "desc">("asc");

  const lager = LAGERI.find((l) => l.id === aktivniLager)!;
  const { openPrint } = usePrint();

  // Prvi klik na kolonu sortira rastuće, drugi opadajuće, treći vraća
  // podrazumijevano (grupa pa naziv).
  const promijeniSort = (polje: SortPolje) => {
    if (sortPolje !== polje) {
      setSortPolje(polje);
      setSortSmjer("asc");
    } else if (sortSmjer === "asc") {
      setSortSmjer("desc");
    } else {
      setSortPolje("grupa");
      setSortSmjer("asc");
    }
  };
  const smjerZa = (polje: SortPolje) =>
    sortPolje === polje ? sortSmjer : null;

  // Kartica oko tabele je ~20% šira od same tabele. Tabela se samo širi
  // (pamti najveću širinu), da se ne sužava pri filtriranju; resetuje se
  // pri promjeni lagera.
  const tabelaRef = useRef<HTMLTableElement>(null);
  const [sirinaTabele, setSirinaTabele] = useState(0);

  useEffect(() => {
    const el = tabelaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSirinaTabele((prev) => Math.max(prev, el.offsetWidth)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [aktivniLager]);

  const ucitaj = async (izvor: Izvor) => {
    setLoading(true);
    setGreska(null);
    try {
      const res = await fetch(`${API_URL}${IZVOR_URL[izvor]}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Greška pri učitavanju lagera");
      const json = await res.json();
      setPodaci((p) => ({ ...p, [izvor]: json.data ?? [] }));
    } catch (e) {
      setGreska(e instanceof Error ? e.message : "Greška pri učitavanju");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lager.izvor && !podaci[lager.izvor]) void ucitaj(lager.izvor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lager.izvor]);

  const stavkeLagera = useMemo(() => {
    if (!lager.izvor) return [];
    const sve = podaci[lager.izvor] ?? [];
    return lager.vrsta === undefined
      ? sve
      : sve.filter((a) => Number(a.vrsta_proizvoda) === lager.vrsta);
  }, [podaci, lager]);

  const grupe = useMemo(
    () =>
      Array.from(new Set(stavkeLagera.map((a) => a.naziv_grupe || ""))).sort(
        (a, b) => a.localeCompare(b, "bs"),
      ),
    [stavkeLagera],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    return stavkeLagera
      .filter((a) => grupa === "sve" || (a.naziv_grupe || "") === grupa)
      .filter(
        (a) =>
          !q ||
          String(a.naziv_proizvoda ?? "").toLowerCase().includes(q) ||
          String(a.sifra_proizvoda ?? "").includes(q),
      )
      .sort((a, b) => {
        const poNazivu = String(a.naziv_proizvoda ?? "").localeCompare(
          String(b.naziv_proizvoda ?? ""),
          "bs",
        );
        let cmp: number;
        if (sortPolje === "sifra") {
          cmp = Number(a.sifra_proizvoda) - Number(b.sifra_proizvoda);
        } else if (sortPolje === "naziv") {
          cmp = poNazivu;
        } else if (sortPolje === "kolicina") {
          cmp =
            br(a.kolicina_proizvoda) - br(b.kolicina_proizvoda) || poNazivu;
        } else {
          cmp =
            String(a.naziv_grupe ?? "").localeCompare(
              String(b.naziv_grupe ?? ""),
              "bs",
            ) || poNazivu;
        }
        return sortSmjer === "asc" ? cmp : -cmp;
      });
  }, [stavkeLagera, pretraga, grupa, sortPolje, sortSmjer]);

  // Zbir po koloni (samo za kolone sa zbir: true).
  const zbirovi = useMemo(
    () =>
      lager.kolone.map((k) =>
        k.zbir ? filtrirani.reduce((s, a) => s + k.vrijednost(a), 0) : null,
      ),
    [filtrirani, lager],
  );

  // +1 za kolonu sa dugmetom za karticu artikla.
  const brojKolona = 5 + lager.kolone.length + (lager.imaGrupu ? 1 : 0);

  // Otvara Karticu artikla u novom tabu, sa unaprijed odabranim proizvodom
  // (isto kao u ArtikliPregled — Dashboard čita section/sifra iz query stringa).
  const otvoriKarticuNovomTabu = (a: Artikal) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}?section=artikli-kartica&sifra=${encodeURIComponent(String(a.sifra_proizvoda))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Kolone za štampu/CSV — iste kao u tabeli, za filtrirane i sortirane stavke.
  const izvozKolone: LagerListaKolona[] = [
    { naslov: "Šifra" },
    { naslov: "Naziv" },
    { naslov: "JM" },
    { naslov: "Količina", right: true },
    ...lager.kolone.map((k) => ({
      naslov: k.naslov,
      right: true,
      bold: k.bold,
    })),
    ...(lager.imaGrupu ? [{ naslov: "Grupa" }] : []),
  ];

  const opisFiltera = [
    grupa !== "sve" ? `Grupa: ${grupa || "(bez grupe)"}` : "",
    pretraga.trim() ? `Pretraga: "${pretraga.trim()}"` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const stampaj = () => {
    const datum = danasDMY();
    openPrint({
      title: `${lager.naziv} ${datum}`,
      orientation: "portrait",
      format: "A4",
      component: (
        <LagerListaTemplate
          naziv={lager.naziv}
          datum={datum}
          filter={opisFiltera}
          kolone={izvozKolone}
          redovi={filtrirani.map((a) => [
            String(a.sifra_proizvoda ?? ""),
            String(a.naziv_proizvoda ?? ""),
            String(a.jm ?? ""),
            formatBroj(br(a.kolicina_proizvoda), 3),
            ...lager.kolone.map((k) => formatBroj(k.vrijednost(a), k.decimale)),
            ...(lager.imaGrupu ? [String(a.naziv_grupe ?? "")] : []),
          ])}
          ukupno={[
            "Ukupno",
            "",
            "",
            "",
            ...zbirovi.map((z) => (z === null ? "" : formatBroj(z))),
            ...(lager.imaGrupu ? [""] : []),
          ]}
        />
      ),
    });
  };

  const izveziCsv = () => {
    const redovi = [
      izvozKolone.map((k) => k.naslov),
      ...filtrirani.map((a) => [
        String(a.sifra_proizvoda ?? ""),
        String(a.naziv_proizvoda ?? ""),
        String(a.jm ?? ""),
        csvBroj(br(a.kolicina_proizvoda), 3),
        ...lager.kolone.map((k) => csvBroj(k.vrijednost(a), k.decimale)),
        ...(lager.imaGrupu ? [String(a.naziv_grupe ?? "")] : []),
      ]),
      [
        "Ukupno",
        "",
        "",
        "",
        ...zbirovi.map((z) => (z === null ? "" : csvBroj(z, 2))),
        ...(lager.imaGrupu ? [""] : []),
      ],
    ];
    const csv = redovi
      .map((red) => red.map(csvPolje).join(";"))
      .join("\r\n");
    // BOM da Excel prepozna UTF-8 (š, č, ć, ž, đ).
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lager.naziv.replace(/[^\p{L}\p{N}]+/gu, "_")}_${danasDMY().replace(/\.$/, "")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Izbor lagera */}
      <div className="flex flex-wrap justify-center gap-2">
        {LAGERI.map((l) => {
          const aktivan = l.id === aktivniLager;
          return (
            <button
              key={l.id}
              onClick={() => {
                setAktivniLager(l.id);
                setGrupa("sve");
                setSirinaTabele(0);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all border-2 ${
                aktivan
                  ? "text-white"
                  : "bg-white dark:bg-[#261f38] text-gray-600 dark:text-[#c5bfd8] hover:bg-purple-50 dark:hover:bg-[#2d2648]"
              }`}
              style={
                aktivan
                  ? { background: PRIMARY, borderColor: PRIMARY }
                  : { borderColor: PRIMARY }
              }
            >
              {l.naziv}
            </button>
          );
        })}
      </div>

      {!lager.izvor ? (
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]">
          {lager.naziv} — u izradi.
        </div>
      ) : (
        <div
          className="mx-auto max-w-full bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-3"
          style={sirinaTabele ? { width: Math.round(sirinaTabele * 1.2) } : {}}
        >
          {/* Filteri */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={pretraga}
                onChange={(e) => setPretraga(e.target.value)}
                placeholder="Pretraga po šifri ili nazivu..."
                className="w-72 rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] pl-9 pr-3 py-2 text-sm text-gray-700 dark:text-[#ede9f6] outline-none focus:border-[#785E9E]"
              />
            </div>
            {lager.imaGrupu && (
              <select
                value={grupa}
                onChange={(e) => setGrupa(e.target.value)}
                className="rounded-xl border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] px-3 py-2 text-sm text-gray-700 dark:text-[#ede9f6] outline-none focus:border-[#785E9E]"
              >
                <option value="sve">Sve grupe</option>
                {grupe.map((g) => (
                  <option key={g} value={g}>
                    {g || "(bez grupe)"}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => lager.izvor && void ucitaj(lager.izvor)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: PRIMARY }}
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Osvježi
            </button>
            <button
              onClick={stampaj}
              disabled={loading || filtrirani.length === 0}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: PRIMARY }}
            >
              <Printer size={14} />
              Štampa
            </button>
            <button
              onClick={izveziCsv}
              disabled={loading || filtrirani.length === 0}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: PRIMARY }}
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
            <span className="ml-auto text-sm text-gray-500 dark:text-[#9e96b8]">
              Stavki: <b>{filtrirani.length}</b>
              {lager.kolone.map((k, i) =>
                zbirovi[i] === null ? null : (
                  <span key={k.naslov}>
                    {" "}
                    · {k.naslov}:{" "}
                    <b className="text-gray-800 dark:text-[#ede9f6]">
                      {formatBroj(zbirovi[i]!)}
                    </b>
                  </span>
                ),
              )}
            </span>
          </div>

          {/* Tabela */}
          <div className="w-fit max-w-full mx-auto rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
            <table
              ref={tabelaRef}
              className="table-auto text-sm"
              style={sirinaTabele ? { minWidth: sirinaTabele } : {}}
            >
              <thead>
                <tr>
                  <TH
                    onSort={() => promijeniSort("sifra")}
                    sort={smjerZa("sifra")}
                  >
                    Šifra
                  </TH>
                  <TH
                    onSort={() => promijeniSort("naziv")}
                    sort={smjerZa("naziv")}
                  >
                    Naziv
                  </TH>
                  <TH>JM</TH>
                  <TH
                    right
                    onSort={() => promijeniSort("kolicina")}
                    sort={smjerZa("kolicina")}
                  >
                    Količina
                  </TH>
                  {lager.kolone.map((k) => (
                    <TH key={k.naslov} right>
                      {k.naslov}
                    </TH>
                  ))}
                  {lager.imaGrupu && <TH>Grupa</TH>}
                  <TH>{""}</TH>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={brojKolona}
                      className="px-3 py-8 text-center text-sm text-gray-400"
                    >
                      <Loader2 size={18} className="inline animate-spin" />
                    </td>
                  </tr>
                ) : greska ? (
                  <tr>
                    <td
                      colSpan={brojKolona}
                      className="px-3 py-8 text-center text-sm text-red-500"
                    >
                      {greska}
                    </td>
                  </tr>
                ) : filtrirani.length === 0 ? (
                  <tr>
                    <td
                      colSpan={brojKolona}
                      className="px-3 py-8 text-center text-sm text-gray-400 dark:text-[#5f5878]"
                    >
                      Nema stavki
                    </td>
                  </tr>
                ) : (
                  filtrirani.map((a) => {
                    const kolicina = br(a.kolicina_proizvoda);
                    return (
                      <tr
                        key={String(a.sifra_proizvoda)}
                        className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1 hover:bg-purple-50/50 dark:hover:bg-[#2d2648]/50"
                      >
                        <TD>
                          <span
                            className={
                              kolicina === 0 ? "font-bold text-red-500" : ""
                            }
                          >
                            {a.sifra_proizvoda}
                          </span>
                        </TD>
                        <TD bold>{a.naziv_proizvoda}</TD>
                        <TD>{a.jm || "–"}</TD>
                        <TD right>
                          <span
                            className={kolicina < 0 ? "text-red-500" : ""}
                          >
                            {formatBroj(kolicina, 3)}
                          </span>
                        </TD>
                        {lager.kolone.map((k) => (
                          <TD key={k.naslov} right bold={k.bold}>
                            {formatBroj(k.vrijednost(a), k.decimale)}
                          </TD>
                        ))}
                        {lager.imaGrupu && <TD>{a.naziv_grupe || "–"}</TD>}
                        <td className="px-1 py-0 text-center">
                          <button
                            type="button"
                            onClick={() => otvoriKarticuNovomTabu(a)}
                            title="Otvori karticu artikla u novom tabu"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"
                            style={{ color: PRIMARY }}
                          >
                            <CreditCard size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && !greska && filtrirani.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]">
                    <TD bold>Ukupno</TD>
                    <TD bold>{""}</TD>
                    <TD bold>{""}</TD>
                    <TD bold>{""}</TD>
                    {lager.kolone.map((k, i) => (
                      <TD key={k.naslov} right bold>
                        {zbirovi[i] === null ? "" : formatBroj(zbirovi[i]!)}
                      </TD>
                    ))}
                    {lager.imaGrupu && <TD bold>{""}</TD>}
                    <TD bold>{""}</TD>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
