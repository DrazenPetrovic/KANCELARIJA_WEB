import * as BlagajnaService from "../services/blagajna.service.js";

export const getBlagajnaPreglediSaUplatama = async (req, res) => {
  try {
    const { blagajne, uplate, isplate } =
      await BlagajnaService.getBlagajnaPreglediSaUplatama();
    return res.json({
      success: true,
      blagajne,
      uplate,
      isplate,
      count: blagajne.length,
    });
  } catch (error) {
    console.error("Pregled blagajne error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju pregleda blagajne" });
  }
};
