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

// Upis (zaključenje) kalkulacije — zaglavlje, stavke i vezani troškovi idu
// kao jedan JSON parametar. jsonTekst se prosljeđuje tačno kako ga je
// frontend složio (cijene sa decimalama, npr. 52.00 — vidi uJsonSaDecimalama
// u KalkulacijaUnos.tsx), bez ponovnog JSON.stringify. Procedura upisuje
// ziralni.kalkulacija_gl / kalkulacija_po / zavisan_trosak, ažurira stanje i
// cijenu u erp.artikli i ziralni.proizvodi i vraća red sa sifra_kalkulacije.
const PROCEDURA_UNOS_KALKULACIJE = "erp.kalkulacija_unos_podataka";

export const unosKalkulacije = async (jsonTekst) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      `CALL ${PROCEDURA_UNOS_KALKULACIJE}(?)`,
      [jsonTekst],
    );
    const rezultat =
      Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : [];
    return rezultat[0] ?? null;
  });
};

// Redni broj u KUF-u koji operater upisuje na fakturu dobavljača. Procedura
// broji q_kalkulacija_gl + q_kuf, pa se poziva tek nakon uspješnog upisa
// kalkulacije (nova kalkulacija je tada već uračunata). Vraća broj ili null.
// Vidi erp.kalkulacija_kuf_broj_odredjivanje.
export const getKufRedniBroj = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      "CALL erp.kalkulacija_kuf_broj_odredjivanje()",
    );
    const rezultat =
      Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : [];
    const broj = Number(rezultat[0]?.redni_broj);
    return Number.isFinite(broj) ? broj : null;
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
