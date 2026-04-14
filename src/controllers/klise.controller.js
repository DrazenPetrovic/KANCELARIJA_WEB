import * as KliseService from "../services/klise.service.js";

export const dodajKlise = async (req, res) => {
  try {
    const {
      naziv_klisea,
      lokacija_partnera,
      dimenzija_za_stampu,
      povrsina_klisea,
      cijena_klisea,
      napomena,
    } = req.body;

    if (!naziv_klisea || !lokacija_partnera || !dimenzija_za_stampu || !povrsina_klisea || !cijena_klisea) {
      return res.status(400).json({
        success: false,
        message: "Sva obavezna polja moraju biti popunjena",
      });
    }

    const result = await KliseService.dodajKlise({
      naziv_klisea,
      lokacija_partnera,
      dimenzija_za_stampu,
      povrsina_klisea,
      cijena_klisea,
      napomena,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("dodajKlise error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri dodavanju kliša",
    });
  }
};

export const getKlisePregled = async (_req, res) => {
  try {
    const result = await KliseService.getKlisePregled();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju kliša",
    });
  } catch (error) {
    console.error("getKlisePregled error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahtjeva",
    });
  }
};
