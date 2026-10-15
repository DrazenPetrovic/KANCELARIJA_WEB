import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  IdCard,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Search,
  Star,
  X,
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
  pripada_radniku: number | null;
  naziv_radnika: string;
  telefon: string | null;
  broj_poslovnica: number;
  broj_kontakata: number;
  broj_telefona: number;
}

interface Poslovnica {
  poslovnica_id: number;
  partner_id: number;
  sifra: string;
  naziv: string;
  jib: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  glavna: number;
  napomena: string | null;
  aktivan: number;
}

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

interface Telefon {
  telefon_id: number;
  partner_id: number;
  poslovnica_id: number | null;
  kontakt_id: number | null;
  broj_original: string;
  broj_normalizovan: string;
  tip: "fiksni" | "mobilni" | "fax" | "viber" | "centrala";
  primarni: number;
  napomena: string | null;
  aktivan: number;
}

type PartnerTab = "poslovnice" | "kontakti" | "telefoni";

const TIP_TELEFONA_LABEL: Record<Telefon["tip"], string> = {
  fiksni: "Fiksni",
  mobilni: "Mobilni",
  fax: "Fax",
  viber: "Viber",
  centrala: "Centrala",
};

const TH = ({
  children,
  center,
  width,
}: {
  children: React.ReactNode;
  center?: boolean;
  width?: string;
}) => (
  <th
    className={`px-2 py-2 text-xs font-bold uppercase tracking-wider bg-[#f4f1f9] dark:bg-[#2a2340] ${center ? "text-center" : "text-left"}`}
    style={{ color: PRIMARY, width }}
  >
    {children}
  </th>
);

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
    className="px-2 py-2 text-xs font-bold uppercase tracking-wider bg-[#f4f1f9] dark:bg-[#2a2340] text-left cursor-pointer select-none hover:bg-[#ede8f5] dark:hover:bg-[#312a50] transition-colors"
    style={{ color: PRIMARY, width }}
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
        <ArrowUpDown size={12} className="opacity-30" />
      )}
    </span>
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
    className={`px-2 py-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis border-b border-gray-100 dark:border-[#2d2648] text-gray-700 dark:text-[#c5bfd8] ${center ? "text-center" : ""}`}
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

function StanjeUcitavanja() {
  return (
    <div className="flex items-center justify-center py-10 gap-3">
      <Loader2 size={20} className="animate-spin" style={{ color: PRIMARY }} />
      <span className="text-sm text-gray-500 dark:text-[#7d7498]">
        Učitavanje...
      </span>
    </div>
  );
}

function StanjeGreske({ poruka }: { poruka: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <p className="text-sm text-red-500 dark:text-red-400">{poruka}</p>
    </div>
  );
}

function StanjePrazno({ tekst }: { tekst: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <p className="text-sm text-gray-400 dark:text-[#5f5878]">{tekst}</p>
    </div>
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

interface IzmjenaForme {
  naziv: string;
  jib: string;
  pib: string;
  pdvObveznik: boolean;
  tipPartnera: string;
  adresa: string;
  sifraDrzave: string;
  sifraGrada: string;
  postanskiBroj: string;
  valutaPlacanja: string;
  limitDuga: string;
  rabatProcenat: string;
  sifraKomercijaliste: string;
  aktivan: boolean;
}

const praznaIzmjenaForme = (): IzmjenaForme => ({
  naziv: "",
  jib: "",
  pib: "",
  pdvObveznik: false,
  tipPartnera: "kupac",
  adresa: "",
  sifraDrzave: "",
  sifraGrada: "",
  postanskiBroj: "",
  valutaPlacanja: "",
  limitDuga: "",
  rabatProcenat: "",
  sifraKomercijaliste: "",
  aktivan: true,
});

type EditTab = "osnovno" | "poslovnice" | "telefoni";

interface PoslovnicaIzmjena {
  poslovnica_id?: number;
  sifra: string;
  naziv: string;
  jib: string;
  adresa: string;
  sifraDrzave: string;
  sifraGrada: string;
  postanskiBroj: string;
  glavna: boolean;
  napomena: string;
  aktivan: boolean;
}

const praznaPoslovnicaIzmjena = (): PoslovnicaIzmjena => ({
  sifra: "",
  naziv: "",
  jib: "",
  adresa: "",
  sifraDrzave: "",
  sifraGrada: "",
  postanskiBroj: "",
  glavna: false,
  napomena: "",
  aktivan: true,
});

interface TelefonIzmjena {
  // Legacy zapis (učitan iz erp.partneri_telefoni) — samo prikaz, nema
  // procedure za izmjenu, pa se NE koristi za čuvanje preko kontakt-procedura.
  telefon_id?: number;
  tip: string;
  primarni: boolean;
  // Kontakt/telefon preko erp.partneri_telefoni_unos / _izmjena — upisuje i
  // čita se iz erp.partneri_kontakti (odvojena, nezavisna numeracija id-a).
  kontakt_id?: number;
  broj: string;
  sifraRadnika: string;
  poslovnicaId: string;
  opis: string;
  aktivan: boolean;
}

const prazanTelefonIzmjena = (): TelefonIzmjena => ({
  tip: "mobilni",
  primarni: false,
  broj: "",
  sifraRadnika: "",
  poslovnicaId: "",
  opis: "",
  aktivan: true,
});

// "Windowing" tabele partnera — kod velike baze partnera renderovanje SVIH
// <tr> odjednom usporava DOM i React reconciliation. Isti pristup kao u
// pregledu računa (racuniPregled.tsx): prati se scroll pozicija scroll-
// kontejnera i u DOM-u se drži samo vidljivi opseg redova (+ overscan), a
// razlika u visini se nadoknađuje sa dva "spacer" <tr> (prije/poslije), da
// scrollbar ostane tačne veličine. Podaci se i dalje učitavaju svi odjednom
// (/api/partneri/lista-sve) — virtualizuje se samo renderovanje, bez
// potrebe za brojanjem zapisa na serveru unaprijed.
const ROW_HEIGHT_PX = 56;
const OVERSCAN_REDOVA = 15;
const PRAG_VIRTUALIZACIJE = 150;
const BROJ_KOLONA = 9;

export function PartneriPregled() {
  const [data, setData] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pretraga, setPretraga] = useState("");
  const [tipFilter, setTipFilter] = useState("svi");
  const [statusFilter, setStatusFilter] = useState("aktivni");
  const [sortPolje, setSortPolje] = useState<"partner_id" | "naziv">(
    "partner_id",
  );
  const [sortSmjer, setSortSmjer] = useState<SmjerSortiranja>("asc");

  const promijeniSortiranje = (polje: "partner_id" | "naziv") => {
    if (sortPolje === polje) {
      setSortSmjer((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortPolje(polje);
      setSortSmjer("asc");
    }
  };

  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [activeTab, setActiveTab] = useState<PartnerTab>("poslovnice");

  const [poslovnice, setPoslovnice] = useState<Poslovnica[]>([]);
  const [poslovniceLoading, setPoslovniceLoading] = useState(false);
  const [poslovniceError, setPoslovniceError] = useState<string | null>(null);

  const [telefoni, setTelefoni] = useState<Telefon[]>([]);
  const [telefoniLoading, setTelefoniLoading] = useState(false);
  const [telefoniError, setTelefoniError] = useState<string | null>(null);

  const [drzave, setDrzave] = useState<Drzava[]>([]);
  const [gradovi, setGradovi] = useState<GradOpcija[]>([]);
  const [komercijalisti, setKomercijalisti] = useState<Komercijalista[]>([]);

  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState<IzmjenaForme>(praznaIzmjenaForme());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editUspjeh, setEditUspjeh] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("osnovno");

  const [editPoslovnice, setEditPoslovnice] = useState<PoslovnicaIzmjena[]>(
    [],
  );
  const [editPoslovniceLoading, setEditPoslovniceLoading] = useState(false);
  const [editPoslovniceError, setEditPoslovniceError] = useState<
    string | null
  >(null);
  const [poslovnicaUCuvanju, setPoslovnicaUCuvanju] = useState<number | null>(
    null,
  );
  const [poslovnicaGreska, setPoslovnicaGreska] = useState<string | null>(
    null,
  );
  const [poslovnicaEditIndeksi, setPoslovnicaEditIndeksi] = useState<
    Set<number>
  >(new Set());

  const [editTelefoni, setEditTelefoni] = useState<TelefonIzmjena[]>([]);
  const [editTelefoniLoading, setEditTelefoniLoading] = useState(false);
  const [editTelefoniError, setEditTelefoniError] = useState<string | null>(
    null,
  );
  const [telefonUCuvanju, setTelefonUCuvanju] = useState<number | null>(null);
  const [telefonGreska, setTelefonGreska] = useState<string | null>(null);
  const [telefonEditIndeksi, setTelefonEditIndeksi] = useState<Set<number>>(
    new Set(),
  );

  const prekiniEditPoslovnice = (indeks: number) => {
    setPoslovnicaEditIndeksi((prev) => {
      const sljedeci = new Set(prev);
      sljedeci.delete(indeks);
      return sljedeci;
    });
  };

  const pokreniEditPoslovnice = (indeks: number) => {
    setPoslovnicaEditIndeksi((prev) => new Set(prev).add(indeks));
  };

  const prekiniEditTelefona = (indeks: number) => {
    setTelefonEditIndeksi((prev) => {
      const sljedeci = new Set(prev);
      sljedeci.delete(indeks);
      return sljedeci;
    });
  };

  const pokreniEditTelefona = (indeks: number) => {
    setTelefonEditIndeksi((prev) => new Set(prev).add(indeks));
  };

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
      });
  }, []);

  const poslovnicaUFormu = (pos: Poslovnica): PoslovnicaIzmjena => {
    const drzavaPodudaranje = drzave.find((d) => d.naziv_drzave === pos.grad);
    const gradPodudaranje = gradovi.find((g) => g.naziv_grada === pos.grad);
    return {
      poslovnica_id: pos.poslovnica_id,
      sifra: pos.sifra ?? "",
      naziv: pos.naziv ?? "",
      jib: pos.jib ?? "",
      adresa: pos.adresa ?? "",
      sifraDrzave: gradPodudaranje
        ? String(gradPodudaranje.sifra_drzave)
        : drzavaPodudaranje
          ? String(drzavaPodudaranje.sifra_drzave)
          : "",
      sifraGrada: gradPodudaranje ? String(gradPodudaranje.sifra_grada) : "",
      postanskiBroj: pos.postanski_broj ?? "",
      glavna: pos.glavna === 1,
      napomena: pos.napomena ?? "",
      aktivan: pos.aktivan === 1,
    };
  };

  const telefonUFormu = (tel: Telefon): TelefonIzmjena => ({
    telefon_id: tel.telefon_id,
    tip: tel.tip ?? "mobilni",
    primarni: tel.primarni === 1,
    broj: tel.broj_original ?? "",
    poslovnicaId: tel.poslovnica_id != null ? String(tel.poslovnica_id) : "",
    sifraRadnika: "",
    opis: "",
    aktivan: tel.aktivan === 1,
  });

  const otvoriIzmjenu = (partner: Partner) => {
    const drzavaPodudaranje = drzave.find(
      (d) => d.naziv_drzave === partner.drzava,
    );
    const gradPodudaranje = gradovi.find(
      (g) =>
        g.naziv_grada === partner.grad &&
        (!drzavaPodudaranje || g.sifra_drzave === drzavaPodudaranje.sifra_drzave),
    );

    setEditPartner(partner);
    setEditTab("osnovno");
    setEditForm({
      naziv: partner.naziv ?? "",
      jib: partner.jib ?? "",
      pib: partner.pib ?? "",
      pdvObveznik: partner.pdv_obveznik === 1,
      tipPartnera: partner.tip_partnera ?? "kupac",
      adresa: partner.adresa ?? "",
      sifraDrzave: drzavaPodudaranje ? String(drzavaPodudaranje.sifra_drzave) : "",
      sifraGrada: gradPodudaranje ? String(gradPodudaranje.sifra_grada) : "",
      postanskiBroj: partner.postanski_broj ?? "",
      valutaPlacanja:
        partner.valuta_placanja != null ? String(partner.valuta_placanja) : "",
      limitDuga: partner.limit_duga != null ? String(partner.limit_duga) : "",
      rabatProcenat:
        partner.rabat_procenat != null ? String(partner.rabat_procenat) : "",
      sifraKomercijaliste:
        partner.pripada_radniku != null ? String(partner.pripada_radniku) : "",
      aktivan: partner.aktivan === 1,
    });
    setEditError(null);

    setEditPoslovnice([]);
    setEditPoslovniceError(null);
    setPoslovnicaGreska(null);
    setPoslovnicaEditIndeksi(new Set());
    setEditPoslovniceLoading(true);
    fetch(`${API_URL}/api/partneri/${partner.partner_id}/poslovnice`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju poslovnica");
        return res.json();
      })
      .then((json) =>
        setEditPoslovnice(
          ((json.data ?? []) as Poslovnica[]).map(poslovnicaUFormu),
        ),
      )
      .catch((err) =>
        setEditPoslovniceError(
          err instanceof Error ? err.message : "Nepoznata greška",
        ),
      )
      .finally(() => setEditPoslovniceLoading(false));

    setEditTelefoni([]);
    setEditTelefoniError(null);
    setTelefonGreska(null);
    setTelefonEditIndeksi(new Set());
    setEditTelefoniLoading(true);
    fetch(`${API_URL}/api/partneri/${partner.partner_id}/telefoni`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju telefona");
        return res.json();
      })
      .then((json) =>
        setEditTelefoni(((json.data ?? []) as Telefon[]).map(telefonUFormu)),
      )
      .catch((err) =>
        setEditTelefoniError(
          err instanceof Error ? err.message : "Nepoznata greška",
        ),
      )
      .finally(() => setEditTelefoniLoading(false));
  };

  const zatvoriIzmjenu = () => {
    setEditPartner(null);
    setEditForm(praznaIzmjenaForme());
    setEditError(null);
    setEditTab("osnovno");
    setEditPoslovnice([]);
    setEditPoslovniceError(null);
    setPoslovnicaGreska(null);
    setPoslovnicaEditIndeksi(new Set());
    setEditTelefoni([]);
    setEditTelefoniError(null);
    setTelefonGreska(null);
    setTelefonEditIndeksi(new Set());
  };

  const dodajPraznuPoslovnicu = () => {
    setEditPoslovnice((prev) => [...prev, praznaPoslovnicaIzmjena()]);
    setPoslovnicaGreska(null);
  };

  const azurirajPoljePoslovnice = (
    indeks: number,
    izmjena: Partial<PoslovnicaIzmjena>,
  ) => {
    setEditPoslovnice((prev) =>
      prev.map((p, idx) => (idx === indeks ? { ...p, ...izmjena } : p)),
    );
  };

  const ukloniNesacuvanuPoslovnicu = (indeks: number) => {
    setEditPoslovnice((prev) => prev.filter((_, idx) => idx !== indeks));
  };

  const sacuvajPoslovnicu = async (indeks: number) => {
    if (!editPartner) return;
    const red = editPoslovnice[indeks];
    if (!red.naziv.trim()) {
      setPoslovnicaGreska("Naziv poslovnice je obavezan");
      return;
    }

    const nazivGrada = (sifra: string) =>
      gradovi.find((g) => String(g.sifra_grada) === sifra)?.naziv_grada;

    // Šifra poslovnice se NE šalje — dodjeljuje je automatski
    // erp.partneri_poslovnice_unos (sekvenca po partneru).
    const payload = {
      partner_id: editPartner.partner_id,
      naziv: red.naziv.trim(),
      jib: red.jib.trim() || null,
      adresa: red.adresa.trim() || null,
      sifra_grada: red.sifraGrada ? Number(red.sifraGrada) : null,
      grad: nazivGrada(red.sifraGrada) ?? null,
      postanski_broj: red.postanskiBroj.trim() || null,
      glavna: red.glavna ? 1 : 0,
      napomena: red.napomena.trim() || null,
      aktivan: red.aktivan ? 1 : 0,
    };

    setPoslovnicaGreska(null);
    setPoslovnicaUCuvanju(indeks);
    try {
      const url = red.poslovnica_id
        ? `${API_URL}/api/partneri/poslovnice/${red.poslovnica_id}`
        : `${API_URL}/api/partneri/${editPartner.partner_id}/poslovnice`;
      const method = red.poslovnica_id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri čuvanju poslovnice");
      }

      const noviId = json.data?.poslovnica_id ?? red.poslovnica_id;
      const novaSifra =
        json.data?.sifra != null ? String(json.data.sifra) : red.sifra;
      prekiniEditPoslovnice(indeks);
      setEditPoslovnice((prev) =>
        prev.map((p, idx) =>
          idx === indeks
            ? { ...p, poslovnica_id: noviId, sifra: novaSifra }
            : p,
        ),
      );
    } catch (err) {
      setPoslovnicaGreska(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setPoslovnicaUCuvanju(null);
    }
  };

  const dodajPrazanTelefon = () => {
    setEditTelefoni((prev) => [...prev, prazanTelefonIzmjena()]);
    setTelefonGreska(null);
  };

  const azurirajPoljeTelefona = (
    indeks: number,
    izmjena: Partial<TelefonIzmjena>,
  ) => {
    setEditTelefoni((prev) =>
      prev.map((t, idx) => (idx === indeks ? { ...t, ...izmjena } : t)),
    );
  };

  const ukloniNesacuvaniTelefon = (indeks: number) => {
    setEditTelefoni((prev) => prev.filter((_, idx) => idx !== indeks));
  };

  // Unos i izmjena kontakt-telefona idu preko erp.partneri_telefoni_unos /
  // _izmjena — obje upisuju/čitaju erp.partneri_kontakti, identifikovano
  // preko kontakt_id (NE telefon_id — to je potpuno druga, legacy tabela
  // erp.partneri_telefoni za koju trenutno nema procedure za izmjenu).
  const sacuvajTelefon = async (indeks: number) => {
    if (!editPartner) return;
    const red = editTelefoni[indeks];

    if (!red.sifraRadnika) {
      setTelefonGreska("Radnik je obavezan");
      return;
    }
    if (!red.broj.trim()) {
      setTelefonGreska("Broj telefona je obavezan");
      return;
    }

    const payload = {
      partner_id: editPartner.partner_id,
      poslovnica_id: red.poslovnicaId ? Number(red.poslovnicaId) : null,
      sifra_radnika: Number(red.sifraRadnika),
      napomena: red.broj.trim(),
      dodatni_podaci_opis: red.opis.trim() || null,
      aktivan: red.aktivan ? 1 : 0,
    };

    setTelefonGreska(null);
    setTelefonUCuvanju(indeks);
    try {
      const url = red.kontakt_id
        ? `${API_URL}/api/partneri/telefoni/${red.kontakt_id}`
        : `${API_URL}/api/partneri/${editPartner.partner_id}/telefoni`;
      const method = red.kontakt_id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri čuvanju telefona");
      }

      const noviId = json.data?.kontakt_id ?? red.kontakt_id;
      prekiniEditTelefona(indeks);
      setEditTelefoni((prev) =>
        prev.map((t, idx) =>
          idx === indeks ? { ...t, kontakt_id: noviId } : t,
        ),
      );
    } catch (err) {
      setTelefonGreska(
        err instanceof Error ? err.message : "Nepoznata greška",
      );
    } finally {
      setTelefonUCuvanju(null);
    }
  };

  const sacuvajIzmjenu = async () => {
    if (!editPartner) return;
    setEditError(null);

    if (!editForm.naziv.trim()) {
      setEditError("Naziv partnera je obavezan");
      return;
    }

    const nazivGrada = (sifra: string) =>
      gradovi.find((g) => String(g.sifra_grada) === sifra)?.naziv_grada;
    const nazivDrzave = (sifra: string) =>
      drzave.find((d) => String(d.sifra_drzave) === sifra)?.naziv_drzave;
    const nazivKomercijaliste = (sifra: string) =>
      komercijalisti.find((k) => String(k.sifra_radnika) === sifra)
        ?.naziv_radnika;

    const payload = {
      partner_id: editPartner.partner_id,
      naziv: editForm.naziv.trim(),
      // Nema posebnog polja za izmjenu — skraćeni naziv je uvijek identičan
      // punom nazivu partnera (isto ponašanje kao u unosu partnera).
      skraceni_naziv: editForm.naziv.trim(),
      jib: editForm.jib.trim() || null,
      pib: editForm.pib.trim() || null,
      pdv_obveznik: editForm.pdvObveznik ? 1 : 0,
      tip_partnera: editForm.tipPartnera,
      adresa: editForm.adresa.trim() || null,
      sifra_grada: editForm.sifraGrada ? Number(editForm.sifraGrada) : null,
      grad: nazivGrada(editForm.sifraGrada) ?? null,
      sifra_drzave: editForm.sifraDrzave ? Number(editForm.sifraDrzave) : null,
      drzava: nazivDrzave(editForm.sifraDrzave) ?? null,
      postanski_broj: editForm.postanskiBroj.trim() || null,
      valuta_placanja: editForm.valutaPlacanja
        ? Number(editForm.valutaPlacanja)
        : null,
      limit_duga: editForm.limitDuga ? Number(editForm.limitDuga) : null,
      rabat_procenat: editForm.rabatProcenat
        ? Number(editForm.rabatProcenat)
        : null,
      pripada_radniku: editForm.sifraKomercijaliste
        ? Number(editForm.sifraKomercijaliste)
        : null,
      aktivan: editForm.aktivan ? 1 : 0,
    };

    setEditSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/partneri/${editPartner.partner_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Greška pri ažuriranju partnera");
      }

      setData((prev) =>
        prev.map((p) =>
          p.partner_id === editPartner.partner_id
            ? {
                ...p,
                naziv: payload.naziv,
                skraceni_naziv: payload.skraceni_naziv,
                jib: payload.jib,
                pib: payload.pib,
                pdv_obveznik: payload.pdv_obveznik,
                tip_partnera: payload.tip_partnera,
                adresa: payload.adresa,
                grad: payload.grad,
                drzava: payload.drzava,
                postanski_broj: payload.postanski_broj,
                valuta_placanja: payload.valuta_placanja,
                limit_duga: payload.limit_duga,
                rabat_procenat: payload.rabat_procenat,
                pripada_radniku: payload.pripada_radniku,
                naziv_radnika:
                  nazivKomercijaliste(editForm.sifraKomercijaliste) ??
                  "Nije dodijeljen",
                aktivan: payload.aktivan,
              }
            : p,
        ),
      );

      setEditUspjeh(true);
      zatvoriIzmjenu();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Nepoznata greška");
    } finally {
      setEditSaving(false);
    }
  };

  const otvoriPartnera = (partner: Partner) => {
    setSelectedPartner(partner);
    setActiveTab("poslovnice");

    setPoslovnice([]);
    setPoslovniceError(null);
    setPoslovniceLoading(true);
    fetch(`${API_URL}/api/partneri/${partner.partner_id}/poslovnice`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju poslovnica");
        return res.json();
      })
      .then((json) => setPoslovnice(json.data ?? []))
      .catch((err) =>
        setPoslovniceError(
          err instanceof Error ? err.message : "Nepoznata greška",
        ),
      )
      .finally(() => setPoslovniceLoading(false));

    setTelefoni([]);
    setTelefoniError(null);
    setTelefoniLoading(true);
    fetch(`${API_URL}/api/partneri/${partner.partner_id}/telefoni`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju telefona");
        return res.json();
      })
      .then((json) => setTelefoni(json.data ?? []))
      .catch((err) =>
        setTelefoniError(
          err instanceof Error ? err.message : "Nepoznata greška",
        ),
      )
      .finally(() => setTelefoniLoading(false));
  };

  const zatvoriPartnera = () => {
    setSelectedPartner(null);
    setPoslovnice([]);
    setPoslovniceError(null);
    setTelefoni([]);
    setTelefoniError(null);
  };

  const filtrirani = useMemo(() => {
    const rezultat = data.filter((p) => {
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

    const smjer = sortSmjer === "asc" ? 1 : -1;
    rezultat.sort((a, b) => {
      if (sortPolje === "partner_id") {
        return (a.partner_id - b.partner_id) * smjer;
      }
      return a.naziv.localeCompare(b.naziv) * smjer;
    });

    return rezultat;
  }, [data, pretraga, tipFilter, statusFilter, sortPolje, sortSmjer]);

  const jeVirtualizovano = filtrirani.length > PRAG_VIRTUALIZACIJE;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visinaKontejnera, setVisinaKontejnera] = useState(600);

  useEffect(() => {
    if (!jeVirtualizovano) return;
    const el = scrollRef.current;
    if (!el) return;
    setVisinaKontejnera(el.clientHeight);
    setScrollTop(el.scrollTop);
    const naScroll = () => setScrollTop(el.scrollTop);
    const naResize = () => setVisinaKontejnera(el.clientHeight);
    el.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", naResize);
    return () => {
      el.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", naResize);
    };
  }, [jeVirtualizovano]);

  let startIndex = 0;
  let endIndex = filtrirani.length;
  if (jeVirtualizovano) {
    const prviVidljivi = Math.floor(scrollTop / ROW_HEIGHT_PX);
    const brojVidljivih = Math.ceil(visinaKontejnera / ROW_HEIGHT_PX);
    startIndex = Math.max(0, prviVidljivi - OVERSCAN_REDOVA);
    endIndex = Math.min(
      filtrirani.length,
      prviVidljivi + brojVidljivih + OVERSCAN_REDOVA,
    );
  }
  const vidljiviPartneri = jeVirtualizovano
    ? filtrirani.slice(startIndex, endIndex)
    : filtrirani;
  const visinaPrijeRedova = startIndex * ROW_HEIGHT_PX;
  const visinaPoslijeRedova = (filtrirani.length - endIndex) * ROW_HEIGHT_PX;

  return (
    <div className="space-y-2 max-w-[1600px] mx-auto">
      {/* Filteri */}
      <div className="bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
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

          {!loading && !error && (
            <span className="ml-auto text-xs text-gray-400 dark:text-[#5f5878]">
              Ukupno: {filtrirani.length} / {data.length}
            </span>
          )}
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
          <div
            ref={jeVirtualizovano ? scrollRef : undefined}
            className="overflow-x-auto"
            style={
              jeVirtualizovano
                ? { maxHeight: "70vh", overflowY: "auto" }
                : undefined
            }
          >
            <table className="w-full table-fixed">
              <thead>
                <tr className={jeVirtualizovano ? "sticky top-0 z-10" : undefined}>
                  <SortableTH
                    aktivno={sortPolje === "partner_id"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("partner_id")}
                    width="4.5rem"
                  >
                    Šifra
                  </SortableTH>
                  <SortableTH
                    aktivno={sortPolje === "naziv"}
                    smjer={sortSmjer}
                    onClick={() => promijeniSortiranje("naziv")}
                    width="17rem"
                  >
                    Naziv
                  </SortableTH>
                  <TH width="7rem">JIB / PIB</TH>
                  <TH width="13rem">Adresa</TH>
                  <TH width="9rem">Telefon</TH>
                  <TH width="8rem">Radnik</TH>
                  <TH center width="10rem">
                    Poslovnice / Kontakti / Telefoni
                  </TH>
                  <TH center width="6rem">
                    Status
                  </TH>
                  <TH center width="4rem">
                    Akcije
                  </TH>
                </tr>
              </thead>
              <tbody>
                {jeVirtualizovano && visinaPrijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{ height: visinaPrijeRedova, padding: 0, border: "none" }}
                    />
                  </tr>
                )}
                {vidljiviPartneri.map((p) => (
                  <tr
                    key={p.partner_id}
                    onClick={() => otvoriPartnera(p)}
                    className="cursor-pointer hover:bg-purple-50/40 dark:hover:bg-[#271f40]/40 transition-colors"
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
                    <TD>{p.naziv_radnika}</TD>
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
                    <TD center>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          otvoriIzmjenu(p);
                        }}
                        title="Izmijeni partnera"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#ede8f5] dark:hover:bg-[#312a50]"
                        style={{ color: PRIMARY }}
                      >
                        <Pencil size={14} />
                      </button>
                    </TD>
                  </tr>
                ))}
                {jeVirtualizovano && visinaPoslijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{ height: visinaPoslijeRedova, padding: 0, border: "none" }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL - DETALJI PARTNERA */}
      {selectedPartner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) zatvoriPartnera();
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2"
            style={{ borderColor: ACCENT }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: PRIMARY }}
            >
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedPartner.naziv}
                </h3>
                <p className="text-xs text-white/70">
                  Partner #{selectedPartner.partner_id}
                </p>
              </div>
              <button
                type="button"
                onClick={zatvoriPartnera}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* TABOVI */}
            <div className="flex border-b border-gray-100 dark:border-[#2d2648] bg-[#faf9fc] dark:bg-[#201a30]">
              {(
                [
                  {
                    key: "poslovnice" as const,
                    label: "Poslovnice",
                    icon: <Building2 size={13} />,
                    count: selectedPartner.broj_poslovnica,
                  },
                  {
                    key: "kontakti" as const,
                    label: "Kontakti",
                    icon: <IdCard size={13} />,
                    count: selectedPartner.broj_kontakata,
                  },
                  {
                    key: "telefoni" as const,
                    label: "Telefoni",
                    icon: <Phone size={13} />,
                    count: selectedPartner.broj_telefona,
                  },
                ]
              ).map((tab) => {
                const aktivan = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    style={{
                      color: aktivan ? PRIMARY : undefined,
                      borderColor: aktivan ? ACCENT : "transparent",
                    }}
                  >
                    <span
                      className={
                        aktivan
                          ? ""
                          : "text-gray-500 dark:text-[#8a80a3] flex items-center gap-1.5"
                      }
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                    <span
                      className={`text-[10px] ${aktivan ? "" : "text-gray-400 dark:text-[#5f5878]"}`}
                    >
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {activeTab === "poslovnice" && (
                <>
                  {poslovniceLoading && <StanjeUcitavanja />}
                  {poslovniceError && <StanjeGreske poruka={poslovniceError} />}
                  {!poslovniceLoading &&
                    !poslovniceError &&
                    poslovnice.length === 0 && (
                      <StanjePrazno tekst="Partner nema evidentiranih poslovnica." />
                    )}
                  {!poslovniceLoading &&
                    !poslovniceError &&
                    poslovnice.map((pos) => (
                      <div
                        key={pos.poslovnica_id}
                        className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-4 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={15} style={{ color: PRIMARY }} />
                            <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                              {pos.naziv}
                            </span>
                            <span className="font-mono text-xs text-gray-400 dark:text-[#5f5878]">
                              ({pos.sifra})
                            </span>
                          </div>
                          {pos.glavna === 1 && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold"
                              style={{ color: ACCENT }}
                            >
                              <Star size={12} fill={ACCENT} />
                              Glavna
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500 dark:text-[#a99fc2]">
                          <MapPin size={13} className="mt-0.5 shrink-0" />
                          <span>
                            {[pos.adresa, pos.grad, pos.postanski_broj]
                              .filter(Boolean)
                              .join(", ") || "Adresa nije unesena"}
                          </span>
                        </div>

                        {pos.jib && (
                          <p className="mt-1 text-xs text-gray-400 dark:text-[#5f5878]">
                            JIB: {pos.jib}
                          </p>
                        )}

                        {pos.napomena && (
                          <p className="mt-2 text-xs italic text-gray-400 dark:text-[#5f5878]">
                            {pos.napomena}
                          </p>
                        )}
                      </div>
                    ))}
                </>
              )}

              {activeTab === "kontakti" && (
                <StanjePrazno tekst="Pregled kontakata uskoro stiže." />
              )}

              {activeTab === "telefoni" && (
                <>
                  {telefoniLoading && <StanjeUcitavanja />}
                  {telefoniError && <StanjeGreske poruka={telefoniError} />}
                  {!telefoniLoading &&
                    !telefoniError &&
                    telefoni.length === 0 && (
                      <StanjePrazno tekst="Partner nema evidentiranih telefona." />
                    )}
                  {!telefoniLoading &&
                    !telefoniError &&
                    telefoni.map((tel) => (
                      <div
                        key={tel.telefon_id}
                        className="rounded-xl border border-gray-100 dark:border-[#2d2648] p-4 bg-[#faf9fc] dark:bg-[#1e1a2d]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Phone size={15} style={{ color: PRIMARY }} />
                            <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                              {tel.broj_normalizovan}
                            </span>
                            {tel.broj_original !== tel.broj_normalizovan && (
                              <span className="text-xs text-gray-400 dark:text-[#5f5878]">
                                ({tel.broj_original})
                              </span>
                            )}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[#ede8f5] dark:bg-[#312a50]"
                              style={{ color: PRIMARY }}
                            >
                              {TIP_TELEFONA_LABEL[tel.tip]}
                            </span>
                          </div>
                          {tel.primarni === 1 && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold"
                              style={{ color: ACCENT }}
                            >
                              <Star size={12} fill={ACCENT} />
                              Primarni
                            </span>
                          )}
                        </div>

                        {tel.napomena && (
                          <p className="mt-2 text-xs italic text-gray-400 dark:text-[#5f5878]">
                            {tel.napomena}
                          </p>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL - IZMJENA PARTNERA */}
      {editPartner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editSaving) zatvoriIzmjenu();
          }}
        >
          <div
            className="w-full max-w-2xl h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#261f38] shadow-2xl overflow-hidden border-2"
            style={{ borderColor: PRIMARY }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between gap-4"
              style={{ backgroundColor: PRIMARY }}
            >
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-white" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Izmjena partnera
                  </h3>
                  <p className="text-xs text-white/70">
                    Partner #{editPartner.partner_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                disabled={editSaving}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-gray-100 dark:border-[#2d2648] bg-[#faf9fc] dark:bg-[#201a30]">
              {(
                [
                  { key: "osnovno" as const, label: "Osnovni podaci" },
                  {
                    key: "poslovnice" as const,
                    label: `Poslovnice (${editPoslovnice.length})`,
                  },
                  {
                    key: "telefoni" as const,
                    label: `Telefoni (${editTelefoni.length})`,
                  },
                ]
              ).map((tab) => {
                const aktivanTab = editTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setEditTab(tab.key)}
                    className="px-4 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    style={{
                      color: aktivanTab ? PRIMARY : undefined,
                      borderColor: aktivanTab ? ACCENT : "transparent",
                    }}
                  >
                    <span
                      className={
                        aktivanTab
                          ? ""
                          : "text-gray-500 dark:text-[#8a80a3]"
                      }
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-3">
              {editTab === "osnovno" && (
                <>
              {editError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
                  <AlertTriangle size={14} />
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Naziv partnera *">
                  <input
                    type="text"
                    value={editForm.naziv}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, naziv: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Tip partnera">
                  <select
                    value={editForm.tipPartnera}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        tipPartnera: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="kupac">Kupac</option>
                    <option value="dobavljac">Dobavljač</option>
                    <option value="oba">Oba</option>
                  </select>
                </Field>
                <Field label="JIB">
                  <input
                    type="text"
                    value={editForm.jib}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, jib: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="PIB">
                  <input
                    type="text"
                    value={editForm.pib}
                    onChange={(e) => {
                      const vrijednost = e.target.value;
                      setEditForm((f) => ({
                        ...f,
                        pib: vrijednost,
                        pdvObveznik: /^\d{12}$/.test(vrijednost.trim()),
                      }));
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="Adresa">
                  <input
                    type="text"
                    value={editForm.adresa}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, adresa: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Država">
                  <select
                    value={editForm.sifraDrzave}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sifraDrzave: e.target.value,
                        sifraGrada: "",
                      }))
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
                    value={editForm.sifraGrada}
                    onChange={(e) => {
                      const izabrani = gradovi.find(
                        (g) => String(g.sifra_grada) === e.target.value,
                      );
                      setEditForm((f) => ({
                        ...f,
                        sifraGrada: e.target.value,
                        postanskiBroj: izabrani?.ptt ?? f.postanskiBroj,
                      }));
                    }}
                    disabled={!editForm.sifraDrzave}
                    className={inputClass}
                  >
                    <option value="">
                      {!editForm.sifraDrzave
                        ? "-- Prvo izaberi državu --"
                        : "-- Izaberi grad --"}
                    </option>
                    {gradovi
                      .filter(
                        (g) => String(g.sifra_drzave) === editForm.sifraDrzave,
                      )
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
                    value={editForm.postanskiBroj}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        postanskiBroj: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Valuta plaćanja (dana)">
                  <input
                    type="number"
                    value={editForm.valutaPlacanja}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        valutaPlacanja: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Limit duga">
                  <input
                    type="number"
                    value={editForm.limitDuga}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, limitDuga: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Rabat (%)">
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.rabatProcenat}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        rabatProcenat: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Radnik (komercijalista)">
                  <select
                    value={editForm.sifraKomercijaliste}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sifraKomercijaliste: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">-- Nije dodijeljen --</option>
                    {komercijalisti.map((k) => (
                      <option key={k.sifra_radnika} value={k.sifra_radnika}>
                        {k.naziv_radnika}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={editForm.aktivan ? "1" : "0"}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        aktivan: e.target.value === "1",
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="1">Aktivan</option>
                    <option value="0">Neaktivan</option>
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8] pt-1">
                <input
                  type="checkbox"
                  checked={editForm.pdvObveznik}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      pdvObveznik: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded"
                  style={{ accentColor: PRIMARY }}
                />
                PDV obveznik
              </label>
                </>
              )}

              {editTab === "poslovnice" && (
                <>
                  {poslovnicaGreska && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
                      <AlertTriangle size={14} />
                      {poslovnicaGreska}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={dodajPraznuPoslovnicu}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                    style={{ background: "#ede8f5", color: PRIMARY }}
                  >
                    <Building2 size={13} />
                    Dodaj poslovnicu
                  </button>

                  {editPoslovniceLoading && <StanjeUcitavanja />}
                  {editPoslovniceError && (
                    <StanjeGreske poruka={editPoslovniceError} />
                  )}
                  {!editPoslovniceLoading &&
                    !editPoslovniceError &&
                    editPoslovnice.length === 0 && (
                      <StanjePrazno tekst="Partner nema evidentiranih poslovnica." />
                    )}

                  {!editPoslovniceLoading &&
                    editPoslovnice.map((pos, indeks) => {
                      const jeNovo = !pos.poslovnica_id;
                      const jeUEditu = poslovnicaEditIndeksi.has(indeks);
                      const prikaziFormu = jeNovo || jeUEditu;
                      const gradNaziv = gradovi.find(
                        (g) => String(g.sifra_grada) === pos.sifraGrada,
                      )?.naziv_grada;

                      return (
                        <div
                          key={pos.poslovnica_id ?? `nova-${indeks}`}
                          className="rounded-xl p-3 space-y-2 transition-colors border-2"
                          style={{
                            borderColor: jeUEditu
                              ? "#f59e0b"
                              : jeNovo
                                ? "#d1d5db"
                                : PRIMARY,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498]">
                              {pos.poslovnica_id
                                ? `Poslovnica #${pos.poslovnica_id}${
                                    pos.sifra ? ` (šifra ${pos.sifra})` : ""
                                  }`
                                : "Nova poslovnica — šifra se dodjeljuje automatski"}
                            </span>
                            {jeNovo && (
                              <button
                                type="button"
                                onClick={() =>
                                  ukloniNesacuvanuPoslovnicu(indeks)
                                }
                                className="text-red-500 hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {prikaziFormu ? (
                            <>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <Field label="Naziv *">
                                  <input
                                    type="text"
                                    value={pos.naziv}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        naziv: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="JIB">
                                  <input
                                    type="text"
                                    value={pos.jib}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        jib: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="Adresa">
                                  <input
                                    type="text"
                                    value={pos.adresa}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        adresa: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="Država">
                                  <select
                                    value={pos.sifraDrzave}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        sifraDrzave: e.target.value,
                                        sifraGrada: "",
                                      })
                                    }
                                    className={inputClass}
                                  >
                                    <option value="">
                                      -- Izaberi državu --
                                    </option>
                                    {drzave.map((d) => (
                                      <option
                                        key={d.sifra_drzave}
                                        value={d.sifra_drzave}
                                      >
                                        {d.naziv_drzave}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Grad">
                                  <select
                                    value={pos.sifraGrada}
                                    onChange={(e) => {
                                      const izabrani = gradovi.find(
                                        (g) =>
                                          String(g.sifra_grada) ===
                                          e.target.value,
                                      );
                                      azurirajPoljePoslovnice(indeks, {
                                        sifraGrada: e.target.value,
                                        postanskiBroj:
                                          izabrani?.ptt ?? pos.postanskiBroj,
                                      });
                                    }}
                                    disabled={!pos.sifraDrzave}
                                    className={inputClass}
                                  >
                                    <option value="">
                                      {!pos.sifraDrzave
                                        ? "-- Prvo izaberi državu --"
                                        : "-- Izaberi grad --"}
                                    </option>
                                    {gradovi
                                      .filter(
                                        (g) =>
                                          String(g.sifra_drzave) ===
                                          pos.sifraDrzave,
                                      )
                                      .map((g) => (
                                        <option
                                          key={g.sifra_grada}
                                          value={g.sifra_grada}
                                        >
                                          {g.naziv_grada}
                                        </option>
                                      ))}
                                  </select>
                                </Field>
                                <Field label="Poštanski broj">
                                  <input
                                    type="text"
                                    value={pos.postanskiBroj}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        postanskiBroj: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="Napomena">
                                  <input
                                    type="text"
                                    value={pos.napomena}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        napomena: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  />
                                </Field>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
                                  <input
                                    type="checkbox"
                                    checked={pos.glavna}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        glavna: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: PRIMARY }}
                                  />
                                  Glavna poslovnica
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
                                  <input
                                    type="checkbox"
                                    checked={pos.aktivan}
                                    onChange={(e) =>
                                      azurirajPoljePoslovnice(indeks, {
                                        aktivan: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: PRIMARY }}
                                  />
                                  Aktivna
                                </label>
                                <div className="flex items-center gap-2">
                                  {jeUEditu && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        prekiniEditPoslovnice(indeks)
                                      }
                                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 dark:text-[#8a80a3] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors"
                                    >
                                      Otkaži
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void sacuvajPoslovnicu(indeks)
                                    }
                                    disabled={poslovnicaUCuvanju === indeks}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: PRIMARY }}
                                  >
                                    {poslovnicaUCuvanju === indeks && (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    )}
                                    Sačuvaj
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                                  {pos.naziv}
                                </span>
                                {pos.glavna && (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs font-semibold"
                                    style={{ color: ACCENT }}
                                  >
                                    <Star size={12} fill={ACCENT} />
                                    Glavna
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                                {[pos.adresa, gradNaziv, pos.postanskiBroj]
                                  .filter(Boolean)
                                  .join(", ") || "Adresa nije unesena"}
                              </div>
                              {pos.jib && (
                                <div className="text-xs text-gray-400 dark:text-[#5f5878]">
                                  JIB: {pos.jib}
                                </div>
                              )}
                              <div className="flex items-center justify-between pt-1">
                                <span
                                  className={`text-xs font-semibold ${
                                    pos.aktivan
                                      ? ""
                                      : "text-red-500 dark:text-red-400"
                                  }`}
                                  style={pos.aktivan ? { color: ACCENT } : undefined}
                                >
                                  {pos.aktivan ? "Aktivna" : "Neaktivna"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    pokreniEditPoslovnice(indeks)
                                  }
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                                  style={{ background: "#ede8f5", color: PRIMARY }}
                                >
                                  <Pencil size={12} />
                                  Izmijeni
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </>
              )}

              {editTab === "telefoni" && (
                <>
                  {telefonGreska && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
                      <AlertTriangle size={14} />
                      {telefonGreska}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={dodajPrazanTelefon}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                    style={{ background: "#ede8f5", color: PRIMARY }}
                  >
                    <Phone size={13} />
                    Dodaj telefon
                  </button>

                  {editTelefoniLoading && <StanjeUcitavanja />}
                  {editTelefoniError && (
                    <StanjeGreske poruka={editTelefoniError} />
                  )}
                  {!editTelefoniLoading &&
                    !editTelefoniError &&
                    editTelefoni.length === 0 && (
                      <StanjePrazno tekst="Partner nema evidentiranih telefona." />
                    )}

                  {!editTelefoniLoading &&
                    editTelefoni.map((tel, indeks) => {
                      // Legacy zapis (erp.partneri_telefoni) — samo prikaz,
                      // nema procedure za izmjenu preko kontakt-sistema.
                      const jeLegacy = !!tel.telefon_id;
                      const jeNovo = !jeLegacy && !tel.kontakt_id;
                      const jeUEditu =
                        !jeLegacy && telefonEditIndeksi.has(indeks);
                      const prikaziFormu =
                        !jeLegacy && (jeNovo || jeUEditu);
                      const poslovnicaNaziv = editPoslovnice.find(
                        (p) => String(p.poslovnica_id) === tel.poslovnicaId,
                      )?.naziv;
                      const radnikNaziv = komercijalisti.find(
                        (k) => String(k.sifra_radnika) === tel.sifraRadnika,
                      )?.naziv_radnika;

                      return (
                        <div
                          key={
                            tel.telefon_id ?? tel.kontakt_id ?? `novi-${indeks}`
                          }
                          className="rounded-xl p-3 space-y-2 transition-colors border-2"
                          style={{
                            borderColor: jeLegacy
                              ? "#d1d5db"
                              : jeUEditu
                                ? "#f59e0b"
                                : jeNovo
                                  ? "#d1d5db"
                                  : PRIMARY,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 dark:text-[#7d7498]">
                              {jeLegacy
                                ? `Telefon #${tel.telefon_id} (stari zapis)`
                                : tel.kontakt_id
                                  ? `Kontakt #${tel.kontakt_id}`
                                  : "Novi telefon"}
                            </span>
                            {jeNovo && (
                              <button
                                type="button"
                                onClick={() => ukloniNesacuvaniTelefon(indeks)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {jeLegacy && (
                            <>
                              <div className="flex items-center gap-2">
                                <Phone size={14} style={{ color: PRIMARY }} />
                                <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                                  {tel.broj}
                                </span>
                                {tel.primarni && (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs font-semibold"
                                    style={{ color: ACCENT }}
                                  >
                                    <Star size={12} fill={ACCENT} />
                                    Primarni
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                                {TIP_TELEFONA_LABEL[tel.tip as Telefon["tip"]] ??
                                  tel.tip}
                                {poslovnicaNaziv ? ` — ${poslovnicaNaziv}` : ""}
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span
                                  className={`text-xs font-semibold ${
                                    tel.aktivan
                                      ? ""
                                      : "text-red-500 dark:text-red-400"
                                  }`}
                                  style={
                                    tel.aktivan ? { color: ACCENT } : undefined
                                  }
                                >
                                  {tel.aktivan ? "Aktivan" : "Neaktivan"}
                                </span>
                                <span className="text-xs italic text-gray-400 dark:text-[#5f5878]">
                                  Izmjena nije podržana
                                </span>
                              </div>
                            </>
                          )}

                          {!jeLegacy && !prikaziFormu && (
                            <>
                              <div className="flex items-center gap-2">
                                <Phone size={14} style={{ color: PRIMARY }} />
                                <span className="font-semibold text-sm text-gray-800 dark:text-[#ede9f6]">
                                  {tel.broj}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-[#a99fc2]">
                                {radnikNaziv ?? "Nepoznat radnik"}
                                {poslovnicaNaziv ? ` — ${poslovnicaNaziv}` : ""}
                              </div>
                              {tel.opis && (
                                <div className="text-xs text-gray-400 dark:text-[#5f5878] italic">
                                  {tel.opis}
                                </div>
                              )}
                              <div className="flex items-center justify-between pt-1">
                                <span
                                  className={`text-xs font-semibold ${
                                    tel.aktivan
                                      ? ""
                                      : "text-red-500 dark:text-red-400"
                                  }`}
                                  style={
                                    tel.aktivan ? { color: ACCENT } : undefined
                                  }
                                >
                                  {tel.aktivan ? "Aktivan" : "Neaktivan"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => pokreniEditTelefona(indeks)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                                  style={{ background: "#ede8f5", color: PRIMARY }}
                                >
                                  <Pencil size={12} />
                                  Izmijeni
                                </button>
                              </div>
                            </>
                          )}

                          {prikaziFormu && (
                            <>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <Field label="Broj telefona *">
                                  <input
                                    type="text"
                                    value={tel.broj}
                                    onChange={(e) =>
                                      azurirajPoljeTelefona(indeks, {
                                        broj: e.target.value,
                                      })
                                    }
                                    placeholder="+387 65 123 456"
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="Radnik *">
                                  <select
                                    value={tel.sifraRadnika}
                                    onChange={(e) =>
                                      azurirajPoljeTelefona(indeks, {
                                        sifraRadnika: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  >
                                    <option value="">
                                      -- Izaberi radnika --
                                    </option>
                                    {komercijalisti.map((k) => (
                                      <option
                                        key={k.sifra_radnika}
                                        value={k.sifra_radnika}
                                      >
                                        {k.naziv_radnika}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Poslovnica">
                                  <select
                                    value={tel.poslovnicaId}
                                    onChange={(e) =>
                                      azurirajPoljeTelefona(indeks, {
                                        poslovnicaId: e.target.value,
                                      })
                                    }
                                    className={inputClass}
                                  >
                                    <option value="">-- Nema --</option>
                                    {editPoslovnice
                                      .filter((p) => p.poslovnica_id)
                                      .map((p) => (
                                        <option
                                          key={p.poslovnica_id}
                                          value={p.poslovnica_id}
                                        >
                                          {p.sifra}{" "}
                                          {p.naziv ? `— ${p.naziv}` : ""}
                                        </option>
                                      ))}
                                  </select>
                                </Field>
                                <Field label="Opis">
                                  <input
                                    type="text"
                                    value={tel.opis}
                                    onChange={(e) =>
                                      azurirajPoljeTelefona(indeks, {
                                        opis: e.target.value,
                                      })
                                    }
                                    placeholder="Osoba zadužena za narudžbe"
                                    className={inputClass}
                                  />
                                </Field>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[#c5bfd8]">
                                  <input
                                    type="checkbox"
                                    checked={tel.aktivan}
                                    onChange={(e) =>
                                      azurirajPoljeTelefona(indeks, {
                                        aktivan: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 rounded"
                                    style={{ accentColor: PRIMARY }}
                                  />
                                  Aktivan
                                </label>
                                <div className="flex items-center gap-2">
                                  {jeUEditu && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        prekiniEditTelefona(indeks)
                                      }
                                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 dark:text-[#8a80a3] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors"
                                    >
                                      Otkaži
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void sacuvajTelefon(indeks)}
                                    disabled={telefonUCuvanju === indeks}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: PRIMARY }}
                                  >
                                    {telefonUCuvanju === indeks && (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    )}
                                    Sačuvaj
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-[#2d2648]">
              <button
                type="button"
                onClick={zatvoriIzmjenu}
                disabled={editSaving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-[#c5bfd8] hover:bg-gray-100 dark:hover:bg-[#2d2648] transition-colors disabled:opacity-50"
              >
                {editTab === "osnovno" ? "Otkaži" : "Zatvori"}
              </button>
              {editTab === "osnovno" && (
                <button
                  type="button"
                  onClick={() => void sacuvajIzmjenu()}
                  disabled={editSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: PRIMARY }}
                >
                  {editSaving && <Loader2 size={14} className="animate-spin" />}
                  Sačuvaj izmjene
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL - USPJEŠNA IZMJENA */}
      {editUspjeh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#261f38] shadow-2xl border-2 border-gray-200 dark:border-[#2d2648] p-6">
            <div className="flex justify-center mb-3">
              <CheckCircle2 size={40} style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-[#ede9f6] text-center">
              Podaci partnera su ažurirani.
            </p>
            <div className="mt-5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setEditUspjeh(false)}
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
    </div>
  );
}
