import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";


interface Drzava {
  sifra_drzave: number;
  naziv_drzave: string;
}

interface GradOpcija {
  sifra_grada: number;
  naziv_grada: string;
  entitet: string;
  ptt: string;
  sifra_drzave: number;
}

interface Komercijalista {
  sifra_radnika: number;
  naziv_radnika: string;
}

interface PostojeciPartner {
  partner_id: number;
  naziv: string;
  skraceni_naziv: string | null;
  jib: string | null;
  adresa: string | null;
  grad: string | null;
  telefon: string | null;
  aktivan: number;
}

interface PoslovnicaUnos {
  sifra: string;
  naziv: string;
  glavna: boolean;
  jib: string;
  adresa: string;
  sifraDrzave: string;
  sifraGrada: string;
}

interface KontaktUnos {
  ime: string;
  prezime: string;
  funkcija: string;
  poslovnicaSifra: string;
}

interface TelefonUnos {
  broj: string;
  tip: string;
  primarni: boolean;
  poslovnicaSifra: string;
  kontaktIndex: string;
}

const praznaPoslovnica = (): PoslovnicaUnos => ({
  sifra: "",
  naziv: "",
  glavna: false,
  jib: "",
  adresa: "",
  sifraDrzave: "",
  sifraGrada: "",
});

const prazanKontakt = (): KontaktUnos => ({
  ime: "",
  prezime: "",
  funkcija: "",
  poslovnicaSifra: "",
});

const prazanTelefon = (): TelefonUnos => ({
  broj: "",
  tip: "",
  primarni: false,
  poslovnicaSifra: "",
  kontaktIndex: "",
});

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-[#3a3158] rounded-xl focus:outline-none focus:border-[#785E9E] bg-white dark:bg-[#1c1828] text-gray-800 dark:text-[#ede9f6]";
const labelClass =
  "block text-xs font-semibold text-gray-600 dark:text-[#a89fc2] mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  onAdd,
  addLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: PRIMARY }}
          >
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
          style={{ background: "#ede8f5", color: PRIMARY }}
        >
          <Plus size={13} />
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

export function PartneriUnos({ username }: { username: string }) {
  const [naziv, setNaziv] = useState("");
  const [jib, setJib] = useState("");
  const [pib, setPib] = useState("");
  const [pdvObveznik, setPdvObveznik] = useState(false);
  const [tipPartnera, setTipPartnera] = useState("kupac");
  const [adresa, setAdresa] = useState("");
  const [sifraDrzave, setSifraDrzave] = useState("");
  const [sifraGrada, setSifraGrada] = useState("");
  const [postanskiBroj, setPostanskiBroj] = useState("");
  const [valutaPlacanja, setValutaPlacanja] = useState("");
  const [rabatProcenat, setRabatProcenat] = useState("");
  const [sifraKomercijaliste, setSifraKomercijaliste] = useState("");

  const [poslovnice, setPoslovnice] = useState<PoslovnicaUnos[]>([]);
  const [kontakti, setKontakti] = useState<KontaktUnos[]>([]);
  const [telefoni, setTelefoni] = useState<TelefonUnos[]>([]);

  const [drzave, setDrzave] = useState<Drzava[]>([]);
  const [gradovi, setGradovi] = useState<GradOpcija[]>([]);
  const [komercijalisti, setKomercijalisti] = useState<Komercijalista[]>([]);
  const [loadingLokacije, setLoadingLokacije] = useState(true);

  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [cuvanje, setCuvanje] = useState(false);

  const [postojeciPartneri, setPostojeciPartneri] = useState<
    PostojeciPartner[]
  >([]);
  const [ucitavanjePartnera, setUcitavanjePartnera] = useState(true);

  const ucitajPostojecePartnere = () => {
    setUcitavanjePartnera(true);
    fetch(`${API_URL}/api/partneri/lista-sve`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setPostojeciPartneri(json.data ?? []))
      .catch(() => setPostojeciPartneri([]))
      .finally(() => setUcitavanjePartnera(false));
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/partneri/drzave`, { credentials: "include" }).then(
        (r) => (r.ok ? r.json() : Promise.reject()),
      ),
      fetch(`${API_URL}/api/partneri/gradovi`, { credentials: "include" }).then(
        (r) => (r.ok ? r.json() : Promise.reject()),
      ),
      fetch(`${API_URL}/api/partneri/komercijalisti`, {
        credentials: "include",
      }).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([drzaveJson, gradoviJson, komercijalistiJson]) => {
        setDrzave(drzaveJson.data ?? []);
        setGradovi(gradoviJson.data ?? []);
        setKomercijalisti(komercijalistiJson.data ?? []);
      })
      .catch(() => {
        setDrzave([]);
        setGradovi([]);
        setKomercijalisti([]);
      })
      .finally(() => setLoadingLokacije(false));

    ucitajPostojecePartnere();
  }, []);

  const filtriraniPostojeci = useMemo(() => {
    const q = naziv.trim().toLowerCase();
    if (!q) return [];
    return postojeciPartneri
      .filter((p) => p.naziv?.toLowerCase().includes(q))
      .slice(0, 25);
  }, [naziv, postojeciPartneri]);

  const jibDuplikat = useMemo(() => {
    const q = jib.trim().toLowerCase();
    if (!q) return null;
    return (
      postojeciPartneri.find(
        (p) => p.jib && p.jib.trim().toLowerCase() === q,
      ) ?? null
    );
  }, [jib, postojeciPartneri]);

  const resetujFormu = () => {
    setNaziv("");
    setJib("");
    setPib("");
    setPdvObveznik(false);
    setTipPartnera("kupac");
    setAdresa("");
    setSifraDrzave("");
    setSifraGrada("");
    setPostanskiBroj("");
    setValutaPlacanja("");
    setRabatProcenat("");
    setSifraKomercijaliste("");
    setPoslovnice([]);
    setKontakti([]);
    setTelefoni([]);
  };

  const azurirajPoslovnicu = (
    i: number,
    izmjena: Partial<PoslovnicaUnos>,
  ) => {
    setPoslovnice((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...izmjena } : p)),
    );
  };

  const azurirajKontakt = (i: number, izmjena: Partial<KontaktUnos>) => {
    setKontakti((prev) =>
      prev.map((k, idx) => (idx === i ? { ...k, ...izmjena } : k)),
    );
  };

  const azurirajTelefon = (i: number, izmjena: Partial<TelefonUnos>) => {
    setTelefoni((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, ...izmjena } : t)),
    );
  };

  const handleSacuvaj = async () => {
    setGreska(null);
    setUspjeh(null);

    if (!naziv.trim()) {
      setGreska("Naziv partnera je obavezan");
      return;
    }
    if (pdvObveznik && !pib.trim()) {
      setGreska("PDV obveznik mora imati unesen PIB broj");
      return;
    }
    if (jibDuplikat) {
      setGreska(
        `Partner sa JIB-om "${jib.trim()}" već postoji: ${jibDuplikat.naziv}`,
      );
      return;
    }
    if (poslovnice.some((p) => !p.sifra.trim() || !p.naziv.trim())) {
      setGreska("Svaka poslovnica mora imati šifru i naziv");
      return;
    }
    if (kontakti.some((k) => !k.ime.trim() || !k.prezime.trim())) {
      setGreska("Svaki kontakt mora imati ime i prezime");
      return;
    }
    if (telefoni.some((t) => !t.broj.trim())) {
      setGreska("Svaki telefon mora imati broj");
      return;
    }

    const nazivGrada = (sifra: string) =>
      gradovi.find((g) => String(g.sifra_grada) === sifra)?.naziv_grada;

    const payload: Record<string, unknown> = {
      naziv: naziv.trim(),
      // Nema posebnog polja u formi — skraćeni naziv je uvijek identičan
      // punom nazivu partnera.
      skraceni_naziv: naziv.trim(),
      jib: jib.trim() || undefined,
      pib: pib.trim() || undefined,
      pdv_obveznik: pdvObveznik ? 1 : 0,
      tip_partnera: tipPartnera,
      adresa: adresa.trim() || undefined,
      grad: nazivGrada(sifraGrada),
      sifra_grada: sifraGrada ? Number(sifraGrada) : undefined,
      sifra_drzave: sifraDrzave ? Number(sifraDrzave) : undefined,
      postanski_broj: postanskiBroj.trim() || undefined,
      valuta_placanja: valutaPlacanja ? Number(valutaPlacanja) : undefined,
      // Nema posebnog polja u formi — uvijek se šalje fiksna vrijednost.
      limit_duga: 0,
      maticni_broj: "0",
      rabat_procenat: rabatProcenat ? Number(rabatProcenat) : undefined,
      pripada_radniku: sifraKomercijaliste
        ? Number(sifraKomercijaliste)
        : undefined,
      kreirao: username,
    };

    if (poslovnice.length > 0) {
      payload.poslovnice = poslovnice.map((p) => ({
        sifra: p.sifra.trim(),
        naziv: p.naziv.trim(),
        ...(p.glavna ? { glavna: 1 } : {}),
        ...(p.jib.trim() ? { jib: p.jib.trim() } : {}),
        ...(p.adresa.trim() ? { adresa: p.adresa.trim() } : {}),
        ...(nazivGrada(p.sifraGrada)
          ? { grad: nazivGrada(p.sifraGrada) }
          : {}),
      }));
    }

    if (kontakti.length > 0) {
      payload.kontakti = kontakti.map((k) => ({
        ime: k.ime.trim(),
        prezime: k.prezime.trim(),
        ...(k.funkcija.trim() ? { funkcija: k.funkcija.trim() } : {}),
        ...(k.poslovnicaSifra
          ? { poslovnica_sifra: k.poslovnicaSifra }
          : {}),
      }));
    }

    if (telefoni.length > 0) {
      payload.telefoni = telefoni.map((t) => ({
        broj: t.broj.trim(),
        ...(t.tip.trim() ? { tip: t.tip.trim() } : {}),
        ...(t.primarni ? { primarni: 1 } : {}),
        ...(t.poslovnicaSifra
          ? { poslovnica_sifra: t.poslovnicaSifra }
          : {}),
        ...(t.kontaktIndex !== ""
          ? { kontakt_index: Number(t.kontaktIndex) }
          : {}),
      }));
    }

    setCuvanje(true);
    try {
      const res = await fetch(`${API_URL}/api/partneri/glavni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri unosu partnera");
      }
      setUspjeh(`Partner "${naziv.trim()}" je sačuvan.`);
      resetujFormu();
      ucitajPostojecePartnere();
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
          <UserPlus size={20} style={{ color: PRIMARY }} />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-[#ede9f6]">
          Unos partnera
        </h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
      <div className="min-w-0 space-y-4">

      {/* Osnovni podaci */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-5 max-w-3xl space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Naziv partnera *">
            <input
              type="text"
              value={naziv}
              onChange={(e) => setNaziv(e.target.value)}
              placeholder="Trgovina Marković d.o.o."
              className={inputClass}
            />
          </Field>
          <Field label="JIB">
            <input
              type="text"
              value={jib}
              onChange={(e) => setJib(e.target.value)}
              className={inputClass}
            />
            {jibDuplikat && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertTriangle size={11} />
                Već postoji: {jibDuplikat.naziv}
              </p>
            )}
          </Field>
          <Field label="PIB">
            <input
              type="text"
              value={pib}
              onChange={(e) => {
                const vrijednost = e.target.value;
                setPib(vrijednost);
                setPdvObveznik(/^\d{12}$/.test(vrijednost.trim()));
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Tip partnera">
            <select
              value={tipPartnera}
              onChange={(e) => setTipPartnera(e.target.value)}
              className={inputClass}
            >
              <option value="kupac">Kupac</option>
              <option value="dobavljac">Dobavljač</option>
              <option value="oba">Oba</option>
            </select>
          </Field>
          <Field label="Adresa">
            <input
              type="text"
              value={adresa}
              onChange={(e) => setAdresa(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Država">
            <select
              value={sifraDrzave}
              onChange={(e) => {
                setSifraDrzave(e.target.value);
                setSifraGrada("");
              }}
              className={inputClass}
            >
              <option value="">
                {loadingLokacije ? "Učitavanje..." : "-- Izaberi državu --"}
              </option>
              {drzave.map((d) => (
                <option key={d.sifra_drzave} value={d.sifra_drzave}>
                  {d.naziv_drzave}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grad">
            <select
              value={sifraGrada}
              onChange={(e) => {
                setSifraGrada(e.target.value);
                const izabrani = gradovi.find(
                  (g) => String(g.sifra_grada) === e.target.value,
                );
                if (izabrani?.ptt) setPostanskiBroj(izabrani.ptt);
              }}
              disabled={!sifraDrzave}
              className={inputClass}
            >
              <option value="">
                {!sifraDrzave ? "-- Prvo izaberi državu --" : "-- Izaberi grad --"}
              </option>
              {gradovi
                .filter((g) => String(g.sifra_drzave) === sifraDrzave)
                .map((g) => (
                  <option key={g.sifra_grada} value={g.sifra_grada}>
                    {g.naziv_grada}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Poštanski broj">
            <input
              type="text"
              value={postanskiBroj}
              onChange={(e) => setPostanskiBroj(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Valuta plaćanja (dana)">
            <input
              type="number"
              value={valutaPlacanja}
              onChange={(e) => setValutaPlacanja(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Rabat (%)">
            <input
              type="number"
              step="0.01"
              value={rabatProcenat}
              onChange={(e) => setRabatProcenat(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Komercijalista">
            <select
              value={sifraKomercijaliste}
              onChange={(e) => setSifraKomercijaliste(e.target.value)}
              className={inputClass}
            >
              <option value="">
                {loadingLokacije ? "Učitavanje..." : "-- Izaberi komercijalistu --"}
              </option>
              {komercijalisti.map((k) => (
                <option key={k.sifra_radnika} value={k.sifra_radnika}>
                  {k.naziv_radnika}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] pt-1">
          <input
            type="checkbox"
            checked={pdvObveznik}
            onChange={(e) => setPdvObveznik(e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: PRIMARY }}
          />
          PDV obveznik
        </label>
      </div>

      {/* Poslovnice */}
      <SectionCard
        icon={<Building2 size={15} style={{ color: PRIMARY }} />}
        title="Poslovnice"
        addLabel="Dodaj poslovnicu"
        onAdd={() => setPoslovnice((prev) => [...prev, praznaPoslovnica()])}
      >
        {poslovnice.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Nema dodatih poslovnica — opciono.
          </p>
        )}
        {poslovnice.map((p, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498]">
                Poslovnica #{i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPoslovnice((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Field label="Šifra *">
                <input
                  type="text"
                  value={p.sifra}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, { sifra: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Naziv *">
                <input
                  type="text"
                  value={p.naziv}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, { naziv: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="JIB">
                <input
                  type="text"
                  value={p.jib}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, { jib: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Adresa">
                <input
                  type="text"
                  value={p.adresa}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, { adresa: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Država">
                <select
                  value={p.sifraDrzave}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, {
                      sifraDrzave: e.target.value,
                      sifraGrada: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="">-- Izaberi državu --</option>
                  {drzave.map((d) => (
                    <option key={d.sifra_drzave} value={d.sifra_drzave}>
                      {d.naziv_drzave}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Grad">
                <select
                  value={p.sifraGrada}
                  onChange={(e) =>
                    azurirajPoslovnicu(i, { sifraGrada: e.target.value })
                  }
                  disabled={!p.sifraDrzave}
                  className={inputClass}
                >
                  <option value="">
                    {!p.sifraDrzave
                      ? "-- Prvo izaberi državu --"
                      : "-- Izaberi grad --"}
                  </option>
                  {gradovi
                    .filter((g) => String(g.sifra_drzave) === p.sifraDrzave)
                    .map((g) => (
                      <option key={g.sifra_grada} value={g.sifra_grada}>
                        {g.naziv_grada}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
              <input
                type="checkbox"
                checked={p.glavna}
                onChange={(e) =>
                  azurirajPoslovnicu(i, { glavna: e.target.checked })
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: PRIMARY }}
              />
              Glavna poslovnica
            </label>
          </div>
        ))}
      </SectionCard>

      {/* Kontakti */}
      <SectionCard
        icon={<IdCard size={15} style={{ color: PRIMARY }} />}
        title="Kontakti"
        addLabel="Dodaj kontakt"
        onAdd={() => setKontakti((prev) => [...prev, prazanKontakt()])}
      >
        {kontakti.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Nema dodatih kontakata — opciono.
          </p>
        )}
        {kontakti.map((k, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498]">
                Kontakt #{i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setKontakti((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Field label="Ime *">
                <input
                  type="text"
                  value={k.ime}
                  onChange={(e) =>
                    azurirajKontakt(i, { ime: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Prezime *">
                <input
                  type="text"
                  value={k.prezime}
                  onChange={(e) =>
                    azurirajKontakt(i, { prezime: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Funkcija">
                <input
                  type="text"
                  value={k.funkcija}
                  onChange={(e) =>
                    azurirajKontakt(i, { funkcija: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Poslovnica">
                <select
                  value={k.poslovnicaSifra}
                  onChange={(e) =>
                    azurirajKontakt(i, { poslovnicaSifra: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  {poslovnice
                    .filter((p) => p.sifra.trim())
                    .map((p, idx) => (
                      <option key={idx} value={p.sifra}>
                        {p.sifra} {p.naziv ? `— ${p.naziv}` : ""}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Telefoni */}
      <SectionCard
        icon={<Phone size={15} style={{ color: PRIMARY }} />}
        title="Telefoni"
        addLabel="Dodaj telefon"
        onAdd={() => setTelefoni((prev) => [...prev, prazanTelefon()])}
      >
        {telefoni.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-[#5f5878]">
            Nema dodatih telefona — opciono.
          </p>
        )}
        {telefoni.map((t, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498]">
                Telefon #{i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setTelefoni((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Field label="Broj *">
                <input
                  type="text"
                  value={t.broj}
                  onChange={(e) =>
                    azurirajTelefon(i, { broj: e.target.value })
                  }
                  placeholder="051/123-456"
                  className={inputClass}
                />
              </Field>
              <Field label="Tip">
                <input
                  type="text"
                  value={t.tip}
                  onChange={(e) =>
                    azurirajTelefon(i, { tip: e.target.value })
                  }
                  placeholder="centrala / mobilni"
                  className={inputClass}
                />
              </Field>
              <Field label="Poslovnica">
                <select
                  value={t.poslovnicaSifra}
                  onChange={(e) =>
                    azurirajTelefon(i, {
                      poslovnicaSifra: e.target.value,
                      kontaktIndex: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  {poslovnice
                    .filter((p) => p.sifra.trim())
                    .map((p, idx) => (
                      <option key={idx} value={p.sifra}>
                        {p.sifra} {p.naziv ? `— ${p.naziv}` : ""}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Kontakt">
                <select
                  value={t.kontaktIndex}
                  onChange={(e) =>
                    azurirajTelefon(i, {
                      kontaktIndex: e.target.value,
                      poslovnicaSifra: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  {kontakti.map((k, idx) => (
                    <option key={idx} value={idx}>
                      {k.ime || k.prezime
                        ? `${k.ime} ${k.prezime}`.trim()
                        : `Kontakt #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
              <input
                type="checkbox"
                checked={t.primarni}
                onChange={(e) =>
                  azurirajTelefon(i, { primarni: e.target.checked })
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: PRIMARY }}
              />
              Primarni telefon
            </label>
          </div>
        ))}
      </SectionCard>

      <button
        onClick={() => void handleSacuvaj()}
        disabled={cuvanje}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: PRIMARY }}
      >
        {cuvanje ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <UserPlus size={15} />
        )}
        Sačuvaj partnera
      </button>

      </div>

      {/* Postojeći partneri — filtrira se dok kucaš naziv */}
      <div className="w-full xl:w-80 shrink-0 xl:sticky xl:top-4">
        <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: PRIMARY }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: PRIMARY }}
            >
              Postojeći partneri
            </span>
          </div>

          {ucitavanjePartnera && (
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-[#5f5878]">
              <Loader2 size={13} className="animate-spin" />
              Učitavanje...
            </div>
          )}

          {!ucitavanjePartnera && !naziv.trim() && (
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Počni da kucaš naziv partnera da vidiš da li već postoji.
            </p>
          )}

          {!ucitavanjePartnera &&
            naziv.trim() &&
            filtriraniPostojeci.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-[#5f5878]">
                Nema partnera sa tim nazivom.
              </p>
            )}

          {!ucitavanjePartnera && filtriraniPostojeci.length > 0 && (
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
              {filtriraniPostojeci.map((p) => (
                <div
                  key={p.partner_id}
                  className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-3 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6] truncate">
                      {p.naziv}
                    </span>
                    {p.telefon && (
                      <Phone
                        size={13}
                        className="shrink-0"
                        style={{ color: PRIMARY }}
                      />
                    )}
                  </div>

                  <div className="mt-1 flex items-start gap-1.5 text-xs text-gray-500 dark:text-[#a99fc2]">
                    <MapPin size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {[p.adresa, p.grad].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>

                  {p.jib && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-[#5f5878]">
                      JIB: {p.jib}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>

      {uspjeh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={40} style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              {uspjeh}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setUspjeh(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {greska && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-red-300 p-6">
            <div className="flex justify-center mb-3">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <p className="text-base font-semibold text-red-700 dark:text-red-400 text-center">
              {greska}
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setGreska(null)}
                className="min-w-[90px] px-4 py-2 rounded-lg text-white font-semibold transition-all"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
