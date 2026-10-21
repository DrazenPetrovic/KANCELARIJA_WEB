import { withConnection } from "./db.service.js";

// Pregled računa za period — erp.poslovanje_pregled(datum_od, datum_do).
// Vraća stavke po računu: sifra_partnera, naziv_partnera, broj_racuna,
// vrsta_racuna_novi, vrsta_racuna_pod, datum_racuna, vrednost, rabat_km,
// osnova_za_obracun_pdv, PDV, ukupno.
export const getPoslovanjePregled = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.poslovanje_pregled(?, ?)",
      [datumOd, datumDo],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};
