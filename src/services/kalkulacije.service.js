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

// Zaglavlja svih kalkulacija sa podacima dobavljača, za ekran "Pregled
// kalkulacija" u meniju Pregledi. Vidi erp.kalkulacija_gl_pregled.
export const getKalkulacijeGlavni = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_gl_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Zavisni troškovi (ZT) — sifra_kalkulacije je KALK na koji se trošak
// odnosi, a sifra_zavisnog_troska je šifra samog ZT dokumenta (red u
// kalkulacija_gl_pregled). Vidi erp.kalkulacija_zavisni_trosak_pregled.
export const getKalkulacijeZavisniTroskovi = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_zavisni_trosak_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Šifarnik vrsta zavisnog troška (prevoz, carinjenje, veterinarski pregled,
// takse...) za izbor pri unosu kalkulacije. Vraća sifra i
// naziv_zavisnog_troska. Vidi erp.kalkulacija_zavisan_trosak_vrste.
export const getZavisanTrosakVrste = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_zavisan_trosak_vrste()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Zadnja cijena po kojoj je proizvod ušao kroz kalkulaciju (ili početno
// stanje) — za polje "Zadnje fakturisano" pri unosu kalkulacije. Vraća
// { fakturisana_cijena, nasa_ulazna_cijena } ili null ako proizvod nikad nije
// kalkulisan. Vidi erp.kalkulacija_zadnja_cijena_proizvoda (p_sifra_artikla).
export const getZadnjaCijenaProizvoda = async (sifraProizvoda) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_zadnja_cijena_proizvoda(?)",
      [sifraProizvoda],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? null;
  });
};

// Stavke (proizvodi) svih kalkulacija — frontend ih grupiše po
// sifra_kalkulacije. Vidi erp.kalkulacija_po_pregled.
export const getKalkulacijeStavke = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kalkulacija_po_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
