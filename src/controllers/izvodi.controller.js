import * as IzvodiService from "../services/izvodi.service.js";

export const getUplataPojedinacna = async (req, res) => {
  try {
    const sifraUplate = req.query.sifraUplate || req.params.sifraUplate;
    if (!sifraUplate) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra uplate je obavezna" });
    }
    const data = await IzvodiService.getUplataPojedinacna(sifraUplate);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Uplata nije pronađena" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled pojedinačne uplate error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju uplate" });
  }
};

export const getKufPojedinacni = async (req, res) => {
  try {
    const sifraTabele = req.query.sifraTabele || req.params.sifraTabele;
    if (!sifraTabele) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra tabele je obavezna" });
    }
    const data = await IzvodiService.getKufPojedinacni(sifraTabele);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Stavka KUF-a nije pronađena" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled pojedinačne KUF stavke error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju KUF stavke" });
  }
};

export const getIzvodiPreglediSaUplatama = async (req, res) => {
  try {
    const { izvodi, uplate } =
      await IzvodiService.getIzvodiPreglediSaUplatama();
    return res.json({
      success: true,
      izvodi,
      uplate,
      count: izvodi.length,
    });
  } catch (error) {
    console.error("Pregled izvoda error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju pregleda izvoda" });
  }
};
