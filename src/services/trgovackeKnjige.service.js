import { withConnection } from "./db.service.js";

export const getTrgovackaKnjigaVeleprodaja = async (
  pocetniDatum,
  krajnjiDatum,
) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.trgovacka_knjiga_veleprodaja(?, ?)",
      [pocetniDatum, krajnjiDatum],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
