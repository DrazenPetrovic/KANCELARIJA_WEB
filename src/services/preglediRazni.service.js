import { withConnection } from "./db.service.js";

export const getKif = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.kif()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getKuf = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.kuf_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
