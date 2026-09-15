import * as KarticeService from "../services/kartice.service.js";
import * as ArtikliService from "../services/artikli.service.js";

export const getKarticaPartnera = async (req, res) => {
  try {
    const data = await KarticeService.getKarticaPartnera(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled kartice partnera error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju kartice partnera" });
  }
};

export const getKarticaProizvoda = async (req, res) => {
  try {
    const data = await ArtikliService.getKarticaProizvoda(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled kartice proizvoda error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju kartice proizvoda" });
  }
};
