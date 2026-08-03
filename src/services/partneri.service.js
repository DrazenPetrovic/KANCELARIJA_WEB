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
      "CALL erp.sp_pregled_partnera_razni()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const dodajPartneraRaznog = async ({ nazivPartnera, pripadaRadniku, sifraGrada }) => {
  return withConnection(async (connection) => {
    await connection.execute(
      "CALL erp.sp_partneri_dodaj_raznog(?, ?, ?)",
      [nazivPartnera, pripadaRadniku, sifraGrada],
    );

    const [redovi] = await connection.execute(
      "CALL erp.sp_pregled_partnera_razni()",
    );
    const listaRaznih = Array.isArray(redovi) && redovi.length > 0 ? redovi[0] : [];
    const noviKupac = listaRaznih.reduce(
      (najveci, p) =>
        !najveci || Number(p.sifra_partnera) > Number(najveci.sifra_partnera) ? p : najveci,
      null,
    );

    return noviKupac ?? { sifra_partnera: null, naziv_partnera: nazivPartnera, pripada_radniku: pripadaRadniku };
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

// Mapiranje JSON-a za unos u staru (LEGACY) bazu — vidi erp.sp_partneri_unos_stara_baza.
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

// Sinhronizacija novog partnera u staru (LEGACY) bazu. Vidi erp.sp_partneri_unos_stara_baza.
const unesiPartneraUStaruBazu = async (connection, partner) => {
  const json = JSON.stringify(izgradiJsonStaraBaza(partner));
  const [rows] = await connection.query(
    "CALL erp.sp_partneri_unos_stara_baza(?)",
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
// erp.sp_partner_unos.
//
// Nakon uspješnog unosa u glavnu bazu, isti partner se (best-effort) sinhronizuje
// i u staru (LEGACY) bazu — ako ta sinhronizacija padne, ne obara glavni unos
// (partner je već ispravno sačuvan u ERP-u), greška se samo loguje.
export const setPartneriGlavno = async (partner) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(partner);
    const [rows] = await connection.query("CALL erp.sp_partner_unos(?)", [
      json,
    ]);
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { uspjesno: true };

    // erp.sp_partner_unos vraća { status, poruka, partner_id } — status 0/false
    // znači da procedura nije upisala partnera (npr. duplikat, validacija, greška
    // u proceduri), ali ne baca SQL izuzetak, pa se to mora provjeriti ovdje.
    if (rezultat.status === 0 || rezultat.status === false) {
      throw new Error(rezultat.poruka || "Procedura nije uspjela da unese partnera");
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

// Dogovorene (posebne) cijene partner-proizvod — učitava se u cjelosti pri
// otvaranju forme za unos žiralnog računa i uparuje na frontendu po
// (partner_id, proizvod_id) kad se artikal dodaje na račun. Vidi
// erp.sp_partneri_dogovorene_cijene_pregled.
export const getPartneriDogovoreneCijene = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_dogovorene_cijene_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Lakša/brža varijanta gornje procedure — samo minimalna polja potrebna za
// uparivanje cijene pri dodavanju artikla na žiralni račun (sifra_tbl,
// partner_id, proizvod_id, dogovorena_cijena_vpc), bez naziva/JM/dodatnih
// polja. Vidi erp.sp_partneri_dogovorene_cijene_osnovno.
export const getPartneriDogovoreneCijeneOsnovno = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_dogovorene_cijene_osnovno()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Komercijalisti (radnici koji mogu biti zaduženi za partnera) — za padajuću
// listu pri unosu partnera. Vidi erp.sp_partneri_pregled_komercijalista.
export const getPartneriKomercijalisti = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_pregled_komercijalista()",
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
// kontakata/telefona i primarnim telefonom. Vidi erp.sp_partneri_lista_sve.
export const getPartneriListaSve = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_lista_sve()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Poslovnice jednog partnera (za prikaz detalja u pregledu partnera).
// Vidi erp.sp_partneri_lista_poslovnice.
export const getPartneriListaPoslovnice = async (partnerId) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_lista_poslovnice(?)",
      [partnerId],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Telefoni jednog partnera (za prikaz detalja u pregledu partnera).
// Vidi erp.sp_partneri_lista_telefoni.
export const getPartneriListaTelefoni = async (partnerId) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_lista_telefoni(?)",
      [partnerId],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
