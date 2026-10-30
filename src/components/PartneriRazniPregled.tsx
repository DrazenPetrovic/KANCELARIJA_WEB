import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Pencil,
  Search,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

interface PartnerRazni {
  sifra_partnera: number;
  naziv_partnera: string;
  pripada_radniku: number | null;
  naziv_radnika: string | null;
  sifra_grada: number | null;
  naziv_grada: string | null;
  vrsta: number;
}

interface Grad {
  sifra_grada: number;
  naziv_grada: string;
}

interface Radnik {
  sifra_radnika: number;
  naziv_radnika: string;
  vrsta_radnika: number;
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6]";

const TH = ({
  children,
  width,
}: {
  children: React.ReactNode;
  width?: string;
}) => (
  <th
    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white text-left"
    style={{ background: PRIMARY, width }}
  >
    {children}
  </th>
);

type SortPolje = "sifra" | "naziv" | "grad" | "radnik";
type SmjerSortiranja = "asc" | "desc";

const SortableTH = ({
  children,
  aktivno,
  smjer,
  onClick,
  width,
}: {
  children: React.ReactNode;
  aktivno: boolean;
  smjer: SmjerSortiranja;
  onClick: () => void;
  width?: string;
}) => (
  <th
    onClick={onClick}
    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white text-left cursor-pointer select-none"
    style={{ background: PRIMARY, width }}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {aktivno ? (
        smjer === "asc" ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-50" />
      )}
    </span>
  </th>
);

const TD = ({ children }: { children: React.ReactNode }) => (
  <td className="px-3 py-2.5 whitespace-nowrap text-left text-gray-600 dark:text-[#c5bfd8]">
    {children}
  </td>
);

export function PartneriRazniPregled() {
  const [data, setData] = useState<PartnerRazni[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [radnikFilter, setRadnikFilter] = useState("");
  const [sortPolje, setSortPolje] = useState<SortPolje>("naziv");
  const [sortSmjer, setSortSmjer] = useState<SmjerSortiranja>("asc");
  const [gradovi, setGradovi] = useState<Grad[]>([]);
  const [radnici, setRadnici] = useState<Radnik[]>([]);
  const [loadingGradovi, setLoadingGradovi] = useState(false);
  const [loadingRadnici, setLoadingRadnici] = useState(false);
  const [zaIzmjenu, setZaIzmjenu] = useState<PartnerRazni | null>(null);
  const [izmjenaNaziv, setIzmjenaNaziv] = useState("");
  const [izmjenaSifraGrada, setIzmjenaSifraGrada] = useState("");
  const [izmjenaSifraRadnika, setIzmjenaSifraRadnika] = useState("");
  const [izmjenaLoading, setIzmjenaLoading] = useState(false);
  const [izmjenaGreska, setIzmjenaGreska] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/partneri/razni`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        // erp.partneri_razni_partneri_pregled vraća i prave partnere (vrsta=0) —
        // ovdje se prikazuju samo namjenski "razni" zapisi (vrsta=1).
        const lista: PartnerRazni[] = d.data ?? [];
        setData(lista.filter((p) => Number(p.vrsta) === 1));
      })
      .catch(() => {
        if (!cancelled) setError("Greška pri učitavanju raznih partnera");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const radniciOpcije = useMemo(
    () =>
      [
        ...new Set(
          data.map((p) => p.naziv_radnika).filter((n): n is string => !!n),
        ),
      ].sort((a, b) => a.localeCompare(b, "sr")),
    [data],
  );

  const filtrirani = useMemo(() => {
    const q = pretraga.toLowerCase().trim();
    const smjer = sortSmjer === "asc" ? 1 : -1;
    const tekstZaSort = (p: PartnerRazni) =>
      (sortPolje === "grad"
        ? p.naziv_grada
        : sortPolje === "radnik"
          ? p.naziv_radnika
          : p.naziv_partnera) ?? "";
    return data
      .filter(
        (p) =>
          (!radnikFilter || p.naziv_radnika === radnikFilter) &&
          (!q ||
            String(p.sifra_partnera).includes(q) ||
            p.naziv_partnera?.toLowerCase().includes(q) ||
            p.naziv_grada?.toLowerCase().includes(q) ||
            p.naziv_radnika?.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        sortPolje === "sifra"
          ? (a.sifra_partnera - b.sifra_partnera) * smjer
          : tekstZaSort(a).localeCompare(tekstZaSort(b), "sr") * smjer,
      );
  }, [data, pretraga, radnikFilter, sortPolje, sortSmjer]);

  // Isti izbor radnika kao pri unosu raznog kupca u gotovinskom računu.
  const radniciZaIzbor = useMemo(
    () =>
      radnici.filter(
        (r) => Number(r.vrsta_radnika) === 1 || Number(r.vrsta_radnika) === 2,
      ),
    [radnici],
  );

  const otvoriIzmjenu = (p: PartnerRazni) => {
    setZaIzmjenu(p);
    setIzmjenaGreska(null);
    setIzmjenaNaziv(p.naziv_partnera ?? "");
    setIzmjenaSifraGrada(p.sifra_grada != null ? String(p.sifra_grada) : "");
    setIzmjenaSifraRadnika(
      p.pripada_radniku != null ? String(p.pripada_radniku) : "",
    );
    if (gradovi.length === 0 && !loadingGradovi) {
      setLoadingGradovi(true);
      fetch(`${API_URL}/api/gradovi`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setGradovi(d.data ?? []))
        .catch(() => setGradovi([]))
        .finally(() => setLoadingGradovi(false));
    }
    if (radnici.length === 0 && !loadingRadnici) {
      setLoadingRadnici(true);
      fetch(`${API_URL}/api/radnici/pregled-sve`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setRadnici(d.data ?? []))
        .catch(() => setRadnici([]))
        .finally(() => setLoadingRadnici(false));
    }
  };

  // Trenutni grad/radnik kupca možda nije u listi za izbor (npr. neaktivan) —
  // tada se prikazuje kao dodatna opcija, da polje ne ostane prazno.
  const trenutniGradVanListe =
    zaIzmjenu?.sifra_grada != null &&
    !gradovi.some((g) => Number(g.sifra_grada) === Number(zaIzmjenu.sifra_grada));
  const trenutniRadnikVanListe =
    zaIzmjenu?.pripada_radniku != null &&
    !radniciZaIzbor.some(
      (r) => Number(r.sifra_radnika) === Number(zaIzmjenu.pripada_radniku),
    );

  const sacuvajIzmjenu = async () => {
    if (
      !zaIzmjenu ||
      !izmjenaNaziv.trim() ||
      !izmjenaSifraGrada ||
      !izmjenaSifraRadnika
    ) {
      return;
    }
    const sifraGrada = Number(izmjenaSifraGrada);
    const sifraRadnika = Number(izmjenaSifraRadnika);
    // Grad/radnik van liste za izbor mogu biti samo trenutne vrijednosti kupca.
    const nazivGrada =
      gradovi.find((g) => Number(g.sifra_grada) === sifraGrada)?.naziv_grada ??
      zaIzmjenu.naziv_grada;
    const nazivRadnika =
      radnici.find((r) => Number(r.sifra_radnika) === sifraRadnika)
        ?.naziv_radnika ?? zaIzmjenu.naziv_radnika;

    setIzmjenaLoading(true);
    setIzmjenaGreska(null);
    try {
      const res = await fetch(
        `${API_URL}/api/partneri/razni/${zaIzmjenu.sifra_partnera}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nazivPartnera: izmjenaNaziv.trim(),
            pripadaRadniku: sifraRadnika,
            sifraGrada,
            nazivGrada,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setIzmjenaGreska(json.error || "Greška pri izmjeni kupca");
        return;
      }
      setData((prev) =>
        prev.map((p) =>
          p.sifra_partnera === zaIzmjenu.sifra_partnera
            ? { ...p, ...json.data, naziv_radnika: nazivRadnika }
            : p,
        ),
      );
      setZaIzmjenu(null);
    } catch {
      setIzmjenaGreska("Greška pri izmjeni kupca");
    } finally {
      setIzmjenaLoading(false);
    }
  };

  const promijeniSortiranje = (polje: SortPolje) => {
    if (sortPolje === polje) {
      setSortSmjer((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortPolje(polje);
      setSortSmjer("asc");
    }
  };

  return (
    <div className="space-y-2 max-w-[1600px] mx-auto">
      {/* Pretraga */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              type="text"
              placeholder="Šifra, naziv, grad, radnik..."
              value={pretraga}
              onChange={(e) => setPretraga(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
            />
          </div>

          <select
            value={radnikFilter}
            onChange={(e) => setRadnikFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors text-gray-700 dark:text-[#c5bfd8] bg-white dark:bg-[#1e1a2d]"
          >
            <option value="">Svi radnici</option>
            {radniciOpcije.map((naziv) => (
              <option key={naziv} value={naziv}>
                {naziv}
              </option>
            ))}
          </select>

          {!loading && !error && (
            <span className="ml-auto text-xs text-gray-400 dark:text-[#5f5878]">
              Ukupno: {filtrirani.length} / {data.length}
            </span>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="w-fit min-w-[320px] max-w-full mx-auto bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: PRIMARY }}
            />
            <span className="text-sm text-gray-500 dark:text-[#7d7498]">
              Učitavanje...
            </span>
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
            <table className="table-auto text-sm">
              <thead>
                <tr>
                  <SortableTH
                    aktivno={sortPolje === "sifra"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("sifra")}
                  >
                    Šifra
                  </SortableTH>
                  <SortableTH
                    aktivno={sortPolje === "naziv"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("naziv")}
                  >
                    Naziv
                  </SortableTH>
                  <SortableTH
                    aktivno={sortPolje === "grad"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("grad")}
                  >
                    Grad
                  </SortableTH>
                  <SortableTH
                    aktivno={sortPolje === "radnik"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("radnik")}
                  >
                    Radnik
                  </SortableTH>
                  <TH>Akcije</TH>
                </tr>
              </thead>
              <tbody>
                {filtrirani.map((p) => (
                  <tr
                    key={p.sifra_partnera}
                    className="border-b border-gray-200 dark:border-[#3a3158]"
                  >
                    <TD>
                      <span
                        className="font-mono font-semibold text-xs"
                        style={{ color: PRIMARY }}
                      >
                        {p.sifra_partnera}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-medium text-gray-800 dark:text-[#ede9f6]">
                        {p.naziv_partnera}
                      </span>
                    </TD>
                    <TD>{p.naziv_grada || "—"}</TD>
                    <TD>{p.naziv_radnika || "—"}</TD>
                    <TD>
                      <button
                        type="button"
                        onClick={() => otvoriIzmjenu(p)}
                        title="Izmjena"
                        className="p-1 rounded-lg hover:bg-[#ede8f5] dark:hover:bg-[#312a50] transition-colors"
                        style={{ color: PRIMARY }}
                      >
                        <Pencil size={14} />
                      </button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {zaIzmjenu &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2d2648] w-[560px] max-w-[95vw] max-h-[80vh] flex flex-col overflow-hidden">
              <div
                className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <Pencil size={18} className="text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-base truncate">
                    Izmjena raznog kupca
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Šifra: {zaIzmjenu.sifra_partnera}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                    Naziv kupca
                  </label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={100}
                    value={izmjenaNaziv}
                    onChange={(e) => setIzmjenaNaziv(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                    Grad
                  </label>
                  <select
                    value={izmjenaSifraGrada}
                    onChange={(e) => setIzmjenaSifraGrada(e.target.value)}
                    disabled={loadingGradovi}
                    className={inputClass}
                  >
                    <option value="">
                      {loadingGradovi ? "Učitavanje..." : "Izaberite grad"}
                    </option>
                    {trenutniGradVanListe && (
                      <option value={zaIzmjenu.sifra_grada ?? ""}>
                        {zaIzmjenu.sifra_grada} - {zaIzmjenu.naziv_grada}
                      </option>
                    )}
                    {gradovi.map((g) => (
                      <option key={g.sifra_grada} value={g.sifra_grada}>
                        {g.sifra_grada} - {g.naziv_grada}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-[#c5bfd8] mb-1.5">
                    Radnik
                  </label>
                  <select
                    value={izmjenaSifraRadnika}
                    onChange={(e) => setIzmjenaSifraRadnika(e.target.value)}
                    disabled={loadingRadnici}
                    className={inputClass}
                  >
                    <option value="">
                      {loadingRadnici ? "Učitavanje..." : "Izaberite radnika"}
                    </option>
                    {trenutniRadnikVanListe && (
                      <option value={zaIzmjenu.pripada_radniku ?? ""}>
                        {zaIzmjenu.naziv_radnika ?? zaIzmjenu.pripada_radniku}
                      </option>
                    )}
                    {radniciZaIzbor.map((r) => (
                      <option key={r.sifra_radnika} value={r.sifra_radnika}>
                        {r.naziv_radnika}
                      </option>
                    ))}
                  </select>
                </div>
                {izmjenaGreska && (
                  <div className="text-xs font-medium text-red-500">
                    {izmjenaGreska}
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-[#2d2648] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setZaIzmjenu(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#3a3158] text-gray-600 dark:text-[#c5bfd8] bg-white dark:bg-[#261f38] hover:bg-gray-50 dark:hover:bg-[#2d2648] transition-all"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={sacuvajIzmjenu}
                  disabled={
                    izmjenaLoading ||
                    !izmjenaNaziv.trim() ||
                    !izmjenaSifraGrada ||
                    !izmjenaSifraRadnika
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  {izmjenaLoading && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
