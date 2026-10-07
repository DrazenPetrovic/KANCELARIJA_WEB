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

// Trajna nivelacija više proizvoda odjednom (ekran Artikli -> Nivelacija ->
// Unos nivelacije). Cijeli dokument (zaglavlje + stavke) ide kao jedan JSON,
// vidi erp.artikli_nivelacija_unos(p_json).
export const unosNivelacijeArtikala = async (podaci) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      "CALL erp.artikli_nivelacija_unos(?)",
      [JSON.stringify(podaci)],
    );
    const rezultat = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : [];
    return rezultat[0] ?? null;
  });
};

// Zaglavlja svih nivelacija, za ekran Artikli -> Nivelacija -> Pregled.
// Vidi erp.nivelacija_gl_pregled.
export const getNivelacijeGlavni = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.nivelacija_gl_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Stavke (proizvodi) svih nivelacija — frontend ih grupiše po
// sifra_nivelacije. Vidi erp.nivelacija_po_pregled.
export const getNivelacijeStavke = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.nivelacija_po_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getNivelacijeAktivne = async () => {
  return withConnection(async (connection) => {
    // Stara procedura (koristi je i ERP program) - ne dirati.
    // const [rows] = await connection.execute("CALL erp.sp_nivelacija_aktivne()");
    const [rows] = await connection.execute("CALL erp.nivelacije_aktivne_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Poziva se nakon uspješnog unosa nivelacije (unosNivelacije) da bi se ažuriralo
// "trenutno stanje" po artiklu u erp.nivelacija_trenutna_pregled. Procedura sama
// odlučuje unos vs. deaktivaciju - ako artikal već ima aktivan zapis, deaktivira
// ga (aktivno 1 -> 0); ako nema, unosi novi.
export const azurirajTrenutnoStanje = async ({
  sifraProizvoda,
  vpcStvarna,
  vpcTrenutna,
  sifraNivelacije,
}) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.nivelacija_trenutna_stanje_azuriraj(?)",
      [
        JSON.stringify({
          sifra_proizvoda: sifraProizvoda,
          vpc_stvarna: vpcStvarna,
          vpc_trenutna: vpcTrenutna,
          sifra_nivelacije: sifraNivelacije,
        }),
      ],
    );
    const rezultat = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultat[0] ?? null;
  });
};
