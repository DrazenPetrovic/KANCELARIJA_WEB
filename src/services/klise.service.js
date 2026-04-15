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

export const unosKlisePodatakaOdDobavljaca = async ({
  sifra,
  placeno_dobavljacu,
  obracunata_povrsina_kod_dobavljaca,
  broj_racuna,
  datum_racuna,
  dobavljac_klisea,
}) => {
  return withConnection(async (connection) => {
    await connection.execute(
      "CALL ziralni.sp_klise_unos_podataka_od_dobavljaca(?, ?, ?, ?, ?, ?)",
      [
        parseInt(sifra),
        parseFloat(placeno_dobavljacu),
        parseFloat(obracunata_povrsina_kod_dobavljaca),
        broj_racuna,
        datum_racuna,
        dobavljac_klisea,
      ],
    );
    return { success: true };
  });
};

export const unosNaplateOdKupca = async ({ sifra, ukupno_naplaceno }) => {
  return withConnection(async (connection) => {
    await connection.execute(
      "CALL ziralni.sp_klise_unos_naplate_od_kupca(?, ?)",
      [parseInt(sifra), parseFloat(ukupno_naplaceno)],
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
