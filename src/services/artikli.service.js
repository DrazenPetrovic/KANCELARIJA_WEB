import { withConnection } from "./db.service.js";

export const getArtikli = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_artikli_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Potpuna lista artikala — uključuje i artikle definisane kao sirovina
// (sp_artikli_pregled ih ne vraća). Koristi se za izbor proizvoda u kartici
// proizvoda, gdje operater mora moći odabrati i sirovine. Vidi
// erp.artikli_pregled_sve.
export const getArtikliPregledSve = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.artikli_pregled_sve()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Trenutna nabavna cijena (cijena_bez) i VPC za proizvod, direktno iz
// erp.artikli — koristi se u kartici proizvoda (prikaz pored tabele). Vidi
// erp.artikli_nabavna_cijena_pregled.
export const getArtikliNabavnaCijena = async (sifraProizvoda) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_nabavna_cijena_pregled(?)",
      [sifraProizvoda],
    );
    const lista = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return lista[0] ?? null;
  });
};

export const getArtikliGrupe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_artikli_grupe_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Grupe artikala za formu "Unos artikla" (šifra + naziv grupe, 0-22). Vidi
// erp.artikli_grupe_artikala_pregled.
export const getArtikliGrupeZaUnos = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_grupe_artikala_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Jedinice mjere za formu "Unos artikla" — vraća { sifra, naziv_jm }.
// naziv_jm je tekst koji se prikazuje operateru (npr. "kg", "kom"), a sifra
// je brojčani kod koji ide u JSON za erp.artikli_unos (polje "jm"). Vidi
// erp.artikli_jedinica_mjere_pregled.
export const getJedinicaMjere = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_jedinica_mjere_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Unos novog artikla. erp.artikli_unos prima JSON sa poljima
// naziv_proizvoda, jm, kolicina_proizvoda, cijena_bez, vpc, marza,
// sirovina_da, ogranicena_marza, marza_za_kalkulaciju, grupa_proizvoda,
// vrsta, minimalna_prodajna, barkod, koristiti_za_ponudu. Šifru proizvoda
// dodjeljuje sama procedura.
export const unosArtikla = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    await connection.query("CALL erp.artikli_unos(?)", [json]);
    return { uspjesno: true };
  });
};

// Izmjena postojećeg artikla. erp.artikli_izmjene ažurira zapis na osnovu
// sifra_proizvoda (mora biti uključena u JSON), ostala polja su ista kao kod
// artikli_unos.
export const izmjenaArtikla = async (podaci) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify(podaci);
    await connection.query("CALL erp.artikli_izmjene(?)", [json]);
    return { uspjesno: true };
  });
};

// Kartica proizvoda — hronološki promet (ulaz/izlaz) sa tekućim saldom, za
// ekran "Kartica proizvoda" u meniju Pregledi > Kartice. Vidi
// erp.kartica_proizvoda_pregled.
export const getKarticaProizvoda = async (sifraProizvoda) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.kartica_proizvoda_pregled(?)",
      [sifraProizvoda],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

const normalizujKljuc = (kljuc) =>
  String(kljuc)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const procitajPolje = (obj, kandidati) => {
  if (!obj || typeof obj !== "object") return undefined;

  const trazeni = new Set(kandidati.map(normalizujKljuc));
  for (const [kljuc, vrednost] of Object.entries(obj)) {
    if (trazeni.has(normalizujKljuc(kljuc))) {
      return vrednost;
    }
  }

  return undefined;
};

// Pregled dogovorenih (posebnih) cijena partner-proizvod — potpuna lista (sa jm),
// za ekran "Ugovorene cijene" u meniju Pregledi. Vidi
// erp.artikli_dogovorene_cijene_pregled_potpun.
//
// Proceduri u SELECT-u fale/su pogrešni aliasi za dvije kolone: naziv partnera
// se vraća kao "naziv_pertnera" (tipfeler — fali "a"), a rabat_1_proc uopšte
// nema alias (IFNULL(rabat_1_proc,0)) pa stiže pod sirovim tekstom izraza kao
// imenom kolone. procitajPolje čita polje po više mogućih naziva (normalizacija
// skida sve što nije slovo/broj), da frontend uvijek dobije očekivana imena.
export const getDogovoreneCijenePregledPotpun = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_dogovorene_cijene_pregled_potpun()",
    );
    const lista = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return lista.map((red) => ({
      sifra_tbl: procitajPolje(red, ["sifra_tbl"]),
      partner_id: procitajPolje(red, ["partner_id"]),
      naziv_partnera: procitajPolje(red, ["naziv_partnera", "naziv_pertnera"]),
      proizvod_id: procitajPolje(red, ["proizvod_id"]),
      naziv_proizvoda: procitajPolje(red, ["naziv_proizvoda"]),
      jm: procitajPolje(red, ["jm"]),
      dogovorena_cijena_vpc: procitajPolje(red, ["dogovorena_cijena_vpc"]),
      dogovorena_cijena_mpc: procitajPolje(red, ["dogovorena_cijena_mpc"]),
      rabat_1_proc:
        procitajPolje(red, [
          "rabat_1_proc",
          "IFNULL(rabat_1_proc,0)",
          "rabat1proc",
        ]) ?? 0,
      sinhronizovano: procitajPolje(red, ["sinhronizovano"]),
      vreme_izmjene: procitajPolje(red, ["vreme_izmjene"]),
    }));
  });
};

// Deaktivacija ugovorene(ih) cijene partner-proizvod, za jedan ili više
// proizvoda istog partnera odjednom. erp.artikli_dogovorene_cijene_deaktiviraj
// prima JSON oblika { partner_id, proizvodi: [{ proizvod_id }, ...] }.
export const deaktivirajDogovoreneCijene = async (partnerId, proizvodIds) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({
      partner_id: partnerId,
      proizvodi: proizvodIds.map((proizvodId) => ({ proizvod_id: proizvodId })),
    });
    await connection.query(
      "CALL erp.artikli_dogovorene_cijene_deaktiviraj(?)",
      [json],
    );
    return { uspjesno: true };
  });
};
