import * as KarticeService from "../services/kartice.service.js";

export const getKarticaPartnera = async (req, res) => {
  try {
    const data = await KarticeService.getKarticaPartnera(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled kartice partnera error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju kartice partnera" });
  }
};
