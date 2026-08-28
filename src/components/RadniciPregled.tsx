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
  sifra_radnika: number;
  Naziv_radnika: string;
  Lozinka: string | null;
  Oznaka: string | null;
  vrsta_radnika: number;
  prvi_prag: string | number | null;
  drugi_prag: string | number | null;
  zaposlenik: number;
}

// Vidi docs/radnici_vrste_radnika.txt — šifarnik vrsta_radnika iz erp.radnici_pregled.
const VRSTA_RADNIKA_LABELS: Record<number, string> = {
  1: "Vlasnik",
  2: "Komercijala",
  3: "Kancelarija",
  4: "Proizvodnja kesa",
  5: "Proizvodnja kutija",
  6: "Magacin",
  7: "Vozač",
  10: "Spoljni saradnik",
};

// zaposlenik: 1 = zaposlen, 0 = nije zaposlen, -1 = osnivač (specijalna oznaka),
// 2 = spoljni saradnik koji trenutno sarađuje, 3 = spoljni saradnik koji više ne sarađuje.
const ZAPOSLENIK_META: Record<
  number,
  { label: string; color: string; icon: React.ReactNode }
> = {
  1: { label: "Zaposlen", color: ACCENT, icon: <CheckCircle2 size={13} /> },
  0: { label: "Nije zaposlen", color: "#ef4444", icon: <XCircle size={13} /> },
  [-1]: { label: "Osnivač", color: "#f59e0b", icon: <Crown size={13} /> },
  2: {
    label: "Spoljni saradnik",
    color: PRIMARY,
    icon: <Handshake size={13} />,
  },
  3: {
    label: "Bivši saradnik",
    color: "#9ca3af",
    icon: <UserX size={13} />,
  },
};

const ZAPOSLENIK_OPTIONS = [
  { value: "svi", label: "Svi statusi" },
  { value: "1", label: "Zaposleni" },
  { value: "0", label: "Nezaposleni" },
  { value: "-1", label: "Osnivači" },
  { value: "2", label: "Spoljni saradnici" },
  { value: "3", label: "Bivši saradnici" },
];

const VRSTA_RADNIKA_OPTIONS = Object.entries(VRSTA_RADNIKA_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const ZAPOSLENIK_EDIT_OPTIONS = ZAPOSLENIK_OPTIONS.filter(
  (o) => o.value !== "svi",
);

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
  const [formZaposlenik, setFormZaposlenik] = useState("");
  const [spasavanje, setSpasavanje] = useState(false);
  const [spasavanjeGreska, setSpasavanjeGreska] = useState<string | null>(
    null,
  );

  const otvoriIzmjenu = (r: Radnik) => {
    setUrediRadnika(r);
    setFormNaziv(r.Naziv_radnika ?? "");
    setFormLozinka(r.Lozinka ?? "");
    setFormOznaka(r.Oznaka ?? "");
    setFormVrsta(String(r.vrsta_radnika));
    setFormZaposlenik(String(r.zaposlenik));
  };

  const zatvoriIzmjenu = () => {
    setUrediRadnika(null);
    setSpasavanjeGreska(null);
  };

  const sacuvajIzmjenu = async () => {
    if (!urediRadnika) return;
    const izmjene = {
      sifra_radnika: urediRadnika.sifra_radnika,
      Naziv_radnika: formNaziv,
      Lozinka: formLozinka,
      Oznaka: formOznaka,
      vrsta_radnika: Number(formVrsta),
      zaposlenik: Number(formZaposlenik),
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
          r.sifra_radnika === izmjene.sifra_radnika ? { ...r, ...izmjene } : r,
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
        statusFilter === "svi" || String(r.zaposlenik) === statusFilter;

      if (!matchVrsta || !matchStatus) return false;
      if (!pretraga.trim()) return true;

      const q = pretraga.toLowerCase();
      return (
        r.Naziv_radnika?.toLowerCase().includes(q) ||
        r.Oznaka?.toLowerCase().includes(q) ||
        String(r.sifra_radnika).includes(q)
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
            {ZAPOSLENIK_OPTIONS.map((o) => (
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
                  <TH center>Prag 1</TH>
                  <TH center>Prag 2</TH>
                  <TH center>Status</TH>
                  <TH center>Lozinka</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((r) => {
                  const status = ZAPOSLENIK_META[r.zaposlenik] ?? {
                    label: `Nepoznato (${r.zaposlenik})`,
                    color: "#9ca3af",
                    icon: null,
                  };
                  const otkriveno = otkrivenaLozinka === r.sifra_radnika;
                  return (
                    <tr
                      key={r.sifra_radnika}
                      className="hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
                    >
                      <TD>
                        <span
                          className="font-mono font-semibold text-xs"
                          style={{ color: PRIMARY }}
                        >
                          {r.sifra_radnika}
                        </span>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{r.Naziv_radnika}</span>
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
                      <TD>{r.Oznaka || "–"}</TD>
                      <TD>
                        {VRSTA_RADNIKA_LABELS[r.vrsta_radnika] ??
                          `Vrsta ${r.vrsta_radnika}`}
                      </TD>
                      <TD center>{r.prvi_prag ?? "–"}</TD>
                      <TD center>{r.drugi_prag ?? "–"}</TD>
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
                        <button
                          type="button"
                          onClick={() =>
                            setOtkrivenaLozinka((prev) =>
                              prev === r.sifra_radnika ? null : r.sifra_radnika,
                            )
                          }
                          title={otkriveno ? "Sakrij lozinku" : "Prikaži lozinku"}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-[#a99fc2] hover:opacity-80"
                        >
                          {otkriveno ? (
                            <>
                              {r.Lozinka || "–"}
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
                  {urediRadnika.Naziv_radnika} (#{urediRadnika.sifra_radnika})
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
                  value={formZaposlenik}
                  onChange={(e) => setFormZaposlenik(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
                >
                  {ZAPOSLENIK_EDIT_OPTIONS.map((o) => (
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
