import { withConnection } from "./db.service.js";

// Detalji jedne kalkulacije (za pregled u modalu — npr. klik na stavku
// "KALKULACIJA" u kartici partnera-dobavljača). Vidi
// erp.kalkulacija_pojedinacna_pregled (p_sifra_kalkulacije).
export const getKalkulacijaPojedinacna = async (sifraKalkulacije) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_pojedinacna_pregled(?)",
      [sifraKalkulacije],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? null;
  });
};
