import * as TrgovackeKnjigeService from "../services/trgovackeKnjige.service.js";

export const getTrgovackaKnjigaVeleprodaja = async (req, res) => {
  try {
    const { datumOd, datumDo } = req.query;
    if (!datumOd || !datumDo) {
      return res.status(400).json({
        success: false,
        error: "Parametri 'datumOd' i 'datumDo' su obavezni",
      });
    }
    const data = await TrgovackeKnjigeService.getTrgovackaKnjigaVeleprodaja(
      datumOd,
      datumDo,
    );
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled trgovačke knjige (veleprodaja) error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju trgovačke knjige veleprodaje",
    });
  }
};
