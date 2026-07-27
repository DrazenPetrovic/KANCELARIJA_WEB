import { withConnection } from "./db.service.js";

export const getIstorijaRacuna = async (sifraPartnera) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_gl_istorija(?)",
      [sifraPartnera],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRacunPoIstorija = async (sifraTabele) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_po_istorija(?)",
      [sifraTabele],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRacuniPodgrupe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_racuni_podgrupe()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getPregledRacuna = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_racuni_gl_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRacunPoPregled = async (sifraTabele) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_po_pregled(?)",
      [sifraTabele],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Upis/ažuriranje dogovorenih (posebnih) cijena partner-proizvod — poziva se
// nakon čuvanja žiralnog računa, za stavke gdje je operater ručno promijenio
// VPC1 (drugačiji od kataloškog VPC-a), da se ta cijena kasnije tretira kao
// ugovorena. Vidi erp.sp_partneri_dogovorene_cijene_unos.
export const upisiDogovoreneCijene = async (stavke) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ stavke });
    const [rows] = await connection.query(
      "CALL erp.sp_partneri_dogovorene_cijene_unos(?)",
      [json],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : { uspjesno: true };
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
// erp.sp_partneri_dogovorene_cijene_pregled_potpun.
//
// Proceduri u SELECT-u fale/su pogrešni aliasi za dvije kolone: naziv partnera
// se vraća kao "naziv_pertnera" (tipfeler — fali "a"), a rabat_1_proc uopšte
// nema alias (IFNULL(rabat_1_proc,0)) pa stiže pod sirovim tekstom izraza kao
// imenom kolone. procitajPolje čita polje po više mogućih naziva (normalizacija
// skida sve što nije slovo/broj), da frontend uvijek dobije očekivana imena.
export const getDogovoreneCijenePregledPotpun = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_partneri_dogovorene_cijene_pregled_potpun()",
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

const mapirajOdgovor = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const kod = procitajPolje(obj, ["kod", "code", "status_kod", "statuskod"]);
  const poruka = procitajPolje(obj, ["poruka", "message", "msg", "opis"]);

  if (kod === undefined || poruka === undefined) {
    return null;
  }

  const sifraTabele = procitajPolje(obj, ["sifra_tabele", "sifratabele"]);
  const brojRacuna = procitajPolje(obj, ["broj_racuna", "brojracuna"]);

  return {
    kod,
    poruka,
    ...(sifraTabele !== undefined ? { sifra_tabele: sifraTabele } : {}),
    ...(brojRacuna !== undefined ? { broj_racuna: brojRacuna } : {}),
  };
};

const nadjiOdgovorProcedure = (ulaz, poseceni = new WeakSet()) => {
  if (ulaz == null) return null;

  const direktan = mapirajOdgovor(ulaz);
  if (direktan) return direktan;

  if (Array.isArray(ulaz)) {
    for (const stavka of ulaz) {
      const nadjen = nadjiOdgovorProcedure(stavka, poseceni);
      if (nadjen) return nadjen;
    }
    return null;
  }

  if (typeof ulaz === "object") {
    if (poseceni.has(ulaz)) return null;
    poseceni.add(ulaz);

    for (const vrednost of Object.values(ulaz)) {
      const nadjen = nadjiOdgovorProcedure(vrednost, poseceni);
      if (nadjen) return nadjen;
    }
  }

  return null;
};

const jeOkPacket = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const kljucevi = [
    "fieldCount",
    "affectedRows",
    "insertId",
    "info",
    "serverStatus",
    "warningStatus",
    "changedRows",
  ];
  return kljucevi.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
};

export const azurirajFiskalnePodatke = async (
  sifraTabele,
  brojFiskalnog,
  datumFiskalnog,
) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racun_azuriranje_fiskalnog(?, ?, ?)",
      [sifraTabele, brojFiskalnog, datumFiskalnog],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return Array.isArray(rezultatSet) && rezultatSet.length > 0
      ? rezultatSet[0]
      : null;
  });
};

export const unosRacuna = async (podaci) => {
  return withConnection(async (connection) => {
    try {
      const json = JSON.stringify(podaci);
      const [rows] = await connection.query("CALL erp.sp_racuni_unos(?)", [
        json,
      ]);

      const odgovor = nadjiOdgovorProcedure(rows);

      if (!odgovor && jeOkPacket(rows)) {
        const affectedRows = Number(rows.affectedRows ?? 0);
        if (!Number.isFinite(affectedRows) || affectedRows <= 0) {
          throw new Error(
            "Procedura je vratila OK paket, ali affectedRows nije veci od nule. Upis nije pouzdano potvrdjen.",
          );
        }

        odgovor = {
          kod: 0,
          poruka: rows.info || "Procedura je izvrsena (OK paket).",
          affected_rows: affectedRows,
          response_source: "ok_packet",
        };
      }

      if (!odgovor) {
        const tip = Array.isArray(rows)
          ? `array(${rows.length})`
          : rows === null
            ? "null"
            : typeof rows;
        const kljucevi =
          rows && typeof rows === "object" && !Array.isArray(rows)
            ? Object.keys(rows).join(", ") || "(nema kljuceva)"
            : "n/a";
        console.error("Svi rezultati procedure:", rows);
        throw new Error(
          `Procedura je izvrsena, ali nije vratila ocekivani odgovor (kod/poruka). Tip povrata: ${tip}. Kljucevi: ${kljucevi}.`,
        );
      }

      return odgovor;
    } catch (error) {
      console.error("Greška prilikom unosa računa:", error);
      throw error;
    }
  });
};
