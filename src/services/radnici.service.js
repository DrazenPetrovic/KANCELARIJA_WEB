import { withConnection } from "./db.service.js";

export const getPregledRadnika = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_radnici_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Kompletan pregled radnika (šifra, naziv, lozinka, oznaka, vrsta radnika,
// pragovi, status zaposlenja, sinhronizacija) — za stranicu Radnici > Pregled
// radnika. Vidi erp.radnici_pregled (izvor: ziralni.radnici).
export const getRadniciPregledSve = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.radnici_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Ažuriranje podataka radnika sa stranice Radnici > Pregled radnika (naziv,
// lozinka, oznaka, vrsta radnika, status zaposlenja). sifra_radnika u JSON-u
// je uslov za UPDATE. erp.racnici_azuriranje_podataka vraća
// { broj_azuriranih, sifra_radnika } — broj_azuriranih 0 znači da radnik sa
// tom šifrom nije pronađen/ažuriran.
export const azurirajRadnika = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    const [rows] = await connection.query(
      "CALL erp.racnici_azuriranje_podataka(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { broj_azuriranih: 0 };

    if (Number(rezultat.broj_azuriranih) < 1) {
      throw new Error("Radnik nije pronađen ili nije ažuriran");
    }

    return rezultat;
  });
};

// Unos novog radnika sa stranice Radnici > Unos radnika. Vidi erp.radnici_unos
// (Naziv_radnika, Lozinka, Oznaka, vrsta_radnika, prvi_prag, drugi_prag,
// zaposlenik). Provjera da li radnik/oznaka već postoje se radi na
// frontendu (RadniciUnos.tsx) protiv liste iz getRadniciPregledSve — ovdje se
// samo prosleđuje rezultat procedure ako ona dodatno signalizira grešku
// putem { status, poruka } (isti obrazac kao erp.sp_partner_unos).
export const unosRadnika = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    const [rows] = await connection.query("CALL erp.radnici_unos(?)", [json]);
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    const rezultat =
      Array.isArray(rezultatSet) && rezultatSet.length > 0
        ? rezultatSet[0]
        : { uspjesno: true };

    if (rezultat.status === 0 || rezultat.status === false) {
      throw new Error(
        rezultat.poruka || "Procedura nije uspjela da unese radnika",
      );
    }

    return rezultat;
  });
};
