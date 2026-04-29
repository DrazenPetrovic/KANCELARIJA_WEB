import { withConnection } from "./db.service.js";

export const getTerenGrad = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.pregled_dostava_teren_grad",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getTerenPoDanima = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.pregled_aktivnih_terena_po_danima()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getTerenKupci = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.dostava_partneri()",
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0].map((k) => ({
        sifra_kupca: k.sifra_kup,
        naziv_kupca: k.Naziv_partnera,
        sifra_grada: k.sifra_grada,
        naziv_grada: k.Naziv_grada,
        vrsta_kupca: k.vrsta,
        pripada_radniku: k.pripada_radniku,
      }));
    }
    return [];
  });
};
