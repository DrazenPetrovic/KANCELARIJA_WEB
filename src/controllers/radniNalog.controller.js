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

export const getZatvoreniRadniNalogDetalji = async (req, res) => {
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
