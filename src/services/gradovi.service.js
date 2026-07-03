import { withConnection } from "./db.service.js";

export const getPregledGradova = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_gradovi_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
