import { withConnection } from "./db.service.js";

export const getBlagajnaPregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.blagajna_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getBlagajnaUplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.blagajna_uplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Isplate dobavljačima (računi) vezane za nalog blagajne preko broj_naloga.
export const getBlagajnaIsplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.blagajna_isplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Sva tri skupa se dohvataju paralelno (svaki na svojoj konekciji iz pool-a) —
// spajaju se na frontend-u preko blagajna.sifra <-> uplate.sifra_blagajne i
// blagajna.sifra <-> isplate.broj_naloga, kad operater proširi red blagajne
// da vidi njene uplate i isplate dobavljačima.
export const getBlagajnaPreglediSaUplatama = async () => {
  const [blagajne, uplate, isplate] = await Promise.all([
    getBlagajnaPregled(),
    getBlagajnaUplatePregled(),
    getBlagajnaIsplatePregled(),
  ]);
  return { blagajne, uplate, isplate };
};

// Klasifikacija vrsta_uplate — mora ostati usklađena sa VRSTA_UPLATE mapom u
// BlagajnaPregled.tsx (frontend). "uplata" = novac ulazi u blagajnu,
// "isplata" = izlazi. Nepoznat kod pada na "uplata" (isto ponašanje kao frontend).
const TIP_UPLATE = {
  0: "uplata", // Dugovanja kupaca (kupac uplaćuje ranija dugovanja)
  1: "uplata", // Uplate kupaca
  2: "isplata", // Uplata dobavljačima (kalk)
  3: "isplata", // Uplata (KUF)
  4: "isplata", // Dugovanja (dobavljaču)
  5: "isplata", // Davanje pozajmice
  6: "uplata", // Vraćanje date pozajmice
  7: "uplata", // Primanje pozajmice
  8: "isplata", // Vraćanje primljene pozajmice
  9: "isplata", // Povrat pretplate dobavljaču
  10: "uplata", // Prijem pretplate (povrat od kupca)
  11: "uplata", // Prijem pretplate dobavljača
  12: "isplata", // Povrat pretplate kupcu
};
const tipUplate = (vrsta) => TIP_UPLATE[Number(vrsta)] ?? "uplata";

// Status blagajne izveden iz zadnjeg (najnovijeg) naloga u ziralni.blagajna —
// blagajna_pregled je već sortiran DESC po sifri, pa je prvi red aktuelno
// stanje. ziralni.blagajna ne razlikuje "obračunato" od "prebrojano" stanje
// (samo jedno krajnje_stanje), pa se kraj_gotovine_stvarno i razlika ne
// popunjavaju dok ta razlika ne postoji u izvornim podacima.
export const getBlagajnaStanje = async () => {
  const { blagajne, uplate, isplate } = await getBlagajnaPreglediSaUplatama();
  if (!blagajne || blagajne.length === 0) return null;

  const zadnja = blagajne[0];
  const zatvoren = Number(zadnja.nalog_zatvoren) === 1;

  const uplateZadnje = uplate.filter(
    (u) => Number(u.sifra_blagajne) === Number(zadnja.sifra),
  );
  const isplateZadnje = isplate.filter(
    (i) => Number(i.broj_naloga) === Number(zadnja.sifra),
  );

  const tekuceUplate = uplateZadnje.reduce(
    (sum, u) =>
      tipUplate(u.vrsta_uplate) === "uplata"
        ? sum + (Number(u.uplaceno) || 0)
        : sum,
    0,
  );
  const tekuceIsplateIzUplata = uplateZadnje.reduce(
    (sum, u) =>
      tipUplate(u.vrsta_uplate) === "isplata"
        ? sum + (Number(u.uplaceno) || 0)
        : sum,
    0,
  );
  const tekuceIsplateDobavljacima = isplateZadnje.reduce(
    (sum, i) => sum + (Number(i.ukupno) || 0),
    0,
  );
  const tekuceIsplate = tekuceIsplateIzUplata + tekuceIsplateDobavljacima;
  const pocetakGotovine = Number(zadnja.pocetno_stanje) || 0;

  return {
    id: zadnja.sifra,
    datum_otvaranja: zadnja.datum_otvaranja,
    datum_zatvaranja: zadnja.datum_zatvaranja,
    pocetak_gotovine: pocetakGotovine,
    kraj_gotovine_obracun:
      zadnja.krajnje_stanje !== null ? Number(zadnja.krajnje_stanje) : null,
    kraj_gotovine_stvarno: null,
    razlika: null,
    id_operatera_otvaranje: null,
    id_operatera_zatvaranje: null,
    naziv_operatera_otvaranje: null,
    naziv_operatera_zatvaranje: null,
    status: zatvoren ? "zatvorena" : "otvorena",
    tekuce_uplate: tekuceUplate,
    tekuce_isplate: tekuceIsplate,
    tekuci_obracun: pocetakGotovine + tekuceUplate - tekuceIsplate,
  };
};

// Otvaranje novog naloga blagajne. erp.blagajna_otvaranje() sama provjerava
// da li već postoji otvoren nalog (SIGNAL SQLSTATE '45000' ako da) i sama
// postavlja pocetno_stanje novog naloga na krajnje_stanje prethodnog —
// ovdje se ta vrijednost dodatno provjerava (usklađenost sa onim što mi
// vidimo kao zadnje krajnje stanje) kao provjera kontinuiteta prije
// nego se otvaranje prihvati kao uspješno.
export const otvoriBlagajnu = async () => {
  return withConnection(async (connection) => {
    const [prethodniRows] = await connection.execute(
      "CALL erp.blagajna_pregled()",
    );
    const prethodna =
      Array.isArray(prethodniRows[0]) && prethodniRows[0].length > 0
        ? prethodniRows[0][0]
        : null;
    const ocekivanoPocetno = prethodna
      ? Number(prethodna.krajnje_stanje) || 0
      : 0;

    let rows;
    try {
      [rows] = await connection.execute("CALL erp.blagajna_otvaranje()");
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri otvaranju blagajne",
      );
    }

    const novaBlagajna = Array.isArray(rows[0]) ? rows[0][0] : null;
    if (!novaBlagajna) {
      throw new Error(
        "Otvaranje blagajne nije uspjelo — procedura nije vratila novi nalog",
      );
    }

    const stvarnoPocetno = Number(novaBlagajna.pocetno_stanje) || 0;
    if (Math.abs(stvarnoPocetno - ocekivanoPocetno) > 0.01) {
      throw new Error(
        `Nalog #${novaBlagajna.sifra} je otvoren, ali početno stanje ` +
          `(${stvarnoPocetno.toFixed(2)} KM) ne odgovara krajnjem stanju ` +
          `prethodnog naloga (${ocekivanoPocetno.toFixed(2)} KM). Provjerite ziralni sistem.`,
      );
    }

    return {
      id: novaBlagajna.sifra,
      datum_otvaranja: novaBlagajna.datum_otvaranja,
      pocetak_gotovine: stvarnoPocetno,
    };
  });
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// "YYYY-MM-DD" po lokalnom vremenu servera.
const danasLokalno = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Unos uplata/isplata na otvoreni nalog blagajne — sve stavke idu jednim
// pozivom erp.blagajna_uplate_unos(p_json) kao JSON niz. Server sam
// postavlja sifra_blagajne (trenutno otvoreni nalog), datum_uplate (danas)
// i sifra_radnika (prijavljeni operater) — ne vjeruje se klijentu.
// Svaka stavka mora biti vezana za stvarnog partnera (bez -1).
// sifra_veze = sifra_tabele gotovinskog računa ili null.
export const unosUplataBlagajne = async ({ stavke, sifraRadnika }) => {
  const stanje = await getBlagajnaStanje();
  if (!stanje || stanje.status !== "otvorena") {
    const err = new Error("Blagajna nije otvorena — otvorite je u Statusu blagajne");
    err.status = 400;
    throw err;
  }

  const datum = danasLokalno();
  const json = stavke.map((s, idx) => {
    const redBr = idx + 1;
    const vrsta = Number(s.vrsta_uplate);
    const partner = Number(s.sifra_partnera);
    const iznos = Number(s.uplaceno);
    // Na unosu u blagajnu dozvoljene su samo vrste 0 i 1.
    if (vrsta !== 0 && vrsta !== 1) {
      throw new Error(`Stavka ${redBr}: vrsta uplate može biti samo 0 ili 1`);
    }
    if (!Number.isInteger(partner) || partner <= 0) {
      throw new Error(`Stavka ${redBr}: partner nije izabran`);
    }
    if (!Number.isFinite(iznos) || iznos <= 0) {
      throw new Error(`Stavka ${redBr}: iznos mora biti veći od 0`);
    }
    const veza =
      s.sifra_veze === null || s.sifra_veze === undefined || s.sifra_veze === ""
        ? null
        : Number(s.sifra_veze);
    if (veza !== null && (!Number.isInteger(veza) || veza <= 0)) {
      throw new Error(`Stavka ${redBr}: neispravna šifra veze`);
    }
    return {
      vrsta_uplate: vrsta,
      sifra_partnera: partner,
      sifra_blagajne: Number(stanje.id),
      datum_uplate: datum,
      uplaceno: round2(iznos),
      sifra_veze: veza,
      opis: String(s.opis ?? ""),
      sifra_radnika: sifraRadnika,
      napomena: String(s.napomena ?? ""),
      konto_knjizenja: Number(s.konto_knjizenja) || 0,
    };
  });

  return withConnection(async (connection) => {
    let rows;
    try {
      [rows] = await connection.execute("CALL erp.blagajna_uplate_unos(?)", [
        JSON.stringify(json),
      ]);
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri unosu uplata u blagajnu",
      );
    }
    // Na uspjeh procedura vraća: uspjesno, poruka, broj_unesenih_uplata,
    // prva_sifra_uplate, zadnja_sifra_uplate.
    const rezultat = Array.isArray(rows?.[0]) ? rows[0][0] : null;
    if (!rezultat || Number(rezultat.uspjesno) !== 1) {
      throw new Error(
        rezultat?.poruka || "Unos uplata nije uspio — procedura nije potvrdila unos",
      );
    }
    return {
      sifraBlagajne: Number(stanje.id),
      poruka: rezultat.poruka ?? null,
      broj: Number(rezultat.broj_unesenih_uplata ?? json.length),
      prvaSifra: rezultat.prva_sifra_uplate ?? null,
      posljednjaSifra: rezultat.zadnja_sifra_uplate ?? null,
    };
  });
};

// Zatvaranje otvorenog naloga blagajne. Obračunato stanje (početno + uplate
// − isplate) se računa ovdje na serveru i poredi sa prebrojanim iznosom.
// Ako se razlikuju, nalog se NE zatvara dok operater ne potvrdi razliku
// (potvrdiRazliku = true). U erp.blagajna_zatvaranje se upisuje prebrojano
// (stvarno) stanje kao krajnje_stanje.
export const zatvoriBlagajnu = async ({ krajStvarno, potvrdiRazliku }) => {
  const stanje = await getBlagajnaStanje();
  if (!stanje) {
    const err = new Error("Ne postoji nalog blagajne");
    err.status = 400;
    throw err;
  }
  if (stanje.status !== "otvorena") {
    const err = new Error(`Nalog #${stanje.id} je već zatvoren`);
    err.status = 400;
    throw err;
  }

  const obracun = round2(stanje.tekuci_obracun);
  const stvarno = round2(krajStvarno);
  const razlika = round2(stvarno - obracun);

  if (Math.abs(razlika) >= 0.01 && !potvrdiRazliku) {
    return {
      zatvoreno: false,
      potrebnaPotvrda: true,
      id: stanje.id,
      pocetno_stanje: stanje.pocetak_gotovine,
      uplate: stanje.tekuce_uplate,
      isplate: stanje.tekuce_isplate,
      obracun,
      stvarno,
      razlika,
    };
  }

  await withConnection(async (connection) => {
    try {
      await connection.execute("CALL erp.blagajna_zatvaranje(?, ?)", [
        stanje.id,
        stvarno,
      ]);
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri zatvaranju blagajne",
      );
    }
  });

  return {
    zatvoreno: true,
    potrebnaPotvrda: false,
    id: stanje.id,
    obracun,
    stvarno,
    razlika,
  };
};
