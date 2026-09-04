import { withConnection } from "./db.service.js";

export const getPregledRadnika = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_radnici_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Kompletan pregled radnika (radnik_id, sifra_radnika, naziv, lozinka,
// oznaka, vrsta radnika, status_radnika, aktivan, datumi unosa/izmjene) — za
// stranicu Radnici > Pregled radnika. erp.radnici_pregled sada čita iz NOVE
// baze (erp.radnici) — naziv procedure je ostao isti, samo joj je promijenjen
// izvor podataka.
export const getRadniciPregledSve = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.radnici_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// status_radnika (nova baza) -> zaposlenik (stara baza), za sinhronizaciju
// unosa/izmjena u staru bazu dok obje baze postoje paralelno.
// 0 Nije zaposlen -> 0 | 1 Zaposlen -> 1 | 2 Zaposleni spoljni saradnik -> 2 |
// 3 Spoljni saradnik koji više ne sarađuje -> 3 | 4 Osnivač -> -1
const mapStatusRadnikaUZaposlenik = (statusRadnika) => {
  const broj = Number(statusRadnika);
  return broj === 4 ? -1 : broj;
};

// Mapiranje JSON-a za ažuriranje stare baze (erp.racnici_azuriranje_podataka_staro)
// na osnovu podataka poslatih za novu bazu. sifra_radnika je uslov za UPDATE u
// staroj bazi — šalje se sa frontenda uz ostatak podataka samo za ovu svrhu.
const izgradiJsonAzuriranjeStareBaze = (radnik) => ({
  sifra_radnika: radnik.sifra_radnika,
  Naziv_radnika: radnik.naziv_radnika ?? null,
  Lozinka: radnik.lozinka ?? null,
  Oznaka: radnik.oznaka ?? "-",
  vrsta_radnika: radnik.vrsta_radnika ?? 0,
  zaposlenik: mapStatusRadnikaUZaposlenik(radnik.status_radnika),
});

// Ažuriranje radnika u staroj bazi (best-effort) — ako padne, ne obara
// glavno ažuriranje nove baze, greška se samo loguje. Vidi
// erp.racnici_azuriranje_podataka_staro (preimenovano iz
// erp.racnici_azuriranje_podataka).
const azurirajRadnikaUStaroj = async (connection, radnik) => {
  if (radnik.sifra_radnika == null) return null;
  const json = JSON.stringify(izgradiJsonAzuriranjeStareBaze(radnik));
  const [rows] = await connection.query(
    "CALL erp.racnici_azuriranje_podataka_staro(?)",
    [json],
  );
  const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  return Array.isArray(rezultatSet) && rezultatSet.length > 0
    ? rezultatSet[0]
    : null;
};

// Ažuriranje podataka radnika sa stranice Radnici > Pregled radnika. Primarno
// ažurira NOVU bazu preko erp.radnici_azuriranje_podataka ({ radnik_id,
// naziv_radnika, lozinka, oznaka, vrsta_radnika, status_radnika, aktivan }),
// koja vraća { broj_azuriranih: ROW_COUNT(), radnik_id }. Nakon uspjeha,
// best-effort sinhronizuje i STARU bazu preko
// erp.racnici_azuriranje_podataka_staro (potreban sifra_radnika, poslat sa
// frontenda uz ostatak podataka).
//
// NAPOMENA: ROW_COUNT() je 0 i kad je radnik_id pronađen ali nijedna
// vrijednost nije stvarno promijenjena (MySQL ne broji UPDATE koji ne mijenja
// podatke) — snimanje forme bez izmjena će zato prijaviti "nije ažuriran"
// iako radnik postoji. Ako to smeta u praksi, rješava se na strani procedure
// (npr. CLIENT_FOUND_ROWS na konekciji ili eksplicitna provjera postojanja
// reda umjesto ROW_COUNT()).
export const azurirajRadnika = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      radnik_id: podaci.radnik_id,
      naziv_radnika: podaci.naziv_radnika,
      lozinka: podaci.lozinka,
      oznaka: podaci.oznaka,
      vrsta_radnika: podaci.vrsta_radnika,
      status_radnika: podaci.status_radnika,
      aktivan: podaci.aktivan,
    });
    const [rows] = await connection.query(
      "CALL erp.radnici_azuriranje_podataka(?)",
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

    try {
      await azurirajRadnikaUStaroj(connection, podaci);
    } catch (error) {
      console.error(
        "Sinhronizacija ažuriranja radnika u staru bazu nije uspjela:",
        error,
      );
    }

    return rezultat;
  });
};

// Mapiranje JSON-a za unos u staru bazu (erp.radnici_unos_staro) na osnovu
// podataka poslatih za novu bazu. Nova baza nema prvi_prag/drugi_prag (forma
// ih više ne prikuplja), pa stara baza pri unosu uvijek dobija 0 za oba.
const izgradiJsonStaruBazu = (radnik) => ({
  Naziv_radnika: radnik.naziv_radnika ?? null,
  Lozinka: radnik.lozinka ?? null,
  Oznaka: radnik.oznaka ?? "-",
  vrsta_radnika: radnik.vrsta_radnika ?? 0,
  prvi_prag: 0,
  drugi_prag: 0,
  zaposlenik: mapStatusRadnikaUZaposlenik(radnik.status_radnika),
});

// Sinhronizacija novog radnika u staru bazu (best-effort) — ako padne, ne
// obara glavni unos u novu bazu, greška se samo loguje. Vidi
// erp.radnici_unos_staro (stara procedura je preimenovana iz erp.radnici_unos).
const unesiRadnikaUStaruBazu = async (connection, radnik) => {
  const json = JSON.stringify(izgradiJsonStaruBazu(radnik));
  const [rows] = await connection.query("CALL erp.radnici_unos_staro(?)", [
    json,
  ]);
  const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  return Array.isArray(rezultatSet) && rezultatSet.length > 0
    ? rezultatSet[0]
    : { uspjesno: true };
};

// Unos novog radnika sa stranice Radnici > Unos radnika. Primarni upis ide u
// NOVU bazu preko erp.radnici_unos ({ naziv_radnika, lozinka, oznaka,
// vrsta_radnika, status_radnika, aktivan }), koja ostaje trajno. Nakon
// uspješnog unosa, radnik se (best-effort) sinhronizuje i u STARU bazu preko
// erp.radnici_unos_staro, dok se stara baza potpuno ne ukine. Provjera da li
// radnik/oznaka već postoje se radi na frontendu (RadniciUnos.tsx) protiv
// liste iz getRadniciPregledSve.
export const unosRadnika = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      naziv_radnika: podaci.naziv_radnika,
      lozinka: podaci.lozinka,
      oznaka: podaci.oznaka,
      vrsta_radnika: podaci.vrsta_radnika,
      status_radnika: podaci.status_radnika,
      aktivan: podaci.aktivan,
    });
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

    try {
      await unesiRadnikaUStaruBazu(connection, podaci);
    } catch (error) {
      console.error(
        "Sinhronizacija radnika u staru bazu nije uspjela:",
        error,
      );
    }

    return rezultat;
  });
};

// Unos prisutnosti (jedan ili više radnika odjednom) sa stranice Radnici >
// Unos prisutnosti. Vidi erp.radnici_prisutnost_unos — prima JSON niz zapisa,
// svaki sa { sifra_radnika, datum_pocetka, datum_kraja, smjena, i tačno
// jednom od zastavica redovan_rad/prekovremeni_rad/rad_nocu/rad_praznikom/
// terenski_rad/dezurstvo/godisnji_odmor/praznik_odmor/
// privremena_nesposobnost/porodiljsko/placeno_odsustvo/neplaceno_odsustvo/
// odsustvo_bez_krivice/ostala_odsustva/sedmicni_odmor postavljenom na 1 }.
export const unosPrisutnosti = async (zapisi) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(zapisi);
    const [rows] = await connection.query(
      "CALL erp.radnici_prisutnost_unos(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { uspjesno: true };
  });
};
