import { withConnection } from "./db.service.js";

// MySQL DATETIME format (YYYY-MM-DD HH:MM:SS) — koristi se za "izmijenjeno"
// vrijeme koje se šalje u JSON-u proceduri (umjesto da procedura sama zove NOW()).
const trenutniDatumVrijeme = () =>
  new Date().toISOString().slice(0, 19).replace("T", " ");

export const getPartneri = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_pregled_partnera()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// erp.partneri_razni_partneri_pregled() spaja namjenske "razne" kupce
// (erp.partneri_razni_partneri, vrsta=1) sa svim aktivnim partnerima
// (erp.partneri WHERE aktivan=1, vrsta=0) — pravi partneri idu prvi
// (ORDER BY vrsta ASC), pa onda namjenski "razni" zapisi.
export const getPartneriRazni = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_razni_partneri_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const dodajPartneraRaznog = async ({
  nazivPartnera,
  pripadaRadniku,
  sifraGrada,
  nazivGrada,
}) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      naziv_partnera: nazivPartnera,
      pripada_radniku: pripadaRadniku,
      sifra_grada: sifraGrada,
      naziv_grada: nazivGrada ?? null,
    });
    const [rows] = await connection.query(
      "CALL erp.partneri_razni_partneri_unos(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { broj_unesenih: 0 };

    if (!rezultat.broj_unesenih) {
      throw new Error(rezultat.poruka || "Procedura nije unijela kupca");
    }

    // Procedura vraća samo broj unesenih redova, ne i šifru novog kupca —
    // erp.partneri_razni_partneri.sifra_partnera je auto_increment, pa se
    // uzima preko LAST_INSERT_ID() na ISTOJ konekciji odmah nakon CALL-a
    // (INSERT unutar procedure se izvršava u istoj sesiji).
    const [idRows] = await connection.query(
      "SELECT LAST_INSERT_ID() AS sifra_partnera",
    );
    const sifraPartnera = idRows[0]?.sifra_partnera ?? null;

    return {
      sifra_partnera: sifraPartnera,
      naziv_partnera: nazivPartnera,
      pripada_radniku: pripadaRadniku,
      sifra_grada: sifraGrada,
      naziv_grada: nazivGrada ?? null,
    };
  });
};

// Izmjena raznog kupca. Vidi erp.partneri_razni_partneri_izmjena — greške
// (neispravna šifra, nepostojeći kupac) stižu kao SQL izuzetak, a procedura
// vraća ažurirani red.
export const azurirajPartneraRaznog = async (
  sifraPartnera,
  { nazivPartnera, pripadaRadniku, sifraGrada, nazivGrada },
) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      sifra_partnera: sifraPartnera,
      naziv_partnera: nazivPartnera,
      pripada_radniku: pripadaRadniku,
      sifra_grada: sifraGrada,
      naziv_grada: nazivGrada ?? null,
    });
    const [rows] = await connection.query(
      "CALL erp.partneri_razni_partneri_izmjena(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    if (!Array.isArray(rezultatSet) || rezultatSet.length === 0) {
      throw new Error("Procedura nije vratila ažuriranog kupca");
    }
    return rezultatSet[0];
  });
};

export const getPartneriDodatneLokacije = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.dostava_lok_partneri_izdvojene_lokacije()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getPartneriDodatneLokacijePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_dodatne_lokacije_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getPartneriZaLokalnuDostavu = async () => {
  return withConnection(async (connection) => {
    const [partnersResult] = await connection.execute(
      "CALL erp.sp_dostava_lokalna_pregled_partnera()",
    );
    const partners =
      Array.isArray(partnersResult) && partnersResult.length > 0
        ? partnersResult[0]
        : [];

    const [lokacijeResult] = await connection.execute(
      "CALL erp.dostava_lok_partneri_izdvojene_lokacije()",
    );
    const dodatneLokacije =
      Array.isArray(lokacijeResult) && lokacijeResult.length > 0
        ? lokacijeResult[0]
        : [];

    const lokacijeMap = new Map(
      dodatneLokacije.map((lok) => [lok.sifra_partnera, lok]),
    );

    return partners.map((partner) => {
      const dodatnaLokacija = lokacijeMap.get(partner.sifra_kup);
      return dodatnaLokacija
        ? { ...partner, dodatna_lokacija: dodatnaLokacija }
        : partner;
    });
  });
};

// Mapiranje JSON-a za unos u staru (LEGACY) bazu — vidi erp.partneri_unos_stara_baza.
// maticni_broj, sifra_ranije, koristiti_u_azuriranju i sinhronizovano su konstante
// za svaki nov unos (nema odgovarajućeg polja u formi za unos partnera).
const izgradiJsonStaraBaza = (partner) => ({
  vrsta_partnera: partner.tip_partnera === "dobavljac" ? 2 : 1,
  naziv_partnera: partner.naziv ?? null,
  adresa_partnera: partner.adresa ?? null,
  sifra_grada: partner.sifra_grada ?? null,
  sifra_drzave: partner.sifra_drzave ?? null,
  JIB: partner.jib ?? null,
  pib: partner.pib ?? null,
  maticni_broj: null,
  dogovorena_valuta: partner.valuta_placanja ?? null,
  sifra_ranije: 0,
  koristiti_u_azuriranju: 1,
  pripada_radniku: partner.pripada_radniku ?? null,
  sinhronizovano: 0,
});

// Sinhronizacija novog partnera u staru (LEGACY) bazu. Vidi erp.partneri_unos_stara_baza.
const unesiPartneraUStaruBazu = async (connection, partner) => {
  const json = JSON.stringify(izgradiJsonStaraBaza(partner));
  const [rows] = await connection.query(
    "CALL erp.partneri_unos_stara_baza(?)",
    [json],
  );
  const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  return Array.isArray(rezultatSet) && rezultatSet.length > 0
    ? rezultatSet[0]
    : { uspjesno: true };
};

export const setPartneriStaraBaza = async (partner) => {
  return withConnection((connection) =>
    unesiPartneraUStaruBazu(connection, partner),
  );
};

// Novi ERP unos partnera — jedan JSON poziv unosi partnera i, opciono, njegove
// poslovnice/kontakte/telefone (sve u jednoj transakciji, sa rollback-om ako
// bilo koji dio pukne). Šifra partnera se dodjeljuje automatski. Vidi
// erp.partneri_unos_podataka.
//
// Nakon uspješnog unosa u glavnu bazu, isti partner se (best-effort) sinhronizuje
// i u staru (LEGACY) bazu — ako ta sinhronizacija padne, ne obara glavni unos
// (partner je već ispravno sačuvan u ERP-u), greška se samo loguje.
export const setPartneriGlavno = async (partner) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(partner);
    const [rows] = await connection.query(
      "CALL erp.partneri_unos_podataka(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { uspjesno: true };

    // erp.partneri_unos_podataka vraća { status, poruka, partner_id } — status 0/false
    // znači da procedura nije upisala partnera (npr. duplikat, validacija, greška
    // u proceduri), ali ne baca SQL izuzetak, pa se to mora provjeriti ovdje.
    if (rezultat.status === 0 || rezultat.status === false) {
      throw new Error(
        rezultat.poruka || "Procedura nije uspjela da unese partnera",
      );
    }

    try {
      await unesiPartneraUStaruBazu(connection, partner);
    } catch (error) {
      console.error(
        "Sinhronizacija partnera u staru (LEGACY) bazu nije uspjela:",
        error,
      );
    }

    return rezultat;
  });
};

// Sinhronizacija izmjene partnera u staru (LEGACY) bazu. erp.partneri_izmjena_podataka_staro
// ažurira po ziralni.partneri.sifra_partnera, koji je POTPUNO ODVOJENA numeracija
// od erp.partneri.partner_id (nema kolone koja ih direktno povezuje) — zato se
// prije poziva mora pronaći odgovarajući zapis u staroj bazi preko JIB-a (jedini
// pouzdan zajednički identifikator). Ako partner nema JIB ili nema zapis u staroj
// bazi (npr. kreiran nakon što je sinhronizacija pri unosu izostala), sinhronizacija
// se preskače umjesto da tiho ne uradi ništa.
const azurirajPartneraUStaruBazu = async (connection, partner) => {
  const jib = partner.jib ? String(partner.jib).trim() : "";
  if (!jib) {
    return { uspjesno: false, poruka: "Partner nema JIB — sinhronizacija sa starom bazom preskočena" };
  }

  const [postojeci] = await connection.execute(
    "SELECT sifra_partnera FROM ziralni.partneri WHERE JIB = ? LIMIT 1",
    [jib],
  );
  if (!Array.isArray(postojeci) || postojeci.length === 0) {
    return { uspjesno: false, poruka: `Partner sa JIB-om "${jib}" ne postoji u staroj bazi — sinhronizacija preskočena` };
  }
  const sifraPartneraStaro = postojeci[0].sifra_partnera;

  const json = JSON.stringify(izgradiJsonStaraBaza(partner));
  const [rows] = await connection.query(
    "CALL erp.partneri_izmjena_podataka_staro(?, ?)",
    [sifraPartneraStaro, json],
  );
  const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  return Array.isArray(rezultatSet) && rezultatSet.length > 0
    ? rezultatSet[0]
    : { uspjesno: true };
};

// Izmjena postojećeg partnera — JSON poziv ažurira osnovne podatke partnera u
// glavnoj (ERP) bazi. Vidi erp.partneri_izmjena_podataka.
//
// Nakon uspješne izmjene u glavnoj bazi, isti partner se (best-effort)
// sinhronizuje i u staru (LEGACY) bazu — ako ta sinhronizacija padne, ne
// obara glavnu izmjenu (partner je već ispravno ažuriran u ERP-u), greška se
// samo loguje.
export const azurirajPartneriGlavno = async (partnerId, partner) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ ...partner, partner_id: partnerId });
    const [rows] = await connection.query(
      "CALL erp.partneri_izmjena_podataka(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { uspjesno: true };

    // erp.partneri_izmjena_podataka vraća { status, poruka } — status 0/false
    // znači da procedura nije ažurirala partnera, ali ne baca SQL izuzetak,
    // pa se to mora provjeriti ovdje.
    if (rezultat.status === 0 || rezultat.status === false) {
      throw new Error(
        rezultat.poruka || "Procedura nije uspjela da ažurira partnera",
      );
    }

    try {
      const staroRezultat = await azurirajPartneraUStaruBazu(connection, partner);
      if (staroRezultat?.uspjesno === false) {
        console.warn(
          "Izmjena partnera nije sinhronizovana sa starom (LEGACY) bazom:",
          staroRezultat.poruka,
        );
      }
    } catch (error) {
      console.error(
        "Sinhronizacija izmjene partnera u staru (LEGACY) bazu nije uspjela:",
        error,
      );
    }

    return rezultat;
  });
};

// Dodavanje nove poslovnice postojećem partneru. Vidi erp.partneri_poslovnice_unos.
// Šifra poslovnice se dodjeljuje automatski u proceduri (sekvenca po partneru) —
// ne šalje se u JSON-u. Procedura validaciju/greške signalizuje kao SQL izuzetak
// (ne kroz status=0 polje), što već hvata kontroler.
export const dodajPoslovnicu = async (partnerId, poslovnica) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ ...poslovnica, partner_id: partnerId });
    const [rows] = await connection.query(
      "CALL erp.partneri_poslovnice_unos(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { success: true };
  });
};

// Izmjena postojeće poslovnice. Vidi erp.partneri_poslovnice_izmjena.
// partner_id dolazi iz frontend payload-a (poznat je u editPartner-u), a
// izmijenjeno se postavlja ovdje (server-side vrijeme), ne na frontend-u.
export const azurirajPoslovnicu = async (poslovnicaId, poslovnica) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      ...poslovnica,
      poslovnica_id: poslovnicaId,
      izmijenjeno: trenutniDatumVrijeme(),
    });
    const [rows] = await connection.query(
      "CALL erp.partneri_poslovnice_izmjena(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { success: true };
  });
};

// Dodavanje telefonskog kontakta postojećem partneru. Upisuje u
// erp.partneri_kontakti (NE erp.partneri_telefoni) — JSON: partner_id,
// poslovnica_id (opciono), sifra_radnika, napomena (= broj telefona),
// dodatni_podaci_opis, aktivan. Vidi erp.partneri_telefoni_unos. Greške
// (nepostojeći partner/radnik/poslovnica) stižu kao SQL izuzetak.
export const dodajTelefonPartnera = async (partnerId, telefon) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ ...telefon, partner_id: partnerId });
    const [rows] = await connection.query(
      "CALL erp.partneri_telefoni_unos(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { success: true };
  });
};

// Izmjena postojećeg kontakt-telefona. Upisuje u erp.partneri_kontakti
// (identifikator je kontakt_id, NE telefon_id iz erp.partneri_telefoni —
// to je potpuno druga tabela/numeracija). Vidi erp.partneri_telefoni_izmjena.
export const azurirajTelefonPartnera = async (kontaktId, telefon) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ ...telefon, kontakt_id: kontaktId });
    const [rows] = await connection.query(
      "CALL erp.partneri_telefoni_izmjena(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { success: true };
  });
};

// Dogovorene (posebne) cijene partner-proizvod — učitava se u cjelosti pri
// otvaranju forme za unos žiralnog računa i uparuje na frontendu po
// (partner_id, proizvod_id) kad se artikal dodaje na račun. Vidi
// erp.artikli_dogovorene_cijene_pregled.
export const getPartneriDogovoreneCijene = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_dogovorene_cijene_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Lakša/brža varijanta gornje procedure — samo minimalna polja potrebna za
// uparivanje cijene pri dodavanju artikla na žiralni račun (sifra_tbl,
// partner_id, proizvod_id, dogovorena_cijena_vpc), bez naziva/JM/dodatnih
// polja. Vidi erp.artikli_dogovorene_cijene_osnovno.
export const getPartneriDogovoreneCijeneOsnovno = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_dogovorene_cijene_osnovno()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Komercijalisti (radnici koji mogu biti zaduženi za partnera) — za padajuću
// listu pri unosu partnera. Vidi erp.partneri_pregled_komercijalista.
export const getPartneriKomercijalisti = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_pregled_komercijalista()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getPartneriDrzave = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_partneri_drzave()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Pregled svih unesenih država (i neaktivnih) — vraća
// sifra_drzave, naziv_drzave, aktivan. Vidi erp.partneri_drzave_pregled.
export const getPartneriDrzavePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_drzave_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Unos nove države — JSON { naziv_drzave, aktivan }. Vidi erp.partneri_drzave_unos.
export const unesiPartneriDrzavu = async ({ nazivDrzave, aktivan }) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      naziv_drzave: nazivDrzave,
      aktivan: aktivan ? 1 : 0,
    });
    const [rows] = await connection.query(
      "CALL erp.partneri_drzave_unos(?)",
      [json],
    );
    // Procedura vraća upisani red: { sifra_drzave, naziv_drzave, aktivan }.
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : null;

    if (!rezultat || rezultat.sifra_drzave == null) {
      throw new Error("Procedura nije unijela državu");
    }

    return rezultat;
  });
};

export const getPartneriGradovi = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_partneri_gradovi()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Pregled svih unesenih gradova (i neaktivnih) — vraća sifra_grada, naziv_grada,
// entitet, ptt, sifra_drzave, naziv_drzave, aktivan. Vidi erp.partneri_gradovi_pregled.
export const getPartneriGradoviPregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_gradovi_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Unos novog grada — JSON { naziv_grada, entitet, ptt, sifra_drzave, aktivan }.
// Vidi erp.partneri_gradovi_unos.
export const unesiPartneriGrad = async ({
  nazivGrada,
  entitet,
  ptt,
  sifraDrzave,
  aktivan,
}) => {
  return withConnection(async (connection) => {
    // Prazan entitet/PTT se izostavlja iz JSON-a: JSON null bi procedura kroz
    // JSON_UNQUOTE dobila kao tekst 'null', a nepostojeći ključ daje SQL NULL.
    const json = JSON.stringify({
      naziv_grada: nazivGrada,
      ...(entitet ? { entitet } : {}),
      ...(ptt ? { ptt } : {}),
      sifra_drzave: sifraDrzave,
      aktivan: aktivan ? 1 : 0,
    });
    const [rows] = await connection.query(
      "CALL erp.partneri_gradovi_unos(?)",
      [json],
    );
    // Procedura vraća upisani red: { sifra_grada, naziv_grada, entitet, ptt,
    // sifra_drzave, aktivan, success }.
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : null;

    if (!rezultat || Number(rezultat.success) !== 1) {
      throw new Error(rezultat?.poruka || "Procedura nije unijela grad");
    }

    return rezultat;
  });
};

// Novi ERP pregled — kompletna lista partnera sa brojačima poslovnica/
// kontakata/telefona i primarnim telefonom. Vidi erp.partneri_lista_sve.
export const getPartneriListaSve = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.partneri_lista_sve()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Poslovnice jednog partnera (za prikaz detalja u pregledu partnera).
// Vidi erp.partneri_lista_poslovnice.
export const getPartneriListaPoslovnice = async (partnerId) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_lista_poslovnice(?)",
      [partnerId],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Telefoni jednog partnera (za prikaz detalja u pregledu partnera).
// Vidi erp.partneri_lista_telefoni.
export const getPartneriListaTelefoni = async (partnerId) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_lista_telefoni(?)",
      [partnerId],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
