import { withConnection } from "./db.service.js";

export const getBankePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.banke_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
