import { withConnection } from "./db.service.js";

export const getAktivneNarudzbeGrupisano = async (sifraTerena) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.dostava_tereni_proizvodi_grupisano(?)",
      [sifraTerena],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getAktivneNarudzbe = async (sifraTerena) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.dostava_tereni_proizvodi(?)",
      [sifraTerena],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getRanijeUzimano = async (sifraPartnera, nazivPartnera) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.dostava_provjera_uzimanih_artikala_grupisano(?, ?)",
      [sifraPartnera, nazivPartnera],
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const getZadnjiDanNarudzbe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL komercijala.dostava_provjera_zadnjeg_dana_provjere_izvrsene_narudzbe()",
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  });
};

export const createNarudzba = async (narudzbaData) => {
  const {
    referentniBroj,
    sifraKupca,
    sifraTerenaDostava,
    vrstaPlacanja,
    proizvodi,
    dodatnaLokacija,
  } = narudzbaData;

  return withConnection(async (connection) => {
    try {
      await connection.beginTransaction();

      for (const proizvod of proizvodi) {
        const {
          sifraProizvoda,
          kolicina,
          napomena = "",
          trazenaCijena = 0,
        } = proizvod;
        const cleanNote = String(napomena || " ").trim() || " ";
        const finalNote = dodatnaLokacija
          ? `${cleanNote} ${dodatnaLokacija.naziv_lokacije}`.trim()
          : cleanNote;
        const poslovnaJedinicaSifra = Number(
          dodatnaLokacija?.sifra_lokacije ?? dodatnaLokacija?.sifra ?? 0,
        );

        const params = [
          sifraTerenaDostava,
          sifraKupca,
          sifraProizvoda,
          parseFloat(kolicina),
          finalNote,
          0,
          0,
          new Date(),
          vrstaPlacanja,
          0,
          0,
          0,
          referentniBroj || null,
          Number(trazenaCijena) || 0,
          Number.isFinite(poslovnaJedinicaSifra) ? poslovnaJedinicaSifra : 0,
        ];

        await connection.execute(
          `CALL komercijala.dostava_unos_podataka_teren_proizvod(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params,
        );
      }

      await connection.commit();

      return {
        referentniBroj,
        sifraKupca,
        sifraTerenaDostava,
        vrstaPlacanja,
        brojProizvoda: proizvodi.length,
        datumUnosa: new Date(),
      };
    } catch (error) {
      await connection.rollback();
      throw new Error("Greška pri unošenju narudžbe: " + error.message);
    }
  });
};

export const obrisiNarudzbuPartnera = async ({
  p_sifra_terena,
  p_sifra_partnera,
  p_referentni_broj,
}) => {
  const sifraTerena = Number(p_sifra_terena);
  const sifraPartnera = Number(p_sifra_partnera);
  const referentniBroj = String(p_referentni_broj);

  if (!Number.isFinite(sifraTerena) || !Number.isFinite(sifraPartnera)) {
    throw new Error("Parametri moraju biti validni brojevi.");
  }

  return withConnection(async (conn) => {
    await conn.query("SET @p_poruka = ''");
    await conn.query(
      "CALL komercijala.dostava_brisanje_podataka_za_partnera(?, ?, ?, @p_poruka)",
      [sifraTerena, sifraPartnera, referentniBroj],
    );
    const [[row]] = await conn.query("SELECT @p_poruka AS poruka");
    return row.poruka;
  });
};

export const obrisiNarudzbuPartneraProizvoda = async ({
  p_sifra_terena,
  p_sifra_partnera,
  p_sifra_proizvoda,
  p_referentni_broj,
}) => {
  const sifraTerena = Number(p_sifra_terena);
  const sifraPartnera = Number(p_sifra_partnera);
  const sifraProizvoda = Number(p_sifra_proizvoda);
  const referentniBroj = String(p_referentni_broj);

  if (
    !Number.isFinite(sifraTerena) ||
    !Number.isFinite(sifraPartnera) ||
    !Number.isFinite(sifraProizvoda)
  ) {
    throw new Error("Parametri moraju biti validni brojevi.");
  }

  return withConnection(async (conn) => {
    await conn.query("SET @p_poruka = ''");
    await conn.query(
      "CALL komercijala.dostava_brisanje_podataka_za_partnera_i_proizvod(?, ?, ?, ?, @p_poruka)",
      [sifraTerena, sifraPartnera, sifraProizvoda, referentniBroj],
    );
    const [[row]] = await conn.query("SELECT @p_poruka AS poruka");
    return row.poruka;
  });
};
