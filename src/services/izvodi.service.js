import { withConnection } from "./db.service.js";
import { getBankePregled } from "./banke.service.js";

export const getIzvodiPregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL erp.izvodi_pregled()");
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getIzvodiUplatePregled = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.izvodi_uplate_pregled()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

// Detalji jedne uplate (za pregled u modalu — npr. klik na stavku "UPLATA" u
// kartici partnera). Vidi erp.uplate_pregled_pojedninacnog (p_sifra_uplate) —
// naziv procedure ima tipfeler ("pojedninacnog") koji je namjerno zadržan jer
// tako glasi u bazi.
export const getUplataPojedinacna = async (sifraUplate) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.uplate_pregled_pojedninacnog(?)",
      [sifraUplate],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? null;
  });
};

// Detalji jednog ulaznog računa iz KUF-a (za pregled u modalu — npr. klik na
// stavku "KUF" u kartici partnera-dobavljača). Vidi
// erp.uplate_kuf_pregled_pojedninacno (naziv procedure ima tipfeler
// "pojedninacno" koji je namjerno zadržan jer tako glasi u bazi).
export const getKufPojedinacni = async (sifraTabele) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.uplate_kuf_pregled_pojedninacno(?)",
      [sifraTabele],
    );
    const rezultatSet = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
    return rezultatSet[0] ?? null;
  });
};

// Oba skupa se dohvataju paralelno (svaki na svojoj konekciji iz pool-a) —
// spajaju se na frontend-u preko izvodi.redni_broj <-> uplate.sifra_blagajne,
// kad operater proširi red izvoda da vidi njegove uplate.
export const getIzvodiPreglediSaUplatama = async () => {
  const [izvodi, uplate] = await Promise.all([
    getIzvodiPregled(),
    getIzvodiUplatePregled(),
  ]);
  return { izvodi, uplate };
};

// Klasifikacija stavke izvoda (red iz erp.izvodi_uplate_pregled) — mora
// ostati usklađena sa stavkaInfo/VRSTA_UPLATE u IzvodiPregled.tsx.
// Transfer (tip_stavke = TRANSFER): smjer ULAZ = uplata, IZLAZ = isplata.
// Provjereno na zatvorenim izvodima: daje iste ukupno_uplata/ukupno_isplata
// koje su upisane u ziralni.izvodi.
const TIP_UPLATE_IZVODA = {
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

const tipStavkeIzvoda = (u) => {
  if (String(u.tip_stavke ?? "").toUpperCase() === "TRANSFER") {
    return String(u.smjer ?? "").toUpperCase() === "ULAZ" ? "uplata" : "isplata";
  }
  return TIP_UPLATE_IZVODA[Number(u.vrsta_uplate)] ?? "uplata";
};

const zaokruzi = (n) => Math.round(n * 100) / 100;

// Zbir uplata/isplata po izvodu (ključ = redni_broj = uplate.sifra_blagajne).
const totaliPoIzvodu = (uplate) => {
  const mapa = new Map();
  for (const u of uplate) {
    const kljuc = String(u.sifra_blagajne);
    const t = mapa.get(kljuc) ?? { uplate: 0, isplate: 0 };
    const iznos = Number(u.uplaceno) || 0;
    if (tipStavkeIzvoda(u) === "uplata") t.uplate += iznos;
    else t.isplate += iznos;
    mapa.set(kljuc, t);
  }
  return mapa;
};

// Status izvoda po banci — za razliku od blagajne (jedan nalog), svaka banka
// ima svoj niz izvoda, pa se status čita iz zadnjeg (najvećeg redni_broj)
// izvoda svake banke iz erp.izvodi_pregled. Banke bez ijednog izvoda se
// takođe vraćaju (zadnji_izvod = null) da bi se za njih mogao otvoriti prvi.
// Uplate/isplate: kod ZATVORENOG izvoda iz ukupno_uplata/ukupno_isplata
// (upisuje ih zatvaranje); kod OTVORENOG se računaju iz stavki, jer su ta
// polja u tabeli 0 dok se izvod ne zatvori.
export const getIzvodiStatus = async () => {
  const [izvodi, banke, uplateIzvoda] = await Promise.all([
    getIzvodiPregled(),
    getBankePregled(),
    getIzvodiUplatePregled(),
  ]);
  const totali = totaliPoIzvodu(uplateIzvoda);

  const zadnjiPoBanci = new Map();
  const brojOtvorenihPoBanci = new Map();
  for (const izvod of izvodi) {
    const kljuc = String(izvod.sifra_banke);
    const trenutni = zadnjiPoBanci.get(kljuc);
    if (!trenutni || Number(izvod.redni_broj) > Number(trenutni.redni_broj)) {
      zadnjiPoBanci.set(kljuc, izvod);
    }
    if (Number(izvod.izvod_zatvoren) !== 1) {
      brojOtvorenihPoBanci.set(kljuc, (brojOtvorenihPoBanci.get(kljuc) ?? 0) + 1);
    }
  }

  const mapirajIzvod = (z) => {
    const pocetno = Number(z.pocetno_stanje) || 0;
    const otvoren = Number(z.izvod_zatvoren) !== 1;
    const izStavki = totali.get(String(z.redni_broj)) ?? {
      uplate: 0,
      isplate: 0,
    };
    const uplate = otvoren
      ? zaokruzi(izStavki.uplate)
      : Number(z.ukupno_uplata) || 0;
    const isplate = otvoren
      ? zaokruzi(izStavki.isplate)
      : Number(z.ukupno_isplata) || 0;
    return {
      redni_broj: z.redni_broj,
      sifra_izvoda: z.sifra_izvoda,
      datum_izvoda: z.datum_izvoda,
      status: Number(z.izvod_zatvoren) === 1 ? "zatvoren" : "otvoren",
      pocetno_stanje: pocetno,
      krajnje_stanje:
        z.krajnje_stanje !== null ? Number(z.krajnje_stanje) : null,
      tekuce_uplate: uplate,
      tekuce_isplate: isplate,
      tekuci_obracun: zaokruzi(pocetno + uplate - isplate),
      izvod_unos_otvoren: z.izvod_unos_otvoren,
      izvod_unos_zatvoren: z.izvod_unos_zatvoren,
    };
  };

  const poznateBanke = new Set();
  const rezultat = banke.map((b) => {
    const kljuc = String(b.sifra_banke);
    poznateBanke.add(kljuc);
    const zadnji = zadnjiPoBanci.get(kljuc);
    return {
      sifra_banke: b.sifra_banke,
      naziv_banke: b.naziv_banke,
      broj_racuna: b.broj_racuna ?? null,
      vrsta_racuna: b.vrsta_racuna ?? null,
      broj_otvorenih: brojOtvorenihPoBanci.get(kljuc) ?? 0,
      zadnji_izvod: zadnji ? mapirajIzvod(zadnji) : null,
    };
  });

  // Izvodi čija banka nije u erp.banke_pregled (npr. ugašen račun) — da se ne
  // izgubi otvoren izvod iz statusa.
  zadnjiPoBanci.forEach((zadnji, kljuc) => {
    if (poznateBanke.has(kljuc)) return;
    rezultat.push({
      sifra_banke: zadnji.sifra_banke,
      naziv_banke: zadnji.naziv_banke ?? `Banka #${zadnji.sifra_banke}`,
      broj_racuna: null,
      vrsta_racuna: zadnji.vrsta_racuna ?? null,
      broj_otvorenih: brojOtvorenihPoBanci.get(kljuc) ?? 0,
      zadnji_izvod: mapirajIzvod(zadnji),
    });
  });

  return rezultat;
};

// Otvaranje novog izvoda za banku — erp.izvodi_otvaranje_izvoda(p_json).
// JSON: { sifra_izvoda, sifra_banke, datum_izvoda, pocetno_stanje }.
// Procedura sama odbija duplikat (ista sifra_izvoda za istu banku), a
// redni_broj je AUTO_INCREMENT i vraća ga procedura. Server dodatno:
//  - ne dozvoljava novi izvod dok banka ima otvoren izvod (procedura to ne
//    provjerava),
//  - sam računa pocetno_stanje = krajnje_stanje zadnjeg izvoda te banke
//    (ne vjeruje se klijentu).
// sifra_izvoda je varchar "broj/godina" (npr. "193/2026").
export const otvoriIzvod = async ({ sifraBanke, sifraIzvoda, datumIzvoda }) => {
  const sifra = String(sifraIzvoda).trim();
  const banka = Number(sifraBanke);
  if (!Number.isInteger(banka) || banka <= 0) {
    throw new Error("Neispravna šifra banke");
  }
  if (!/^\d+\/\d{4}$/.test(sifra)) {
    throw new Error('Šifra izvoda mora biti u formatu "broj/godina" (npr. 194/2026)');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datumIzvoda))) {
    throw new Error("Neispravan datum izvoda");
  }

  const izvodiBanke = (await getIzvodiPregled()).filter(
    (i) => Number(i.sifra_banke) === banka,
  );
  const otvoren = izvodiBanke.find((i) => Number(i.izvod_zatvoren) !== 1);
  if (otvoren) {
    throw new Error(
      `Banka već ima otvoren izvod ${otvoren.sifra_izvoda} — zatvorite ga prije otvaranja novog`,
    );
  }
  if (izvodiBanke.some((i) => String(i.sifra_izvoda).trim() === sifra)) {
    throw new Error(`Izvod ${sifra} za ovu banku već postoji`);
  }

  const zadnji = izvodiBanke.reduce(
    (max, i) => (!max || Number(i.redni_broj) > Number(max.redni_broj) ? i : max),
    null,
  );
  const pocetnoStanje = zadnji
    ? Math.round((Number(zadnji.krajnje_stanje) || 0) * 100) / 100
    : 0;

  const json = {
    sifra_izvoda: sifra,
    sifra_banke: banka,
    datum_izvoda: datumIzvoda,
    pocetno_stanje: pocetnoStanje,
  };

  return withConnection(async (connection) => {
    let rows;
    try {
      [rows] = await connection.execute(
        "CALL erp.izvodi_otvaranje_izvoda(?)",
        [JSON.stringify(json)],
      );
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri otvaranju izvoda",
      );
    }
    // Procedura vraća: success, redni_broj, sifra_izvoda, sifra_banke,
    // datum_izvoda, pocetno_stanje.
    const noviIzvod = Array.isArray(rows?.[0]) ? rows[0][0] : null;
    if (!noviIzvod || Number(noviIzvod.success) !== 1) {
      throw new Error(
        "Otvaranje izvoda nije uspjelo — procedura nije vratila novi izvod",
      );
    }
    return noviIzvod;
  });
};

// "YYYY-MM-DD HH:mm:ss" po lokalnom vremenu servera.
const sadaLokalno = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
};

// Unos uplata/isplata na izvod — sve stavke idu jednim pozivom
// erp.izvodi_uplate_unos(p_json) kao JSON niz. sifra_radnika i vreme_uplate
// postavlja server (prijavljeni operater, trenutno vrijeme) — ne vjeruje se
// onome što pošalje klijent. sifra_blagajne je redni_broj izvoda i svaka
// stavka mora ići na izvod koji je trenutno otvoren. datum_uplate se
// definiše na nivou izvoda — uvijek je datum_izvoda tog izvoda.
export const unosUplataIzvoda = async ({ stavke, sifraRadnika }) => {
  const izvodi = await getIzvodiPregled();
  // redni_broj otvorenog izvoda -> datum izvoda ("yyyy-MM-dd")
  const otvoreni = new Map(
    izvodi
      .filter((i) => Number(i.izvod_zatvoren) !== 1)
      .map((i) => [
        String(i.redni_broj),
        String(i.datum_izvoda ?? "").slice(0, 10),
      ]),
  );

  const vreme = sadaLokalno();
  const json = stavke.map((s, idx) => {
    const redBr = idx + 1;
    const vrsta = Number(s.vrsta_uplate);
    const partner = Number(s.sifra_partnera);
    const iznos = Number(s.uplaceno);
    if (!Number.isInteger(vrsta) || vrsta < 1 || vrsta > 12) {
      throw new Error(`Stavka ${redBr}: neispravna vrsta uplate`);
    }
    // -1 = nepoznat partner (dozvoljeno); inače mora biti stvarna šifra.
    if (!Number.isInteger(partner) || (partner <= 0 && partner !== -1)) {
      throw new Error(`Stavka ${redBr}: partner nije izabran`);
    }
    if (!Number.isFinite(iznos) || iznos <= 0) {
      throw new Error(`Stavka ${redBr}: iznos mora biti veći od 0`);
    }
    if (!otvoreni.has(String(s.sifra_blagajne))) {
      throw new Error(
        `Stavka ${redBr}: izvod ${s.sifra_blagajne} nije otvoren za unos`,
      );
    }
    const datumIzvoda = otvoreni.get(String(s.sifra_blagajne));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datumIzvoda)) {
      throw new Error(`Stavka ${redBr}: izvod nema ispravan datum`);
    }
    return {
      vrsta_uplate: vrsta,
      sifra_partnera: partner,
      datum_uplate: datumIzvoda,
      vreme_uplate: vreme,
      uplaceno: Math.round(iznos * 100) / 100,
      sifra_veze: Number(s.sifra_veze) || 0,
      opis: String(s.opis ?? ""),
      sifra_radnika: sifraRadnika,
      napomena: String(s.napomena ?? ""),
      // Izvod je bankovni promet — nikad gotovina.
      gotovinska_uplata: 0,
      sifra_blagajne: Number(s.sifra_blagajne),
      dozvoli_storniranje: Number(s.dozvoli_storniranje ?? 1) ? 1 : 0,
      konto_knjizenja: Number(s.konto_knjizenja) || 0,
    };
  });

  return withConnection(async (connection) => {
    let rows;
    try {
      [rows] = await connection.execute("CALL erp.izvodi_uplate_unos(?)", [
        JSON.stringify(json),
      ]);
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri unosu uplata",
      );
    }
    // Greške procedura javlja preko SIGNAL (hvata ih catch iznad); na uspjeh
    // vraća success, broj_unosa, prva_sifra_uplate, poslednja_sifra_uplate.
    const rezultat = Array.isArray(rows?.[0]) ? rows[0][0] : null;
    return {
      broj: Number(rezultat?.broj_unosa ?? json.length),
      prvaSifra: rezultat?.prva_sifra_uplate ?? null,
      posljednjaSifra: rezultat?.poslednja_sifra_uplate ?? null,
    };
  });
};

// Zatvaranje izvoda — erp.izvodi_zatvaranje_izvoda(p_json).
// JSON: { redni_broj, ukupno_uplata, ukupno_isplata, krajnje_stanje }.
// Procedura te iznose samo upisuje (UPDATE po redni_broj), pa ih server
// računa u trenutku zatvaranja iz stavki izvoda — ne uzimaju se s ekrana:
// krajnje_stanje = pocetno_stanje + ukupno_uplata - ukupno_isplata.
export const zatvoriIzvod = async ({ redniBroj }) => {
  const rb = Number(redniBroj);
  if (!Number.isInteger(rb) || rb <= 0) {
    throw new Error("Neispravan redni broj izvoda");
  }

  const [izvodi, uplateIzvoda] = await Promise.all([
    getIzvodiPregled(),
    getIzvodiUplatePregled(),
  ]);
  const izvod = izvodi.find((i) => Number(i.redni_broj) === rb);
  if (!izvod) throw new Error("Izvod nije pronađen");
  if (Number(izvod.izvod_zatvoren) === 1) {
    throw new Error(`Izvod ${izvod.sifra_izvoda} je već zatvoren`);
  }

  const t = totaliPoIzvodu(
    uplateIzvoda.filter((u) => Number(u.sifra_blagajne) === rb),
  ).get(String(rb)) ?? { uplate: 0, isplate: 0 };
  const ukupnoUplata = zaokruzi(t.uplate);
  const ukupnoIsplata = zaokruzi(t.isplate);
  const krajnjeStanje = zaokruzi(
    (Number(izvod.pocetno_stanje) || 0) + ukupnoUplata - ukupnoIsplata,
  );

  const json = {
    redni_broj: rb,
    ukupno_uplata: ukupnoUplata,
    ukupno_isplata: ukupnoIsplata,
    krajnje_stanje: krajnjeStanje,
  };

  return withConnection(async (connection) => {
    try {
      await connection.execute("CALL erp.izvodi_zatvaranje_izvoda(?)", [
        JSON.stringify(json),
      ]);
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri zatvaranju izvoda",
      );
    }
    return { sifra_izvoda: izvod.sifra_izvoda, ...json };
  });
};
