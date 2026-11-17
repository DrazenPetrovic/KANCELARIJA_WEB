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
