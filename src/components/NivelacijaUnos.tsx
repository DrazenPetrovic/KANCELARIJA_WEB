import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";
const PDV_FAKTOR = 1.17;

// Red sa erp.artikli_bez_sirovine_pregled() (/api/artikli) — sirovine se ne
// nivelišu, zato se ne koristi "pregled-sve" varijanta.
interface Artikal {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  vpc: number | string;
  mpc: number | string;
  nabavna_cijena: number | string;
  barkod: string;
  kolicina_proizvoda: number | string;
  vrsta_proizvoda: number | string;
  sirovina?: number | string | null;
  [key: string]: unknown;
}

interface StavkaNivelacije {
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number;
  nabavna: number;
  staraVpc: number;
  staraMpc: number;
  novaVpc: number;
  novaMpc: number;
}

// Vrsta 2 = Roba (vidi VRSTA_OPCIJE u ArtikliUnos). Jedna nivelacija je ili
// nivelacija robe (nivelacija_robe = 1) ili proizvoda (0) — ne miješaju se.
type VrstaNivelacije = "roba" | "proizvodi";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

const broj = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const formatBroj = (v: number, decimale = 2) =>
  v.toLocaleString("bs-BA", {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  });

const p2 = (n: number) => String(n).padStart(2, "0");

// Datum nivelacije je uvijek trenutno vrijeme — operater ga ne mijenja.
// Prikaz: dd.MM.yyyy HH:mm (24h); u proceduru ide yyyy-MM-dd HH:mm:ss.
const datumZaPrikaz = (d: Date) =>
  `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const datumZaBazu = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

// Vrste (vidi VRSTA_OPCIJE u ArtikliUnos): 0 sirovina, 1 proizvodi, 2 roba,
// 3 usluga. Nivelišu se samo roba i proizvodi, i to nikad zajedno; sirovina
// se nikad ne niveliše.
const jeSirovina = (a: Artikal) =>
  Number(a.vrsta_proizvoda) === 0 || Number(a.sirovina ?? 0) === 1;
const odgovaraVrsti = (a: Artikal, vrsta: VrstaNivelacije) =>
  !jeSirovina(a) &&
  Number(a.vrsta_proizvoda) === (vrsta === "roba" ? 2 : 1);

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

export function NivelacijaUnos() {
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);

  const [sada, setSada] = useState(() => new Date());
  const [vrsta, setVrsta] = useState<VrstaNivelacije>("roba");

  const [pretraga, setPretraga] = useState("");
  const [listaOtvorena, setListaOtvorena] = useState(false);
  const [oznacen, setOznacen] = useState(0);
  const [odabrani, setOdabrani] = useState<Artikal | null>(null);
  const [novaVpc, setNovaVpc] = useState("");
  const [novaMpc, setNovaMpc] = useState("");

  const [stavke, setStavke] = useState<StavkaNivelacije[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  // Zadnja dodana/izmijenjena stavka — ističe se u tabeli da operater vidi
  // šta je upravo unio (fokus namjerno ne skače odmah na pretragu).
  const [zadnjaDodana, setZadnjaDodana] = useState<number | null>(null);
  const [cuvanje, setCuvanje] = useState(false);

  const pretragaRef = useRef<HTMLInputElement>(null);
  const vpcRef = useRef<HTMLInputElement>(null);

  const ucitajArtikle = async () => {
    try {
      const res = await fetch(`${API_URL}/api/artikli`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Greška pri učitavanju artikala");
      const json = await res.json();
      setArtikli(json.data ?? []);
    } catch (err) {
      setGreska(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setUcitavanje(false);
    }
  };

  useEffect(() => {
    void ucitajArtikle();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSada(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const artikliVrste = useMemo(
    () =>
      artikli.filter((a) => odgovaraVrsti(a, vrsta)),
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

  const odabraniNabavna = odabrani ? broj(odabrani.nabavna_cijena) : 0;
  const novaVpcBroj = round2(broj(novaVpc));
  const ispodNabavne =
    !!odabrani &&
    novaVpcBroj > 0 &&
    odabraniNabavna > 0 &&
    novaVpcBroj < round2(odabraniNabavna);

  const odaberiArtikal = (a: Artikal) => {
    setOdabrani(a);
    setPretraga(`${a.sifra_proizvoda} – ${a.naziv_proizvoda}`);
    setListaOtvorena(false);
    setGreska(null);
    setUspjeh(null);
    const postojeca = stavke.find(
      (s) => s.sifra_proizvoda === Number(a.sifra_proizvoda),
    );
    setNovaVpc(postojeca ? postojeca.novaVpc.toFixed(2) : "");
    setNovaMpc(postojeca ? postojeca.novaMpc.toFixed(2) : "");
    setTimeout(() => vpcRef.current?.focus(), 0);
  };

  const ponistiOdabir = (fokusNaPretragu = true) => {
    setOdabrani(null);
    setPretraga("");
    setNovaVpc("");
    setNovaMpc("");
    if (fokusNaPretragu) setTimeout(() => pretragaRef.current?.focus(), 0);
  };

  const promjenaVpc = (val: string) => {
    setNovaVpc(val);
    const n = parseFloat(val);
    setNovaMpc(n > 0 ? round2(n * PDV_FAKTOR).toFixed(2) : "");
  };

  const promjenaMpc = (val: string) => {
    setNovaMpc(val);
    const n = parseFloat(val);
    setNovaVpc(n > 0 ? round2(n / PDV_FAKTOR).toFixed(2) : "");
  };

  const dodajStavku = () => {
    if (!odabrani) return;
    const staraVpc = round2(broj(odabrani.vpc));
    if (!(novaVpcBroj > 0)) {
      setGreska("Unesite novu VPC ili MPC.");
      return;
    }
    if (ispodNabavne) {
      setGreska(
        `Nova VPC (${formatBroj(novaVpcBroj)}) ne smije biti ispod nabavne cijene (${formatBroj(odabraniNabavna, 3)}).`,
      );
      return;
    }
    if (novaVpcBroj === staraVpc) {
      setGreska("Nova VPC je ista kao trenutna — nema šta nivelisati.");
      return;
    }

    const stavka: StavkaNivelacije = {
      sifra_proizvoda: Number(odabrani.sifra_proizvoda),
      naziv_proizvoda: odabrani.naziv_proizvoda,
      jm: odabrani.jm,
      kolicina: round3(broj(odabrani.kolicina_proizvoda)),
      nabavna: broj(odabrani.nabavna_cijena),
      staraVpc,
      staraMpc: round2(broj(odabrani.mpc)),
      novaVpc: novaVpcBroj,
      novaMpc: round2(broj(novaMpc)),
    };
    setStavke((prev) => {
      const i = prev.findIndex(
        (s) => s.sifra_proizvoda === stavka.sifra_proizvoda,
      );
      if (i === -1) return [...prev, stavka];
      const kopija = [...prev];
      kopija[i] = stavka;
      return kopija;
    });
    setGreska(null);
    setUspjeh(
      `Dodano: ${stavka.naziv_proizvoda} — VPC ${formatBroj(stavka.staraVpc)} → ${formatBroj(stavka.novaVpc)}, MPC ${formatBroj(stavka.staraMpc)} → ${formatBroj(stavka.novaMpc)}`,
    );
    setZadnjaDodana(stavka.sifra_proizvoda);
    ponistiOdabir(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const ukloniStavku = (sifra: number) =>
    setStavke((prev) => prev.filter((s) => s.sifra_proizvoda !== sifra));

  const ukupnoStaro = round3(
    stavke.reduce((s, r) => s + r.kolicina * r.staraVpc, 0),
  );
  const ukupnoNovo = round3(
    stavke.reduce((s, r) => s + r.kolicina * r.novaVpc, 0),
  );

  const sacuvaj = async () => {
    if (stavke.length === 0 || cuvanje) return;
    const mijesano = stavke.some((s) => {
      const a = artikli.find(
        (x) => Number(x.sifra_proizvoda) === s.sifra_proizvoda,
      );
      return !a || !odgovaraVrsti(a, vrsta);
    });
    if (mijesano) {
      setGreska(
        "Nivelacija sadrži stavke koje ne odgovaraju izabranoj vrsti (ili sirovine) — uklonite ih.",
      );
      return;
    }
    setCuvanje(true);
    setGreska(null);
    setUspjeh(null);
    try {
      const res = await fetch(`${API_URL}/api/nivelacije/unos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          datum_nivelacije: datumZaBazu(new Date()),
          nivelacija_robe: vrsta === "roba" ? 1 : 0,
          sifra_knjizenja: 0,
          stavke: stavke.map((s) => ({
            sifra_proizvoda: s.sifra_proizvoda,
            kolicina_proizvoda: s.kolicina,
            cijena_stara: s.staraVpc,
            cijena_nova: s.novaVpc,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu nivelacije");
      }
      const sifra = json.data?.sifra_nivelacije;
      setUspjeh(
        sifra
          ? `Nivelacija br. ${sifra} je sačuvana (${stavke.length} stavki).`
          : `Nivelacija je sačuvana (${stavke.length} stavki).`,
      );
      setStavke([]);
      ponistiOdabir();
      void ucitajArtikle();
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
          <Tags size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Unos nivelacije
        </h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start justify-center">
      {/* Lijevo: unos */}
      <div className="w-full xl:w-[460px] flex-shrink-0 space-y-4">

      {/* Zaglavlje */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Datum nivelacije">
            <input
              type="text"
              value={datumZaPrikaz(sada)}
              readOnly
              tabIndex={-1}
              className={`${inputClass} cursor-default tabular-nums bg-gray-50 dark:bg-[#231d33]`}
            />
          </Field>
          <Field label="Vrsta nivelacije">
            <select
              value={vrsta}
              onChange={(e) => {
                if (
                  stavke.length > 0 &&
                  !window.confirm(
                    "Promjena vrste nivelacije briše sve unesene stavke. Nastaviti?",
                  )
                )
                  return;
                setVrsta(e.target.value as VrstaNivelacije);
                setStavke([]);
                ponistiOdabir();
              }}
              className={inputClass}
            >
              <option value="roba">Nivelacija robe</option>
              <option value="proizvodi">Nivelacija proizvoda</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Izbor proizvoda i nove cijene */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 space-y-3">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: PRIMARY }}
        >
          Proizvod
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
                : "Šifra, naziv ili barkod proizvoda..."
            }
            disabled={ucitavanje}
            onChange={(e) => {
              setPretraga(e.target.value);
              setOdabrani(null);
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
                if (a) odaberiArtikal(a);
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
              {filtrirani.map((a, i) => {
                const uNivelaciji = stavke.some(
                  (s) => s.sifra_proizvoda === Number(a.sifra_proizvoda),
                );
                return (
                  <button
                    key={String(a.sifra_proizvoda)}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      odaberiArtikal(a);
                    }}
                    onMouseEnter={() => setOznacen(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                      i === oznacen
                        ? "bg-purple-50 dark:bg-[#2d2648]"
                        : ""
                    } text-gray-700 dark:text-[#c5bfd8]`}
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs text-gray-400 mr-2">
                        {String(a.sifra_proizvoda)}
                      </span>
                      {a.naziv_proizvoda}
                      {uNivelaciji && (
                        <span
                          className="ml-2 text-xs font-semibold"
                          style={{ color: ACCENT }}
                        >
                          (u nivelaciji)
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-gray-500 dark:text-[#9e96b8]">
                      VPC {formatBroj(broj(a.vpc))} · MPC{" "}
                      {formatBroj(broj(a.mpc))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {odabrani && (
          <>
            {/* Trenutno stanje */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Stanje",
                  vrijednost: `${formatBroj(broj(odabrani.kolicina_proizvoda), 3)} ${odabrani.jm ?? ""}`,
                },
                {
                  label: "Nabavna cijena",
                  vrijednost: formatBroj(odabraniNabavna, 3),
                },
                {
                  label: "Trenutna VPC",
                  vrijednost: formatBroj(broj(odabrani.vpc)),
                },
                {
                  label: "Trenutna MPC",
                  vrijednost: formatBroj(broj(odabrani.mpc)),
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

            {/* Nove cijene */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label="Nova VPC">
                <input
                  ref={vpcRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVpc}
                  onChange={(e) => promjenaVpc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dodajStavku();
                    }
                  }}
                  className={`${inputClass} ${ispodNabavne ? "!border-red-400" : ""}`}
                />
              </Field>
              <Field label={`Nova MPC (VPC × ${PDV_FAKTOR})`}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaMpc}
                  onChange={(e) => promjenaMpc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dodajStavku();
                    }
                  }}
                  className={`${inputClass} ${ispodNabavne ? "!border-red-400" : ""}`}
                />
              </Field>
              <button
                type="button"
                onClick={dodajStavku}
                disabled={!(novaVpcBroj > 0) || ispodNabavne}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: PRIMARY }}
              >
                <Plus size={15} />
                Dodaj
              </button>
            </div>

            {ispodNabavne && (
              <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertTriangle size={12} />
                Nova VPC ne smije biti ispod nabavne cijene (
                {formatBroj(odabraniNabavna, 3)}).
              </p>
            )}
            {!ispodNabavne && novaVpcBroj > 0 && broj(odabrani.vpc) > 0 && (
              <p className="text-xs text-gray-500 dark:text-[#9e96b8]">
                Promjena:{" "}
                <b
                  className={
                    novaVpcBroj >= broj(odabrani.vpc)
                      ? "text-green-600"
                      : "text-red-500"
                  }
                >
                  {formatBroj(
                    ((novaVpcBroj - broj(odabrani.vpc)) / broj(odabrani.vpc)) *
                      100,
                  )}
                  %
                </b>
                {odabraniNabavna > 0 && (
                  <>
                    {" "}
                    · marža na nabavnu:{" "}
                    <b>
                      {formatBroj(
                        ((novaVpcBroj - odabraniNabavna) / odabraniNabavna) *
                          100,
                      )}
                      %
                    </b>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>

      {greska && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          <AlertTriangle size={15} />
          {greska}
        </div>
      )}
      {uspjeh && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
          <CheckCircle2 size={15} />
          {uspjeh}
        </div>
      )}

      </div>

      {/* Desno: stavke */}
      <div className="min-w-0 max-w-full space-y-4">
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto">
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Šifra</TH>
                <TH>Naziv</TH>
                <TH right>Količina</TH>
                <TH right>Nabavna</TH>
                <TH right>Stara VPC</TH>
                <TH right>Nova VPC</TH>
                <TH right>Stara MPC</TH>
                <TH right>Nova MPC</TH>
                <TH right>Iznos staro</TH>
                <TH right>Iznos novo</TH>
                <TH right>Razlika</TH>
                <TH />
              </tr>
            </thead>
            <tbody>
              {stavke.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[#6f6890]"
                  >
                    Nema stavki — izaberite proizvod i unesite novu cijenu.
                  </td>
                </tr>
              )}
              {stavke.map((s, i) => {
                const staro = s.kolicina * s.staraVpc;
                const novo = s.kolicina * s.novaVpc;
                const artikal = artikli.find(
                  (a) => Number(a.sifra_proizvoda) === s.sifra_proizvoda,
                );
                return (
                  <tr
                    key={s.sifra_proizvoda}
                    onClick={() => artikal && odaberiArtikal(artikal)}
                    className={`cursor-pointer hover:bg-purple-50/60 dark:hover:bg-[#2d2648] ${
                      s.sifra_proizvoda === zadnjaDodana
                        ? "bg-green-50 dark:bg-green-900/20"
                        : ""
                    }`}
                    title="Klik za izmjenu cijene"
                  >
                    <TD>{i + 1}</TD>
                    <TD className="font-mono text-xs">{s.sifra_proizvoda}</TD>
                    <TD>{s.naziv_proizvoda}</TD>
                    <TD right>
                      {formatBroj(s.kolicina, 3)} {s.jm}
                    </TD>
                    <TD right>{formatBroj(s.nabavna, 3)}</TD>
                    <TD right>{formatBroj(s.staraVpc)}</TD>
                    <TD right className="font-bold">
                      {formatBroj(s.novaVpc)}
                    </TD>
                    <TD right>{formatBroj(s.staraMpc)}</TD>
                    <TD right className="font-bold">
                      {formatBroj(s.novaMpc)}
                    </TD>
                    <TD right>{formatBroj(staro)}</TD>
                    <TD right>{formatBroj(novo)}</TD>
                    <TD
                      right
                      className={
                        novo - staro >= 0 ? "!text-green-600" : "!text-red-500"
                      }
                    >
                      {formatBroj(novo - staro)}
                    </TD>
                    <TD>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          ukloniStavku(s.sifra_proizvoda);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Ukloni stavku"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
            {stavke.length > 0 && (
              <tfoot>
                <tr className="bg-[#f4f1f9] dark:bg-[#1c1828] font-bold">
                  <td
                    colSpan={9}
                    className="px-1.5 py-2 text-sm text-right text-gray-700 dark:text-[#c5bfd8]"
                  >
                    Ukupno:
                  </td>
                  <td className="px-1.5 py-2 text-sm text-right tabular-nums text-gray-800 dark:text-[#ede9f6]">
                    {formatBroj(ukupnoStaro)}
                  </td>
                  <td className="px-1.5 py-2 text-sm text-right tabular-nums text-gray-800 dark:text-[#ede9f6]">
                    {formatBroj(ukupnoNovo)}
                  </td>
                  <td
                    className={`px-1.5 py-2 text-sm text-right tabular-nums ${
                      ukupnoNovo - ukupnoStaro >= 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {formatBroj(ukupnoNovo - ukupnoStaro)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setStavke([]);
            ponistiOdabir();
            setGreska(null);
          }}
          disabled={stavke.length === 0 || cuvanje}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] disabled:opacity-40"
        >
          Poništi
        </button>
        <button
          type="button"
          onClick={sacuvaj}
          disabled={stavke.length === 0 || cuvanje}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: PRIMARY }}
        >
          {cuvanje ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Sačuvaj nivelaciju
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}
