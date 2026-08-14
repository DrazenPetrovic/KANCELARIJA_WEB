import { withConnection } from "./db.service.js";

export const getIzvodiPregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.izvodi_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getIzvodiUplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.izvodi_uplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Oba skupa se dohvataju paralelno (svaki na svojoj konekciji iz pool-a) —
// spajaju se na frontend-u preko izvodi.redni_broj <-> uplate.sifra_blagajne,
// kad operater proširi red izvoda da vidi njegove uplate.
export const getIzvodiPreglediSaUplatama = async () => {
  const [izvodi, uplate] = await Promise.all([
    getIzvodiPregled(),
    getIzvodiUplatePregled(),
  ]);
  return { izvodi, uplate };
};
