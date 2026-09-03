import * as PreglediRazniService from "../services/preglediRazni.service.js";

export const getKif = async (_req, res) => {
  try {
    const data = await PreglediRazniService.getKif();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled KIF error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju KIF-a",
    });
  }
};

export const getKuf = async (_req, res) => {
  try {
    const data = await PreglediRazniService.getKuf();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled KUF error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju KUF-a",
    });
  }
};
