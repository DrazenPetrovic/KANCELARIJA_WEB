import * as KalkulacijeService from "../services/kalkulacije.service.js";

export const getKalkulacijaPojedinacna = async (req, res) => {
  try {
    const sifraKalkulacije =
      req.query.sifraKalkulacije || req.params.sifraKalkulacije;
    if (!sifraKalkulacije) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra kalkulacije je obavezna" });
    }
    const data = await KalkulacijeService.getKalkulacijaPojedinacna(
      sifraKalkulacije,
    );
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Kalkulacija nije pronađena" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled pojedinačne kalkulacije error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju kalkulacije" });
  }
};

export const getKalkulacijeGlavni = async (req, res) => {
  try {
    const data = await KalkulacijeService.getKalkulacijeGlavni();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled kalkulacija (glavni) error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju kalkulacija" });
  }
};

export const getKalkulacijeZavisniTroskovi = async (req, res) => {
  try {
    const data = await KalkulacijeService.getKalkulacijeZavisniTroskovi();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled zavisnih troškova error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju zavisnih troškova",
    });
  }
};

export const getKalkulacijeStavke = async (req, res) => {
  try {
    const data = await KalkulacijeService.getKalkulacijeStavke();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled kalkulacija (stavke) error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju stavki kalkulacija",
    });
  }
};
