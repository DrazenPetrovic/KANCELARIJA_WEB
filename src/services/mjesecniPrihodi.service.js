import { withConnection } from "./db.service.js";

export const getMjesecniPrihodi = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_mjesecni_prihodi(?, ?)",
      [datumOd, datumDo],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
