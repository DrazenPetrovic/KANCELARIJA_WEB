import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, FilePlus, Loader2 } from "lucide-react";
import { useBaza } from "../context/BazaContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

interface FormData {
  naziv_klisea: string;
  lokacija_partnera: string;
  dimenzija_za_stampu: string;
  povrsina_klisea: string;
  cijena_klisea: string;
  napomena: string;
}

interface KliseRow {
  sifra: string;
  naziv_klisea: string;
  lokacija_partnera: string;
  dimenzija_za_stampu: string;
  povrsina_klisea: string;
  cijena_klisea: string;
  napomena: string;
  primljen_u_proizvodnju: number;
}

const EMPTY: FormData = {
  naziv_klisea: "",
  lokacija_partnera: "",
  dimenzija_za_stampu: "",
  povrsina_klisea: "",
  cijena_klisea: "",
  napomena: "",
};

function izracunajPovrsinu(dimenzija: string): string {
  const match = dimenzija.trim().match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return "";
  const sirina = parseFloat(match[1].replace(",", ".")) / 100;
  const visina = parseFloat(match[2].replace(",", ".")) / 100;
  return ((sirina + 0.2) * (visina + 0.2)).toFixed(3);
}

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
    {children}
    {required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#785E9E] focus:ring-1 focus:ring-[#785E9E]/20 transition-all text-gray-800 placeholder:text-gray-300";

export function KliseUnosNovog() {
  const { isArhiva } = useBaza();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [lista, setLista] = useState<KliseRow[]>([]);
  const [listaLoading, setListaLoading] = useState(true);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  useEffect(() => {
    const povrsina = izracunajPovrsinu(form.dimenzija_za_stampu);
    const cijena = povrsina !== "" ? (parseFloat(povrsina) * 11.7).toFixed(3) : "";
    setForm((prev) => ({ ...prev, povrsina_klisea: povrsina, cijena_klisea: cijena }));
  }, [form.dimenzija_za_stampu]);

  // Učitaj kliše sa statusom 0
  useEffect(() => {
    const fetchLista = async () => {
      setListaLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/klise/klise-pregled`, {
          credentials: "include",
        });
        const json = await res.json();
        const samo0 = (json.data || []).filter(
          (k: KliseRow) => k.primljen_u_proizvodnju === 0,
        );
        setLista(samo0);
      } catch {
        // tiho — lista nije kritična
      } finally {
        setListaLoading(false);
      }
    };
    fetchLista();
  }, [refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`${API_URL}/api/klise/klise-unos-novi`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Greška pri unosu");
        return;
      }

      setSuccess(true);
      setForm(EMPTY);
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Greška pri povezivanju sa serverom");
    } finally {
      setSubmitting(false);
    }
  };

  const povrsinaIzracunata = form.povrsina_klisea !== "";

  return (
    <div className="space-y-6">
      {/* Naslov — izvan flex reda */}
      <div className="flex items-center gap-3 justify-center">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#ede8f5" }}
        >
          <FilePlus size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Unos novog kliša</h2>
      </div>

      {/* Forma + Lista u istom redu */}
      <div className="flex gap-6 items-start justify-center">
        <div className="w-full max-w-xl">
        {/* Forma */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
        >
        <div>
          <Label required>Naziv kliša</Label>
          <input
            type="text"
            className={inputClass}
            placeholder="npr. Kliše za ambalažu A3"
            value={form.naziv_klisea}
            onChange={set("naziv_klisea")}
            maxLength={254}
            required
          />
        </div>

        <div>
          <Label required>Lokacija partnera</Label>
          <input
            type="text"
            className={inputClass}
            placeholder="npr. Sarajevo"
            value={form.lokacija_partnera}
            onChange={set("lokacija_partnera")}
            maxLength={100}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Dimenzija za štampu (mm)</Label>
            <input
              type="text"
              className={inputClass}
              placeholder="npr. 125x585"
              value={form.dimenzija_za_stampu}
              onChange={set("dimenzija_za_stampu")}
              maxLength={50}
              required
            />
          </div>
          <div>
            <Label required>Površina kliša (dm²)</Label>
            <input
              type="text"
              className={`${inputClass} ${
                povrsinaIzracunata
                  ? "bg-purple-50 border-[#785E9E]/30 text-[#785E9E] font-semibold"
                  : "bg-gray-50 text-gray-400"
              } cursor-default`}
              value={povrsinaIzracunata ? `${form.povrsina_klisea} dm²` : "Unesite dimenziju..."}
              readOnly
            />
          </div>
        </div>

        <div>
          <Label required>Cijena kliša (KM)</Label>
          <input
            type="text"
            className={`${inputClass} ${
              form.cijena_klisea !== ""
                ? "bg-purple-50 border-[#785E9E]/30 text-[#785E9E] font-semibold"
                : "bg-gray-50 text-gray-400"
            } cursor-default`}
            value={form.cijena_klisea !== "" ? `${form.cijena_klisea} KM` : "Unesite dimenziju..."}
            readOnly
          />
        </div>

        <div>
          <Label>Napomena</Label>
          <textarea
            className={`${inputClass} resize-none`}
            placeholder="Opcionalna napomena..."
            rows={3}
            value={form.napomena}
            onChange={set("napomena")}
            maxLength={254}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-xl">
            <CheckCircle2 size={15} />
            Kliše uspješno dodat!
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={submitting || isArhiva}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: PRIMARY }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <FilePlus size={15} />}
            {submitting ? "Snimanje..." : "Dodaj kliše"}
          </button>
        </div>
        </form>
      </div>

      {/* Desna kolona — lista naručenih */}
      <div className="w-96 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="flex items-center gap-2 px-5 py-3 border-b border-gray-100"
          style={{ background: "#f4f1f9" }}
        >
          <ClipboardList size={14} style={{ color: PRIMARY }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
            Naručeni kliši
          </span>
          {!listaLoading && (
            <span className="ml-auto text-xs text-gray-400">{lista.length} zapis{lista.length === 1 ? "" : "a"}</span>
          )}
        </div>

        {listaLoading && (
          <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 size={18} className="animate-spin" style={{ color: PRIMARY }} />
            <span className="text-sm text-gray-400">Učitavanje...</span>
          </div>
        )}

        {!listaLoading && lista.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Nema naručenih kliša.</p>
        )}

        {!listaLoading && lista.length > 0 && (
          <div className="divide-y divide-gray-100">
            {lista.map((k) => (
              <div key={k.sifra} className="px-5 py-3 hover:bg-purple-50/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-semibold" style={{ color: PRIMARY }}>
                        {k.sifra}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {k.naziv_klisea}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span>{k.lokacija_partnera}</span>
                      <span>{k.dimenzija_za_stampu}</span>
                      <span>{k.povrsina_klisea}</span>
                      <span>{k.cijena_klisea}</span>
                    </div>
                    {k.napomena && k.napomena !== "-" && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{k.napomena}</p>
                    )}
                  </div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0"
                    style={{ background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }}
                  >
                    <ClipboardList size={11} />
                    Naručen
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
