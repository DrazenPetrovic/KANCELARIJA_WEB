import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  IdCard,
  Loader2,
  Phone,
  Search,
  Users,
  XCircle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface Partner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
  jib: string | null;
  pib: string | null;
  pdv_obveznik: number;
  tip_partnera: string;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string | null;
  valuta_placanja: number | null;
  limit_duga: number | null;
  rabat_procenat: number | null;
  aktivan: number;
  telefon: string | null;
  broj_poslovnica: number;
  broj_kontakata: number;
  broj_telefona: number;
}

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

function Brojac({
  icon,
  vrijednost,
  title,
}: {
  icon: React.ReactNode;
  vrijednost: number;
  title: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        vrijednost > 0
          ? "text-gray-600 dark:text-[#c5bfd8]"
          : "text-gray-300 dark:text-[#4a4360]"
      }`}
    >
      {icon}
      {vrijednost}
    </span>
  );
}

const TIP_OPTIONS = [
  { value: "svi", label: "Svi tipovi" },
  { value: "kupac", label: "Kupac" },
  { value: "dobavljac", label: "Dobavljač" },
];

const STATUS_OPTIONS = [
  { value: "svi", label: "Svi statusi" },
  { value: "aktivni", label: "Aktivni" },
  { value: "neaktivni", label: "Neaktivni" },
];

export function PartneriPregled() {
  const [data, setData] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [tipFilter, setTipFilter] = useState("svi");
  const [statusFilter, setStatusFilter] = useState("svi");

  useEffect(() => {
    const ucitaj = async () => {
      try {
        const res = await fetch(`${API_URL}/api/partneri/lista-sve`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Greška pri učitavanju partnera");
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

  const filtrirani = useMemo(() => {
    return data.filter((p) => {
      const matchTip = tipFilter === "svi" || p.tip_partnera === tipFilter;
      const matchStatus =
        statusFilter === "svi" ||
        (statusFilter === "aktivni" ? p.aktivan === 1 : p.aktivan !== 1);

      if (!matchTip || !matchStatus) return false;
      if (!pretraga.trim()) return true;

      const q = pretraga.toLowerCase();
      return (
        p.naziv?.toLowerCase().includes(q) ||
        p.skraceni_naziv?.toLowerCase().includes(q) ||
        String(p.partner_id).includes(q) ||
        p.adresa?.toLowerCase().includes(q) ||
        p.grad?.toLowerCase().includes(q) ||
        p.drzava?.toLowerCase().includes(q) ||
        p.jib?.toLowerCase().includes(q) ||
        p.pib?.toLowerCase().includes(q) ||
        p.telefon?.toLowerCase().includes(q)
      );
    });
  }, [data, pretraga, tipFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5] dark:bg-[#312a50]">
            <Users size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
              Pregled partnera
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
              placeholder="Šifra, naziv, adresa, grad, JIB/PIB, telefon..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={tipFilter}
            onChange={(e) => setTipFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            {TIP_OPTIONS.map((o) => (
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
            {STATUS_OPTIONS.map((o) => (
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
                  <TH>JIB / PIB</TH>
                  <TH>Adresa</TH>
                  <TH>Telefon</TH>
                  <TH center>Valuta</TH>
                  <TH center>Limit duga</TH>
                  <TH center>Rabat</TH>
                  <TH center>Poslovnice / Kontakti / Telefoni</TH>
                  <TH center>Status</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((p) => (
                  <tr
                    key={p.partner_id}
                    className="hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
                  >
                    <TD>
                      <span className="font-mono font-semibold text-xs" style={{ color: PRIMARY }}>
                        {p.partner_id}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-medium">
                        {p.naziv}
                        <span className="font-normal text-gray-400 dark:text-[#5f5878]">
                          {" "}
                          ({p.tip_partnera === "kupac" ? "Kupac" : "Dobavljač"})
                        </span>
                      </span>
                      {p.skraceni_naziv && (
                        <span className="block text-xs text-gray-400 dark:text-[#5f5878]">
                          {p.skraceni_naziv}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-col items-end leading-tight">
                        <span>{p.jib || "–"}</span>
                        <span>{p.pib || "–"}</span>
                      </div>
                    </TD>
                    <TD>
                      <span className="block">{p.adresa || "–"}</span>
                      <span className="block text-xs text-gray-400 dark:text-[#5f5878]">
                        {[p.grad, p.drzava].filter(Boolean).join(", ")}
                      </span>
                    </TD>
                    <TD>
                      {p.telefon ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={12} style={{ color: PRIMARY }} />
                          {p.telefon}
                        </span>
                      ) : (
                        "–"
                      )}
                    </TD>
                    <TD center>
                      {p.valuta_placanja != null ? `${p.valuta_placanja} d.` : "–"}
                    </TD>
                    <TD center>
                      {p.limit_duga != null ? `${p.limit_duga} KM` : "–"}
                    </TD>
                    <TD center>
                      {p.rabat_procenat != null ? `${p.rabat_procenat}%` : "–"}
                    </TD>
                    <TD center>
                      <div className="flex items-center justify-center gap-3">
                        <Brojac
                          icon={<Building2 size={12} />}
                          vrijednost={p.broj_poslovnica}
                          title="Poslovnice"
                        />
                        <Brojac
                          icon={<IdCard size={12} />}
                          vrijednost={p.broj_kontakata}
                          title="Kontakti"
                        />
                        <Brojac
                          icon={<Phone size={12} />}
                          vrijednost={p.broj_telefona}
                          title="Telefoni"
                        />
                      </div>
                    </TD>
                    <TD center>
                      {p.aktivan === 1 ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color: ACCENT }}
                        >
                          <CheckCircle2 size={13} />
                          Aktivan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400">
                          <XCircle size={13} />
                          Neaktivan
                        </span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
