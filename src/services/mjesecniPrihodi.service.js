import { withConnection } from "./db.service.js";

export const getMjesecniPrihodi = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.mjesecni_prihodi_pregled(?, ?)",
      [datumOd, datumDo],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
