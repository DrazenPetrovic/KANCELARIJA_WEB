import { withConnection } from "./db.service.js";

// Kombinovana kartica partnera — jedan partner može biti evidentiran i kao
// kupac i kao dobavljač, pa erp.kartica_partnera_pregled vraća oba pregleda
// odjednom u JSON obliku { "kartice": [ { vrsta_kartice: 1 (KUPAC), ... },
// { vrsta_kartice: 2 (DOBAVLJAČ), ... } ] }. Ovdje se dijele na dva zasebna
// polja da frontend može nezavisno prikazati karticu kupca i karticu dobavljača.
export const getKarticaPartnera = async (partnerId) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kartica_partnera_pregled(?)",
      [partnerId],
    );

    const red =
      Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0][0] : null;
    if (!red) return { kupac: null, dobavljac: null };

    // Procedura vraća jedan red sa jednom JSON kolonom — vrijednost stiže već
    // parsirana (JSON kolona) ili kao string, zavisno od tipa kolone, pa se
    // provjerava oba slučaja.
    const sirovaVrijednost = Object.values(red)[0];
    const parsirano =
      typeof sirovaVrijednost === "string"
        ? JSON.parse(sirovaVrijednost)
        : sirovaVrijednost;

    const kartice = Array.isArray(parsirano?.kartice) ? parsirano.kartice : [];

    return {
      kupac: kartice.find((k) => Number(k.vrsta_kartice) === 1) ?? null,
      dobavljac: kartice.find((k) => Number(k.vrsta_kartice) === 2) ?? null,
    };
  });
};
