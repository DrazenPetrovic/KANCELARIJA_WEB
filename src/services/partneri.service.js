import { withConnection } from "./db.service.js";

export const getPartneri = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_pregled_partnera()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

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

export const getPartneriGradovi = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_partneri_gradovi()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
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
