import { withConnection } from "./db.service.js";

export const getBlagajnaPregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.blagajna_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getBlagajnaUplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.blagajna_uplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Isplate dobavljačima (računi) vezane za nalog blagajne preko broj_naloga.
export const getBlagajnaIsplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.blagajna_isplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Sva tri skupa se dohvataju paralelno (svaki na svojoj konekciji iz pool-a) —
// spajaju se na frontend-u preko blagajna.sifra <-> uplate.sifra_blagajne i
// blagajna.sifra <-> isplate.broj_naloga, kad operater proširi red blagajne
// da vidi njene uplate i isplate dobavljačima.
export const getBlagajnaPreglediSaUplatama = async () => {
  const [blagajne, uplate, isplate] = await Promise.all([
    getBlagajnaPregled(),
    getBlagajnaUplatePregled(),
    getBlagajnaIsplatePregled(),
  ]);
  return { blagajne, uplate, isplate };
};
