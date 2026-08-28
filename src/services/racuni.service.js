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

// Lista proizvoda sa "radne naloge" cijenom (proizvodna_cijena) — koristi se
// pri unosu žiralnog računa da se nabavna_cijena_proizvoda popuni stvarnom
// proizvodnom cijenom kad postoji, umjesto kataloške nabavne cijene.
export const getRacuniProizvodaRadniNalog = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_proizvoda_radni_nalog()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Trenutni dug partnera — erp.partneri_trenutni_dug_pregled(sifra_partnera),
// vraca jedan red sa kolonom "trenutni_dug" (DECIMAL(15,2)); koristi se za
// "Trenutna dugovanja partnera iznose" na štampi žiralnog računa.
export const getPartnerTrenutniDug = async (sifraPartnera) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.partneri_trenutni_dug_pregled(?)",
      [sifraPartnera],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? null;
  });
};

export const getPregledRacuna = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.sp_racuni_gl_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Dvofazno ucitavanje pregleda racuna (vidi docs/sp_racuni_gl_nit_glavna_pozadina.sql) —
// stats vraca ukupan broj i max/min sifra_tabele, na osnovu cega frontend racuna
// granicu (max - 200) i prvo ucitava "glavnu" (zadnjih ~200) pa zatim "pozadinsku"
// (sve starije) niti.
export const getPregledRacunaStats = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      "CALL erp.sp_racuni_gl_stats(@a, @b, @c)",
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? { ukupan_broj: 0, max_sifra: 0, min_sifra: 0 };
  });
};

export const getPregledRacunaGlavna = async (granica) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_gl_nit_glavna(?)",
      [granica],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getPregledRacunaPozadina = async (granica) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racuni_gl_nit_pozadina(?)",
      [granica],
    );
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
// ugovorena. Vidi erp.artikli_dogovorene_cijene_unos.
export const upisiDogovoreneCijene = async (stavke) => {
  return withConnection(async (connection) => {
    const json = JSON.stringify({ stavke });
    const [rows] = await connection.query(
      "CALL erp.artikli_dogovorene_cijene_unos(?)",
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

// Markira originalni (stornirani) račun kao storniran nakon što je storno
// zapis već uspješno upisan preko unosRacuna — vidi erp.sp_racun_storniraj
// (postavlja storniran_racun=1 na originalu). Isti obrazac kao
// azurirajFiskalnePodatke.
export const oznaciRacunStorniran = async (
  sifraTabeleOriginala,
  sifraTabeleStorna,
) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.sp_racun_storniraj(?, ?)",
      [sifraTabeleOriginala, sifraTabeleStorna],
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
