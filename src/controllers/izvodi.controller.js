import * as IzvodiService from "../services/izvodi.service.js";

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
