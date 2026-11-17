import * as RadniNalogService from "../services/radniNalog.service.js";

export const getZatvoreniRadniNalozi = async (_req, res) => {
  try {
    const result = await RadniNalogService.getZatvoreniRadniNalozi();
    return res.json(result);
  } catch (error) {
    console.error("getZatvoreniRadniNalozi error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju zatvorenih radnih naloga",
    });
  }
};

export const getMagacin1 = async (_req, res) => {
  try {
    return res.json(await RadniNalogService.getMagacin1());
  } catch (error) {
    console.error("getMagacin1 error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju magacina 1",
    });
  }
};

export const getMagacin2 = async (_req, res) => {
  try {
    return res.json(await RadniNalogService.getMagacin2());
  } catch (error) {
    console.error("getMagacin2 error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju magacina 2",
    });
  }
};

export const getZatvoreniRadniNalogDetalji =async (req, res) => {
  try {
    const sifra = parseInt(req.params.sifra);
    if (!Number.isFinite(sifra)) {
      return res.status(400).json({
        success: false,
        message: "Neispravna šifra radnog naloga",
      });
    }

    const result = await RadniNalogService.getZatvoreniRadniNalogDetalji(sifra);
    return res.json(result);
  } catch (error) {
    console.error("getZatvoreniRadniNalogDetalji error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju detalja radnog naloga",
    });
  }
};
