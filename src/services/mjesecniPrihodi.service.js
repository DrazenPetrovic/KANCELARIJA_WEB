import { withConnection } from "./db.service.js";

export const getMjesecniPrihodi = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.mjesecni_prihodi_pregled(?, ?)",
      [datumOd, datumDo],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// erp.mjesecni_prihodi_pregled ne razlikuje izvozne fakture (podgrupe sa
// obracunava_se_pdv = 1, npr. "Izvoz") od ostalih — njihova osnovica ulazi u
// ukupnu osnovicu, ali PDV je 0 (nulta stopa), pa "Osnovica x 17%" ispadne
// veće od stvarnog PDV-a. Ovaj upit izdvaja samo te fakture radi prikaza u
// rekapitulaciji, da operater zna zašto postoji ta razlika.
export const getMjesecniPrihodiIzvoz = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      `SELECT
          COUNT(*) AS broj_racuna,
          COALESCE(SUM(gl.Osnova_za_obracun_pdv), 0) AS osnovica,
          COALESCE(SUM(gl.ukupno), 0) AS ukupno
       FROM ziralni.q_racun_gl gl
       INNER JOIN ziralni.racuni_podgrupe p
         ON p.sifra_podgrupe = gl.vrsta_racuna_pod
       WHERE gl.datum_racuna BETWEEN ? AND ?
         AND p.obracunava_se_pdv = 1`,
      [datumOd, datumDo],
    );
    return rows[0] ?? { broj_racuna: 0, osnovica: 0, ukupno: 0 };
  });
};
