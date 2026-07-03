import * as GradoviService from "../services/gradovi.service.js";

export const getPregledGradova = async (req, res) => {
  try {
    const data = await GradoviService.getPregledGradova();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled gradova error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju gradova" });
  }
};
