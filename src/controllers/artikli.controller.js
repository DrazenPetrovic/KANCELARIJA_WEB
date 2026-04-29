import * as ArtikliService from "../services/artikli.service.js";

export const getArtikli = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikli();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala" });
  }
};

export const getArtikliGrupe = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikliGrupe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala grupe error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala grupe" });
  }
};
