import * as RadniciService from "../services/radnici.service.js";

export const getPregledRadnika = async (req, res) => {
  try {
    const data = await RadniciService.getPregledRadnika();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled radnika error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju radnika" });
  }
};
