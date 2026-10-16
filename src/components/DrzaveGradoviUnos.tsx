import { useEffect, useMemo, useState } from "react";
import { Building2, Globe, Plus, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface Drzava {
  sifra_drzave: number;
  naziv_drzave: string;
  aktivan: number;
}

interface Grad {
  sifra_grada: number;
  naziv_grada: string;
  entitet: string | null;
  ptt: string | null;
  sifra_drzave: number;
  naziv_drzave?: string | null;
  aktivan: number;
}

const TH = ({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
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
    className={`px-3 py-1 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

const kartica =
  "bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-3";
const inputKlasa =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#3a3158] bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] focus:outline-none focus:ring-2 focus:ring-[#785E9E]/40";

const labelKlasa =
  "block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1";

const StatusBadge = ({ aktivan, zenski }: { aktivan: number; zenski?: boolean }) => (
  <span
    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
      Number(aktivan) === 1
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-600"
    }`}
  >
    {Number(aktivan) === 1
      ? zenski
        ? "AKTIVNA"
        : "AKTIVAN"
      : zenski
        ? "NEAKTIVNA"
        : "NEAKTIVAN"}
  </span>
);

const PrazanRed = ({ colSpan, tekst }: { colSpan: number; tekst: string }) => (
  <tr>
    <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-gray-400">
      {tekst}
    </td>
  </tr>
);

function DrzaveSekcija({
  drzave,
  loading,
  ucitaj,
}: {
  drzave: Drzava[];
  loading: boolean;
  ucitaj: () => void;
}) {
  const [naziv, setNaziv] = useState("");
  const [aktivan, setAktivan] = useState(true);
  const [pretraga, setPretraga] = useState("");
  const [cuvanje, setCuvanje] = useState(false);
  const [poruka, setPoruka] = useState<{ ok: boolean; tekst: string } | null>(
    null,
  );

  const postoji = useMemo(() => {
    const n = naziv.trim().toLowerCase();
    return n !== "" && drzave.some((d) => d.naziv_drzave.toLowerCase() === n);
  }, [naziv, drzave]);

  const filtrirane = useMemo(() => {
    const p = pretraga.trim().toLowerCase();
    return p
      ? drzave.filter((d) => d.naziv_drzave.toLowerCase().includes(p))
      : drzave;
  }, [pretraga, drzave]);

  const sacuvaj = async () => {
    const n = naziv.trim();
    if (!n || postoji || cuvanje) return;
    setCuvanje(true);
    setPoruka(null);
    try {
      const res = await fetch(`${API_URL}/api/partneri/drzave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ naziv_drzave: n, aktivan: aktivan ? 1 : 0 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu države");
      }
      const nova: Drzava = json.data;
      setPoruka({
        ok: true,
        tekst: `Država "${nova.naziv_drzave}" je unesena (šifra ${nova.sifra_drzave}).`,
      });
      setNaziv("");
      setAktivan(true);
      ucitaj();
    } catch (e) {
      setPoruka({
        ok: false,
        tekst: e instanceof Error ? e.message : "Greška pri unosu države",
      });
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <div className={kartica}>
      <div
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: PRIMARY }}
      >
        <Globe size={16} />
        Države
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={labelKlasa}>
            Naziv države
          </label>
          <input
            className={inputKlasa}
            value={naziv}
            onChange={(e) => setNaziv(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sacuvaj()}
            placeholder="npr. Bosna i Hercegovina"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#c5bfd8] pb-2 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={aktivan}
            onChange={(e) => setAktivan(e.target.checked)}
          />
          Aktivna
        </label>
        <button
          onClick={sacuvaj}
          disabled={!naziv.trim() || postoji || cuvanje}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: PRIMARY }}
        >
          <Plus size={14} />
          {cuvanje ? "Čuvanje..." : "Dodaj"}
        </button>
      </div>

      {postoji && (
        <p className="text-xs text-red-500">Država sa tim nazivom već postoji.</p>
      )}
      {poruka && (
        <p
          className="text-xs"
          style={{ color: poruka.ok ? ACCENT : "#ef4444" }}
        >
          {poruka.tekst}
        </p>
      )}

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className={`${inputKlasa} pl-8`}
          value={pretraga}
          onChange={(e) => setPretraga(e.target.value)}
          placeholder="Pretraga država..."
        />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <TH right>Šifra</TH>
              <TH>Naziv države</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <PrazanRed colSpan={3} tekst="Učitavanje..." />
            ) : filtrirane.length === 0 ? (
              <PrazanRed colSpan={3} tekst="Nema država" />
            ) : (
              filtrirane.map((d) => (
                <tr
                  key={d.sifra_drzave}
                  className="border-b border-gray-200 dark:border-[#3a3158]"
                >
                  <TD right>{d.sifra_drzave}</TD>
                  <TD bold>{d.naziv_drzave}</TD>
                  <TD>
                    <StatusBadge aktivan={d.aktivan} zenski />
                  </TD>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradoviSekcija({ drzave }: { drzave: Drzava[] }) {
  const [gradovi, setGradovi] = useState<Grad[]>([]);
  const [loading, setLoading] = useState(true);
  const [naziv, setNaziv] = useState("");
  const [entitet, setEntitet] = useState("");
  const [ptt, setPtt] = useState("");
  const [sifraDrzave, setSifraDrzave] = useState<number | "">("");
  const [aktivan, setAktivan] = useState(true);
  const [pretraga, setPretraga] = useState("");
  const [filterDrzava, setFilterDrzava] = useState<number | "">("");
  // Gradovi su uvijek abecedno; "drzava" ih prvo grupiše po državi.
  const [sortiranje, setSortiranje] = useState<"naziv" | "drzava">("naziv");
  const [cuvanje, setCuvanje] = useState(false);
  const [poruka, setPoruka] = useState<{ ok: boolean; tekst: string } | null>(
    null,
  );

  const ucitaj = () => {
    setLoading(true);
    fetch(`${API_URL}/api/partneri/gradovi-pregled`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setGradovi(json.data ?? []))
      .catch(() => setGradovi([]))
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  const aktivneDrzave = useMemo(
    () => drzave.filter((d) => Number(d.aktivan) === 1),
    [drzave],
  );

  // U bazi isti entitet zna biti upisan sa razmakom ili drugačijim velikim/malim
  // slovima ("FBIH", "FBiH ") — u listi se prikazuje samo jednom.
  const entiteti = useMemo(() => {
    const jedinstveni = new Map<string, string>();
    for (const g of gradovi) {
      const e = String(g.entitet ?? "").trim();
      if (e && !jedinstveni.has(e.toUpperCase())) {
        jedinstveni.set(e.toUpperCase(), e);
      }
    }
    return Array.from(jedinstveni.values()).sort((a, b) =>
      a.localeCompare(b, "sr"),
    );
  }, [gradovi]);

  // Isti naziv grada smije postojati samo jednom unutar iste države.
  const postoji = useMemo(() => {
    const n = naziv.trim().toLowerCase();
    return (
      n !== "" &&
      sifraDrzave !== "" &&
      gradovi.some(
        (g) =>
          g.naziv_grada.toLowerCase() === n &&
          Number(g.sifra_drzave) === sifraDrzave,
      )
    );
  }, [naziv, sifraDrzave, gradovi]);

  const filtrirani = useMemo(() => {
    const p = pretraga.trim().toLowerCase();
    const poNazivu = (a: Grad, b: Grad) =>
      a.naziv_grada.localeCompare(b.naziv_grada, "sr");
    const poredak =
      sortiranje === "drzava"
        ? (a: Grad, b: Grad) =>
            String(a.naziv_drzave ?? "").localeCompare(
              String(b.naziv_drzave ?? ""),
              "sr",
            ) || poNazivu(a, b)
        : poNazivu;
    return gradovi
      .filter(
      (g) =>
        (filterDrzava === "" || Number(g.sifra_drzave) === filterDrzava) &&
        (!p ||
          g.naziv_grada.toLowerCase().includes(p) ||
          String(g.ptt ?? "").toLowerCase().includes(p) ||
          String(g.entitet ?? "").toLowerCase().includes(p)),
      )
      .sort(poredak);
  }, [pretraga, filterDrzava, gradovi, sortiranje]);

  const mozeSacuvati =
    naziv.trim() !== "" && sifraDrzave !== "" && !postoji && !cuvanje;

  const sacuvaj = async () => {
    if (!mozeSacuvati) return;
    setCuvanje(true);
    setPoruka(null);
    try {
      const res = await fetch(`${API_URL}/api/partneri/gradovi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          naziv_grada: naziv.trim(),
          entitet: entitet.trim(),
          ptt: ptt.trim(),
          sifra_drzave: sifraDrzave,
          aktivan: aktivan ? 1 : 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu grada");
      }
      const novi: Grad = json.data;
      setPoruka({
        ok: true,
        tekst: `Grad "${novi.naziv_grada}" je unesen (šifra ${novi.sifra_grada}).`,
      });
      // Država i entitet ostaju izabrani — obično se unosi više gradova zaredom.
      setNaziv("");
      setPtt("");
      setAktivan(true);
      ucitaj();
    } catch (e) {
      setPoruka({
        ok: false,
        tekst: e instanceof Error ? e.message : "Greška pri unosu grada",
      });
    } finally {
      setCuvanje(false);
    }
  };

  const naEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sacuvaj();
  };

  return (
    <div className={kartica}>
      <div
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: PRIMARY }}
      >
        <Building2 size={16} />
        Gradovi
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={labelKlasa}>Naziv grada</label>
          <input
            className={inputKlasa}
            value={naziv}
            onChange={(e) => setNaziv(e.target.value)}
            onKeyDown={naEnter}
            placeholder="npr. Banja Luka"
          />
        </div>
        <div>
          <label className={labelKlasa}>PTT</label>
          <input
            className={inputKlasa}
            value={ptt}
            onChange={(e) => setPtt(e.target.value)}
            onKeyDown={naEnter}
            placeholder="78000"
          />
        </div>
        <div>
          <label className={labelKlasa}>Entitet</label>
          <input
            className={inputKlasa}
            list="drzave-gradovi-entiteti"
            value={entitet}
            onChange={(e) => setEntitet(e.target.value)}
            onKeyDown={naEnter}
            placeholder="Republika Srpska"
          />
          <datalist id="drzave-gradovi-entiteti">
            {entiteti.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </div>
        <div className="col-span-2">
          <label className={labelKlasa}>Država</label>
          <select
            className={inputKlasa}
            value={sifraDrzave}
            onChange={(e) =>
              setSifraDrzave(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">— izaberi državu —</option>
            {aktivneDrzave.map((d) => (
              <option key={d.sifra_drzave} value={d.sifra_drzave}>
                {d.naziv_drzave}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end justify-end gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#c5bfd8] pb-2 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={aktivan}
              onChange={(e) => setAktivan(e.target.checked)}
            />
            Aktivan
          </label>
          <button
            onClick={sacuvaj}
            disabled={!mozeSacuvati}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <Plus size={14} />
            {cuvanje ? "Čuvanje..." : "Dodaj"}
          </button>
        </div>
      </div>

      {postoji && (
        <p className="text-xs text-red-500">
          Grad sa tim nazivom već postoji u izabranoj državi.
        </p>
      )}
      {poruka && (
        <p
          className="text-xs"
          style={{ color: poruka.ok ? ACCENT : "#ef4444" }}
        >
          {poruka.tekst}
        </p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className={`${inputKlasa} pl-8`}
            value={pretraga}
            onChange={(e) => setPretraga(e.target.value)}
            placeholder="Pretraga po nazivu, PTT-u, entitetu..."
          />
        </div>
        <select
          className={`${inputKlasa} w-48`}
          value={filterDrzava}
          onChange={(e) =>
            setFilterDrzava(e.target.value === "" ? "" : Number(e.target.value))
          }
        >
          <option value="">Sve države</option>
          {drzave.map((d) => (
            <option key={d.sifra_drzave} value={d.sifra_drzave}>
              {d.naziv_drzave}
            </option>
          ))}
        </select>
        <select
          className={`${inputKlasa} w-44`}
          value={sortiranje}
          onChange={(e) => setSortiranje(e.target.value as "naziv" | "drzava")}
        >
          <option value="naziv">Poredaj: abecedno</option>
          <option value="drzava">Poredaj: po državi</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <TH right>Šifra</TH>
              <TH>Naziv grada</TH>
              <TH>PTT</TH>
              <TH>Entitet</TH>
              <TH>Država</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <PrazanRed colSpan={6} tekst="Učitavanje..." />
            ) : filtrirani.length === 0 ? (
              <PrazanRed colSpan={6} tekst="Nema gradova" />
            ) : (
              filtrirani.map((g) => (
                <tr
                  key={g.sifra_grada}
                  className="border-b border-gray-200 dark:border-[#3a3158]"
                >
                  <TD right>{g.sifra_grada}</TD>
                  <TD bold>{g.naziv_grada}</TD>
                  <TD>{g.ptt ?? ""}</TD>
                  <TD>{g.entitet ?? ""}</TD>
                  <TD>{g.naziv_drzave ?? ""}</TD>
                  <TD>
                    <StatusBadge aktivan={g.aktivan} />
                  </TD>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DrzaveGradoviUnos() {
  const [drzave, setDrzave] = useState<Drzava[]>([]);
  const [loading, setLoading] = useState(true);

  const ucitajDrzave = () => {
    setLoading(true);
    fetch(`${API_URL}/api/partneri/drzave-pregled`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setDrzave(json.data ?? []))
      .catch(() => setDrzave([]))
      .finally(() => setLoading(false));
  };

  useEffect(ucitajDrzave, []);

  return (
    <div className="w-[90%] mx-auto grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-4 items-start">
      <DrzaveSekcija drzave={drzave} loading={loading} ucitaj={ucitajDrzave} />
      <GradoviSekcija drzave={drzave} />
    </div>
  );
}
