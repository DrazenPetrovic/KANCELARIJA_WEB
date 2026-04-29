import { withConnection } from "./db.service.js";

export const getArtikli = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_pregled_artikli()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getArtikliGrupe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_pregled_artikli_grupe()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
