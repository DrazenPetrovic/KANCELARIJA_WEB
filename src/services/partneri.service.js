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
