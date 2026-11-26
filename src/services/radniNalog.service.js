import { withConnection } from "./db.service.js";

export const getZatvoreniRadniNalozi = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.radni_nalog_zatvoreni_pregled()",
    );

    const nalozi = rows?.[0] || [];

    return {
      success: true,
      data: nalozi,
      count: nalozi.length,
    };
  });
};

// Magacin 1 — magacin proizvodnje (ono što je proizvodnja proizvela).
export const getMagacin1 = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.radni_nalog_magacin_1_pregled()",
    );
    const data = rows?.[0] || [];
    return { success: true, data, count: data.length };
  });
};

// Magacin 2 — aktuelni artikli (isti izvor kao kod računa), samo grupe 1 i 2.
// artikli_bez_sirovine_pregled već izbacuje sirovine (sirovina_da = 0).
export const getMagacin2 = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.artikli_bez_sirovine_pregled()",
    );
    const data = (rows?.[0] || []).filter((a) =>
      ["1", "2"].includes(String(a.grupa_proizvoda)),
    );
    return { success: true, data, count: data.length };
  });
};

// Unos radnog naloga — sve što ekran treba u jednom pozivu:
//  - sirovine: artikli sa sirovina = 1
//  - proizvodi: grupe 1 i 2, bez sirovina; uz svaki stanje_m1 (magacin 1) i ima_normativ
//  - normativi: sve stavke normativa (sastav se na frontu puni po izabranom proizvodu)
export const getUnosPodaci = async () => {
  return withConnection(async (connection) => {
    const [artRows] = await connection.execute("CALL erp.artikli_pregled_sve()");
    const [normRows] = await connection.execute(
      "CALL erp.proizvodi_normativi_za_proizvod_pregled()",
    );
    const [m1Rows] = await connection.execute(
      "CALL erp.radni_nalog_magacin_1_pregled()",
    );

    const svi = artRows?.[0] || [];
    const normativi = normRows?.[0] || [];
    const magacin1 = m1Rows?.[0] || [];

    const stanjeM1 = new Map(
      magacin1.map((m) => [String(m.sifra_proizvoda), Number(m.kolicina_proizvoda) || 0]),
    );
    const saNormativom = new Set(normativi.map((n) => String(n.sifra_proizvoda)));

    const sirovine = svi.filter((a) => Number(a.sirovina) === 1);
    const proizvodi = svi
      .filter(
        (a) =>
          Number(a.sirovina) !== 1 && ["1", "2"].includes(String(a.grupa_proizvoda)),
      )
      .map((a) => ({
        ...a,
        stanje_m1: stanjeM1.get(String(a.sifra_proizvoda)) ?? 0,
        ima_normativ: saNormativom.has(String(a.sifra_proizvoda)),
      }));

    return { success: true, sirovine, proizvodi, normativi };
  });
};

// Prenos jednog proizvoda iz magacina 1 u magacin 2.
// payload: { sifra_proizvoda, kolicina, transferna_cijena, vpc }
export const prenosMagacin1Magacin2 = async (payload) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      "CALL erp.radni_nalog_magacin_1_magacin_2_prenos(?)",
      [JSON.stringify(payload)],
    );
    return { success: true, data: rows?.[0]?.[0] ?? null };
  });
};

export const getZatvoreniRadniNalogDetalji =async (sifraRadnogNaloga) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL erp.radni_nalog_zatvoreni_detalji_pregled(?)",
      [parseInt(sifraRadnogNaloga)],
    );

    const detalji = rows?.[0] || [];

    return {
      success: true,
      data: detalji,
      count: detalji.length,
    };
  });
};
