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
