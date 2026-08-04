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

export const getPregledRacunaStats = async (req, res) => {
  try {
    const data = await RacuniService.getPregledRacunaStats();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getPregledRacunaStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledRacunaGlavna = async (req, res) => {
  try {
    const granica = Number(req.query.granica);
    if (!Number.isFinite(granica)) {
      return res
        .status(400)
        .json({ success: false, message: "Parametar 'granica' je obavezan" });
    }
    const data = await RacuniService.getPregledRacunaGlavna(granica);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("getPregledRacunaGlavna error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledRacunaPozadina = async (req, res) => {
  try {
    const granica = Number(req.query.granica);
    if (!Number.isFinite(granica)) {
      return res
        .status(400)
        .json({ success: false, message: "Parametar 'granica' je obavezan" });
    }
    const data = await RacuniService.getPregledRacunaPozadina(granica);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("getPregledRacunaPozadina error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};
