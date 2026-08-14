import * as BankeService from "../services/banke.service.js";

export const getBankePregled = async (req, res) => {
  try {
    const data = await BankeService.getBankePregled();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled banaka error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju banaka" });
  }
};
