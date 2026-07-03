import * as NivelacijeService from "../services/nivelacije.service.js";

export const createNivelacija = async (req, res) => {
  try {
    const { datumNivelacije, ukupnoStaro, ukupnoNovo, nivelacijaRobe, stavke } = req.body;

    if (
      !datumNivelacije ||
      ukupnoStaro === undefined ||
      ukupnoNovo === undefined ||
      nivelacijaRobe === undefined ||
      !Array.isArray(stavke) ||
      stavke.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (datumNivelacije, ukupnoStaro, ukupnoNovo, nivelacijaRobe, stavke)",
      });
    }

    const data = await NivelacijeService.unosNivelacije({
      datumNivelacije,
      ukupnoStaro,
      ukupnoNovo,
      nivelacijaRobe,
      stavke,
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos nivelacije error:", error);
    return res.status(500).json({ success: false, error: "Greška pri unosu nivelacije" });
  }
};
