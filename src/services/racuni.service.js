import { withConnection } from "./db.service.js";

export const getIstorijaRacuna = async (sifraPartnera) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_gl_istorija(?)",
      [sifraPartnera],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRacunPoIstorija = async (sifraTabele) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_po_istorija(?)",
      [sifraTabele],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRacuniPodgrupe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_racuni_podgrupe()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
