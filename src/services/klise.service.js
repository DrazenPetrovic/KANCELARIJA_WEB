import { withConnection } from "./db.service.js";

export const dodajKlise = async ({
  naziv_klisea,
  lokacija_partnera,
  dimenzija_za_stampu,
  povrsina_klisea,
  cijena_klisea,
  napomena,
}) => {
  return withConnection(async (connection) => {
    await connection.execute(
      "CALL ziralni.sp_klise_dodavanje_novog(?, ?, ?, ?, ?, ?)",
      [
        naziv_klisea,
        lokacija_partnera,
        dimenzija_za_stampu,
        parseFloat(povrsina_klisea),
        parseFloat(cijena_klisea),
        napomena || null,
      ],
    );

    return { success: true };
  });
};

export const getKlisePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL ziralni.sp_klise_pregled_podataka()",
    );

    const klise = rows?.[0] || [];

    return {
      success: true,
      data: klise,
      count: klise.length,
    };
  });
};
