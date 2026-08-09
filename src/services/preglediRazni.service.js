import { withConnection } from "./db.service.js";

export const getKif = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_kif()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
