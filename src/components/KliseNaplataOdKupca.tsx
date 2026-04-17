import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Wallet } from "lucide-react";
import { useBaza } from "../context/BazaContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

interface KliseRow {
  sifra: string;
  naziv_klisea: string;
  lokacija_partnera: string;
  dimenzija_za_stampu: string;
  povrsina_klisea: string;
  cijena_klisea: string;
  datum_narcucivanja: string;
  napomena: string;
  primljen_u_proizvodnju: number;
}

function formatDatum(datum: string | null | undefined): string {
  if (!datum) return "-";
  const d = datum.substring(0, 10);
  const parts = d.split("-");
  if (parts.length !== 3) return datum;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDecimal(val: string | null | undefined, suffix = ""): string {
  if (!val) return "-";
  const num = parseFloat(val);
  if (isNaN(num)) return "-";
  return `${num.toFixed(3)}${suffix ? " " + suffix : ""}`;
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 transition-all text-gray-800 placeholder:text-gray-300";

export function KliseNaplataOdKupca() {
  const { isArhiva } = useBaza();
  const [lista, setLista] = useState<KliseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KliseRow | null>(null);
  const [iznos, setIznos] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchLista = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/klise/klise-pregled`, {
          credentials: "include",
        });
        const json = await res.json();
        const status1 = (json.data || []).filter(
          (k: KliseRow) => k.primljen_u_proizvodnju === 1,
        );
        setLista(status1);
      } catch {
        // tiho
      } finally {
        setLoading(false);
      }
    };
    fetchLista();
  }, [refreshKey]);

  const handleSelect = (k: KliseRow) => {
    setSelected(k);
    setIznos("");
    setSuccess(false);
    setError(null);
  };

  const handleCancel = () => {
    setSelected(null);
    setIznos("");
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(
        `${API_URL}/api/klise/klise-unos-placanja-kupac`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sifra: selected.sifra,
            ukupno_naplaceno: iznos,
          }),
        },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Greška pri unosu");
        return;
      }

      setSuccess(true);
      setIznos("");
      setSelected(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Greška pri povezivanju sa serverom");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Naslov */}
      <div className="flex items-center gap-3 justify-center">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#ede8f5" }}
        >
          <CreditCard size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">
          Naplata klišea od kupca
        </h2>
      </div>

      <div className="flex gap-6 items-start">
        {/* Lijeva kolona — lista klišea sa statusom 1 */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-3 border-b border-gray-100"
            style={{ background: "#f4f1f9" }}
          >
            <Wallet size={14} style={{ color: PRIMARY }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Klišea u proizvodnji
            </span>
            {!loading && (
              <span className="ml-auto text-xs text-gray-400">
                {lista.length} zapis{lista.length === 1 ? "" : "a"}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: PRIMARY }}
              />
              <span className="text-sm text-gray-400">Učitavanje...</span>
            </div>
          )}

          {!loading && lista.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">
              Nema klišea u statusu "U proizvodnji".
            </p>
          )}

          {!loading && lista.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs font-semibold text-white uppercase tracking-wider"
                    style={{ background: PRIMARY }}
                  >
                    <th className="px-4 py-3 text-left">Šifra</th>
                    <th className="px-4 py-3 text-left">Naziv klišea</th>
                    <th className="px-4 py-3 text-left">Lokacija</th>
                    <th className="px-4 py-3 text-left">Dimenzija</th>
                    <th className="px-4 py-3 text-right">Površina</th>
                    <th className="px-4 py-3 text-right">Cijena</th>
                    <th className="px-4 py-3 text-left">Datum naručivanja</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((k, idx) => {
                    const isSelected = selected?.sifra === k.sifra;
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={k.sifra}
                        onClick={() => handleSelect(k)}
                        className={`cursor-pointer transition-colors border-b border-gray-100 ${
                          isSelected
                            ? "bg-purple-100"
                            : isEven
                              ? "bg-purple-50/40 hover:bg-purple-100/60"
                              : "bg-white hover:bg-purple-50/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-xs font-semibold"
                            style={{ color: PRIMARY }}
                          >
                            {k.sifra}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {k.naziv_klisea}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {k.lokacija_partnera}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {k.dimenzija_za_stampu}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatDecimal(k.povrsina_klisea, "m²")}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatDecimal(k.cijena_klisea, "KM")}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatDatum(k.datum_narcucivanja)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Desna kolona — forma za unos naplate */}
        <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-3 border-b border-gray-100"
            style={{ background: "#f4f1f9" }}
          >
            <CreditCard size={14} style={{ color: PRIMARY }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Unos naplate
            </span>
          </div>

          {!selected && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                style={{ background: "#ede8f5" }}
              >
                <CreditCard size={18} style={{ color: PRIMARY }} />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                Odaberite kliš
              </p>
              <p className="text-xs text-gray-400">
                Kliknite na red u tabeli da biste unijeli naplatu.
              </p>
            </div>
          )}

          {selected && (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Info o odabranom klišu */}
              <div className="bg-purple-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: PRIMARY }}
                  >
                    {selected.sifra}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {selected.naziv_klisea}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>{selected.lokacija_partnera}</div>
                  <div className="flex flex-wrap gap-3">
                    <span>{selected.dimenzija_za_stampu}</span>
                    <span>{formatDecimal(selected.povrsina_klisea, "m²")}</span>
                    <span>{formatDecimal(selected.cijena_klisea, "KM")}</span>
                  </div>
                  <div>{formatDatum(selected.datum_narcucivanja)}</div>
                </div>
              </div>

              {/* Iznos naplate */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Naplaćeno od kupca (KM){" "}
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={inputClass}
                  placeholder="npr. 145.500"
                  value={iznos}
                  onChange={(e) => setIznos(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-xl">
                  <CheckCircle2 size={15} />
                  Naplata uspješno unesena!
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={submitting || isArhiva}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
                  style={{ background: PRIMARY }}
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CreditCard size={15} />
                  )}
                  {submitting ? "Snimanje..." : "Snimi"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
