import * as RacuniService from "../services/racuni.service.js";

export const getPregledRacuna = async (req, res) => {
  try {
    const data = await RacuniService.getPregledRacuna();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("getPregledRacuna error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};
