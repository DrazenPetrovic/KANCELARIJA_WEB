import { withConnection } from "./db.service.js";

export const unosNivelacije = async ({
  datumNivelacije,
  ukupnoStaro,
  ukupnoNovo,
  nivelacijaRobe,
  stavke,
}) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_nivelacija_unos(?, ?, ?, ?, ?)",
      [datumNivelacije, ukupnoStaro, ukupnoNovo, nivelacijaRobe, JSON.stringify(stavke)],
    );
    const rezultat = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultat[0] ?? null;
  });
};
