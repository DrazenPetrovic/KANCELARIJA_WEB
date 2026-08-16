import { withConnection } from "./db.service.js";

export const getArtikli = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_artikli_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
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
