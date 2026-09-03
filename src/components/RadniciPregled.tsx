import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Handshake,
  Loader2,
  Pencil,
  Search,
  UserCog,
  UserX,
  X,
  XCircle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface Radnik {
  radnik_id: number;
  sifra_radnika: number | null;
  naziv_radnika: string;
  lozinka: string | null;
  oznaka: string | null;
  vrsta_radnika: number;
  status_radnika: number;
  aktivan: number;
  datum_unosa: string | null;
  datum_izmjene: string | null;
}

// Šifarnik vrsta_radnika (erp.radnici) — vidi docs/radnici_vrste_radnika.txt,
// uz dodatu vrijednost 0 = Ostalo (default kolone u novoj tabeli).
const VRSTA_RADNIKA_LABELS: Record<number, string> = {
  0: "Ostalo",
  1: "Vlasnik",
  2: "Komercijala",
  3: "Kancelarija",
  4: "Proizvodnja kesa",
  5: "Proizvodnja kutija",
  6: "Magacin",
  7: "Vozač",
  10: "Spoljni saradnik",
};

// status_radnika (erp.radnici): 0 nije zaposlen, 1 zaposlen, 2 zaposleni
// spoljni saradnik, 3 spoljni saradnik koji više ne sarađuje, 4 osnivač.
const STATUS_RADNIKA_META: Record<
  number,
  { label: string; color: string; icon: React.ReactNode }
> = {
  1: { label: "Zaposlen", color: ACCENT, icon: <CheckCircle2 size={13} /> },
  0: { label: "Nije zaposlen", color: "#ef4444", icon: <XCircle size={13} /> },
  4: { label: "Osnivač", color: "#f59e0b", icon: <Crown size={13} /> },
  2: {
    label: "Zaposleni spoljni saradnik",
    color: PRIMARY,
    icon: <Handshake size={13} />,
  },
  3: {
    label: "Bivši saradnik",
    color: "#9ca3af",
    icon: <UserX size={13} />,
  },
};

const STATUS_RADNIKA_OPTIONS = [
  { value: "svi", label: "Svi statusi" },
  { value: "1", label: "Zaposleni" },
  { value: "0", label: "Nezaposleni" },
  { value: "4", label: "Osnivači" },
  { value: "2", label: "Zaposleni spoljni saradnici" },
  { value: "3", label: "Bivši saradnici" },
];

const VRSTA_RADNIKA_OPTIONS = Object.entries(VRSTA_RADNIKA_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const STATUS_RADNIKA_EDIT_OPTIONS = STATUS_RADNIKA_OPTIONS.filter(
  (o) => o.value !== "svi",
);

// aktivan se izvodi iz status_radnika pri izmjeni — isto pravilo kao u Unosu.
const AKTIVNI_STATUS_RADNIKA = new Set([1, 2, 4]);

const formatDatum = (v: string | null) => {
  if (!v) return "–";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("sr-Latn-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const TH = ({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) => (
  <th
    className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap bg-[#f4f1f9] dark:bg-[#2a2340] ${center ? "text-center" : "text-left"}`}
    style={{ color: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) => (
  <td
    className={`px-4 py-2.5 text-sm whitespace-nowrap border-b border-gray-100 dark:border-[#2d2648] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
  >
    {children}
  </td>
);

export function RadniciPregled() {
  const [data, setData] = useState<Radnik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [vrstaFilter, setVrstaFilter] = useState("sve");
  const [statusFilter, setStatusFilter] = useState("1");
  const [otkrivenaLozinka, setOtkrivenaLozinka] = useState<number | null>(
    null,
  );

  const [urediRadnika, setUrediRadnika] = useState<Radnik | null>(null);
  const [formNaziv, setFormNaziv] = useState("");
  const [formLozinka, setFormLozinka] = useState("");
  const [formOznaka, setFormOznaka] = useState("");
  const [formVrsta, setFormVrsta] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [spasavanje, setSpasavanje] = useState(false);
  const [spasavanjeGreska, setSpasavanjeGreska] = useState<string | null>(
    null,
  );

  const otvoriIzmjenu = (r: Radnik) => {
    setUrediRadnika(r);
    setFormNaziv(r.naziv_radnika ?? "");
    setFormLozinka(r.lozinka ?? "");
    setFormOznaka(r.oznaka ?? "");
    setFormVrsta(String(r.vrsta_radnika));
    setFormStatus(String(r.status_radnika));
  };

  const zatvoriIzmjenu = () => {
    setUrediRadnika(null);
    setSpasavanjeGreska(null);
  };

  const sacuvajIzmjenu = async () => {
    if (!urediRadnika) return;
    const statusRadnika = Number(formStatus);
    const izmjene = {
      radnik_id: urediRadnika.radnik_id,
      sifra_radnika: urediRadnika.sifra_radnika,
      naziv_radnika: formNaziv,
      lozinka: formLozinka,
      oznaka: formOznaka,
      vrsta_radnika: Number(formVrsta),
      status_radnika: statusRadnika,
      aktivan: AKTIVNI_STATUS_RADNIKA.has(statusRadnika) ? 1 : 0,
    };

    setSpasavanje(true);
    setSpasavanjeGreska(null);
    try {
      const res = await fetch(`${API_URL}/api/radnici/azuriraj`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(izmjene),
      });
      const json = await res.json();
      if (!res.ok || !json.azurirano) {
        throw new Error(json.error || "Radnik nije ažuriran");
      }

      setData((prev) =>
        prev.map((r) =>
          r.radnik_id === izmjene.radnik_id ? { ...r, ...izmjene } : r,
        ),
      );
      zatvoriIzmjenu();
    } catch (err) {
      setSpasavanjeGreska(
        err instanceof Error ? err.message : "Radnik nije ažuriran",
      );
    } finally {
      setSpasavanje(false);
    }
  };

  useEffect(() => {
    const ucitaj = async () => {
      try {
        const res = await fetch(`${API_URL}/api/radnici/pregled-sve`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Greška pri učitavanju radnika");
        const json = await res.json();
        setData(json.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepoznata greška");
      } finally {
        setLoading(false);
      }
    };
    void ucitaj();
  }, []);

  const vrsteZaFilter = useMemo(() => {
    const prisutne = new Set(data.map((r) => r.vrsta_radnika));
    return Array.from(prisutne)
      .sort((a, b) => a - b)
      .map((v) => ({ value: String(v), label: VRSTA_RADNIKA_LABELS[v] ?? `Vrsta ${v}` }));
  }, [data]);

  const filtrirani = useMemo(() => {
    return data.filter((r) => {
      const matchVrsta =
        vrstaFilter === "sve" || String(r.vrsta_radnika) === vrstaFilter;
      const matchStatus =
        statusFilter === "svi" || String(r.status_radnika) === statusFilter;

      if (!matchVrsta || !matchStatus) return false;
      if (!pretraga.trim()) return true;

      const q = pretraga.toLowerCase();
      return (
        r.naziv_radnika?.toLowerCase().includes(q) ||
        r.oznaka?.toLowerCase().includes(q) ||
        String(r.sifra_radnika ?? "").includes(q)
      );
    });
  }, [data, pretraga, vrstaFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <UserCog size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
              Pregled radnika
            </h2>
            {!loading && !error && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Ukupno: {filtrirani.length} / {data.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv, oznaka..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={vrstaFilter}
            onChange={(e) => setVrstaFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            <option value="sve">Sve vrste</option>
            {vrsteZaFilter.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            {STATUS_RADNIKA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 size={22} className="animate-spin" style={{ color: PRIMARY }} />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">Učitavanje...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && filtrirani.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400 dark:text-[#5f5878]">
              Nema podataka za prikaz.
            </p>
          </div>
        )}

        {!loading && !error && filtrirani.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <TH>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH>Oznaka</TH>
                  <TH>Vrsta radnika</TH>
                  <TH center>Status</TH>
                  <TH center>Aktivan</TH>
                  <TH center>Lozinka</TH>
                  <TH>Datum unosa</TH>
                  <TH>Datum izmjene</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r) => {
                  const status = STATUS_RADNIKA_META[r.status_radnika] ?? {
                    label: `Nepoznato (${r.status_radnika})`,
                    color: "#9ca3af",
                    icon: null,
                  };
                  const otkriveno = otkrivenaLozinka === r.radnik_id;
                  return (
                    <tr
                      key={r.radnik_id}
                      className="hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
                    >
                      <TD>
                        <span
                          className="font-mono font-semibold text-xs"
                          style={{ color: PRIMARY }}
                        >
                          {r.sifra_radnika ?? "–"}
                        </span>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{r.naziv_radnika}</span>
                          <button
                            type="button"
                            onClick={() => otvoriIzmjenu(r)}
                            title="Izmijeni radnika"
                            className="text-gray-400 dark:text-[#5f5878] hover:opacity-70"
                            style={{ color: PRIMARY }}
                          >
                            <Pencil size={13} />
                          </button>
                        </span>
                      </TD>
                      <TD>{r.oznaka || "–"}</TD>
                      <TD>
                        {VRSTA_RADNIKA_LABELS[r.vrsta_radnika] ??
                          `Vrsta ${r.vrsta_radnika}`}
                      </TD>
                      <TD center>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color: status.color }}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </TD>
                      <TD center>
                        {r.aktivan === 1 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold"
                            style={{ color: ACCENT }}
                          >
                            <CheckCircle2 size={13} />
                            Da
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-[#5f5878]">
                            <XCircle size={13} />
                            Ne
                          </span>
                        )}
                      </TD>
                      <TD center>
                        <button
                          type="button"
                          onClick={() =>
                            setOtkrivenaLozinka((prev) =>
                              prev === r.radnik_id ? null : r.radnik_id,
                            )
                          }
                          title={otkriveno ? "Sakrij lozinku" : "Prikaži lozinku"}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-[#a99fc2] hover:opacity-80"
                        >
                          {otkriveno ? (
                            <>
                              {r.lozinka || "–"}
                              <EyeOff size={13} />
                            </>
                          ) : (
                            <>
                              ••••••
                              <Eye size={13} />
                            </>
                          )}
                        </button>
                      </TD>
                      <TD>{formatDatum(r.datum_unosa)}</TD>
                      <TD>{formatDatum(r.datum_izmjene)}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL - IZMJENA RADNIKA */}
      {urediRadnika && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) zatvoriIzmjenu();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2"
            style={{ borderColor: ACCENT }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: PRIMARY }}
            >
              <div>
                <h3 className="text-base font-bold text-white">
                  Izmjena radnika
                </h3>
                <p className="text-xs text-white/70">
                  {urediRadnika.naziv_radnika} (#{urediRadnika.radnik_id}
                  {urediRadnika.sifra_radnika != null
                    ? `, šifra ${urediRadnika.sifra_radnika}`
                    : ""}
                  )
                </p>
              </div>
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
                  Naziv
                </label>
                <input
                  type="text"
                  value={formNaziv}
                  onChange={(e) => setFormNaziv(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
                  Lozinka
                </label>
                <input
                  type="text"
                  value={formLozinka}
                  onChange={(e) => setFormLozinka(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
                  Oznaka (125kHz kartica)
                </label>
                <input
                  type="text"
                  value={formOznaka}
                  onChange={(e) => setFormOznaka(e.target.value)}
                  autoFocus
                  placeholder="Prislonite karticu na čitač ili unesite ručno"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
                  Vrsta radnika
                </label>
                <select
                  value={formVrsta}
                  onChange={(e) => setFormVrsta(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
                >
                  {VRSTA_RADNIKA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#a99fc2] mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
                >
                  {STATUS_RADNIKA_EDIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-5 pt-2 pb-0 flex items-center justify-end gap-2">
              {spasavanjeGreska && (
                <p className="text-xs text-red-500 dark:text-red-400 mr-auto">
                  {spasavanjeGreska}
                </p>
              )}
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-[#2d2648]">
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                disabled={spasavanje}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#312a50] transition-colors disabled:opacity-50"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={sacuvajIzmjenu}
                disabled={spasavanje}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: PRIMARY }}
              >
                {spasavanje && <Loader2 size={14} className="animate-spin" />}
                {spasavanje ? "Čuvanje..." : "Izmijeni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
