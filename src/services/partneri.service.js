import { withConnection } from "./db.service.js";

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
