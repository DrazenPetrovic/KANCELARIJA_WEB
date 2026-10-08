import { withConnection } from "./db.service.js";

// Normativi (sastav) za sve proizvode odjednom — koja sirovina i u kojoj
// količini ulazi u proizvod. Koristi se u pregledu artikala da se obilježe
// proizvodi koji imaju normativ i prikaže sastav na klik. Vidi
// erp.proizvodi_normativi_za_proizvod_pregled.
export const getNormativiZaProizvod = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.proizvodi_normativi_za_proizvod_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Izmjena pojedinačne stavke normativa (po sifra_tabele). erp.proizvodi_
// normativi_za_proizvod_izmjena prima JSON sa poljima sifra_tabele,
// sifra_proizvoda, sifra_sirovine, kolicina_sirovine. Procedura ne baca SQL
// grešku za validaciju — vraća status 0 + poruku ako nešto nije u redu (npr.
// zapis sa tom sifra_tabele ne postoji), status 1 + izmijenjeni red ako je
// uspjelo.
export const izmjenaNormativa = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    const [rows] = await connection.query(
      "CALL erp.proizvodi_normativi_za_proizvod_izmjena(?)",
      [json],
    );
    const red = Array.isArray(rows) && rows.length > 0 ? rows[0][0] : null;
    if (!red || Number(red.status) !== 1) {
      throw new Error(red?.poruka || "Greška pri izmjeni normativa");
    }
    return red;
  });
};

// Unos nove stavke normativa (nova sirovina za proizvod). erp.proizvodi_
// normativi_za_proizvod_unos_pojedinacnog prima JSON sa poljima
// sifra_proizvoda, sifra_sirovine, kolicina_sirovine — šifru tabele (novog
// zapisa) dodjeljuje sama procedura. Isti status/poruka obrazac kao kod
// izmjene/brisanja.
export const unosNormativa = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    const [rows] = await connection.query(
      "CALL erp.proizvodi_normativi_za_proizvod_unos_pojedinacnog(?)",
      [json],
    );
    const red = Array.isArray(rows) && rows.length > 0 ? rows[0][0] : null;
    if (!red || Number(red.status) !== 1) {
      throw new Error(red?.poruka || "Greška pri unosu normativa");
    }
    return red;
  });
};

// Brisanje pojedinačne stavke normativa (po sifra_tabele).
// erp.proizvodi_normativi_za_proizvod_brisanje_pojedinacnog prima prost INT
// parametar (ne JSON). Isti status/poruka obrazac kao kod izmjene.
export const brisanjeStavkeNormativa = async (sifraTabele) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.proizvodi_normativi_za_proizvod_brisanje_pojedinacnog(?)",
      [sifraTabele],
    );
    const red = Array.isArray(rows) && rows.length > 0 ? rows[0][0] : null;
    if (!red || Number(red.status) !== 1) {
      throw new Error(red?.poruka || "Greška pri brisanju normativa");
    }
    return red;
  });
};
