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

export const getZatvoreniRadniNalogDetalji = async (sifraRadnogNaloga) => {
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
