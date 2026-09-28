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

// Status izvoda po banci — za razliku od blagajne (jedan nalog), svaka banka
// ima svoj niz izvoda, pa se status čita iz zadnjeg (najvećeg redni_broj)
// izvoda svake banke iz erp.izvodi_pregled. Banke bez ijednog izvoda se
// takođe vraćaju (zadnji_izvod = null) da bi se za njih mogao otvoriti prvi.
// Tekuće uplate/isplate se uzimaju iz ukupno_uplata/ukupno_isplata samog
// izvoda (ista vrijednost koju prikazuje Pregled izvoda).
export const getIzvodiStatus = async () => {
  const [izvodi, banke] = await Promise.all([
    getIzvodiPregled(),
    getBankePregled(),
  ]);

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
    const uplate = Number(z.ukupno_uplata) || 0;
    const isplate = Number(z.ukupno_isplata) || 0;
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
      tekuci_obracun: pocetno + uplate - isplate,
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

// Otvaranje novog izvoda za banku.
// NAPOMENA: procedura erp.izvod_otvaranje(p_sifra_banke, p_sifra_izvoda,
// p_datum_izvoda) još NE postoji u bazi — treba je napraviti po uzoru na
// erp.blagajna_otvaranje(): da odbije otvaranje ako banka već ima otvoren
// izvod (SIGNAL SQLSTATE '45000'), da pocetno_stanje novog izvoda postavi na
// krajnje_stanje prethodnog izvoda te banke i da vrati novi red izvoda.
export const otvoriIzvod = async ({ sifraBanke, sifraIzvoda, datumIzvoda }) => {
  return withConnection(async (connection) => {
    let rows;
    try {
      [rows] = await connection.execute(
        "CALL erp.izvod_otvaranje(?, ?, ?)",
        [sifraBanke, sifraIzvoda, datumIzvoda],
      );
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri otvaranju izvoda",
      );
    }
    const noviIzvod = Array.isArray(rows?.[0]) ? rows[0][0] : null;
    if (!noviIzvod) {
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
// stavka mora ići na izvod koji je trenutno otvoren.
export const unosUplataIzvoda = async ({ stavke, sifraRadnika }) => {
  const izvodi = await getIzvodiPregled();
  const otvoreni = new Set(
    izvodi
      .filter((i) => Number(i.izvod_zatvoren) !== 1)
      .map((i) => String(i.redni_broj)),
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.datum_uplate ?? ""))) {
      throw new Error(`Stavka ${redBr}: neispravan datum uplate`);
    }
    if (!otvoreni.has(String(s.sifra_blagajne))) {
      throw new Error(
        `Stavka ${redBr}: izvod ${s.sifra_blagajne} nije otvoren za unos`,
      );
    }
    return {
      vrsta_uplate: vrsta,
      sifra_partnera: partner,
      datum_uplate: s.datum_uplate,
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

// Zatvaranje izvoda.
// NAPOMENA: procedura erp.izvod_zatvaranje(p_redni_broj) još NE postoji u
// bazi — ime i parametri su privremeni i usklađuju se kad procedura stigne.
export const zatvoriIzvod = async ({ redniBroj }) => {
  return withConnection(async (connection) => {
    try {
      await connection.execute("CALL erp.izvod_zatvaranje(?)", [redniBroj]);
    } catch (error) {
      throw new Error(
        error.sqlMessage || error.message || "Greška pri zatvaranju izvoda",
      );
    }
  });
};
