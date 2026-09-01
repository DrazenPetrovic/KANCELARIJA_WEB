import { withConnection } from "./db.service.js";

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
