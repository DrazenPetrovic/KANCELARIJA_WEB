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
  0: "isplata", // Dugovanja kupcu
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
