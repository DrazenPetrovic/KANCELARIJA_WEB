import * as BlagajnaService from "../services/blagajna.service.js";

export const getBlagajnaStanje = async (req, res) => {
  try {
    const stanje = await BlagajnaService.getBlagajnaStanje();
    return res.json({ success: true, stanje });
  } catch (error) {
    console.error("getBlagajnaStanje error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Greška pri dohvatanju stanja blagajne" });
  }
};

export const otvoriBlagajnu = async (req, res) => {
  try {
    const blagajna = await BlagajnaService.otvoriBlagajnu();
    return res.json({ success: true, blagajna });
  } catch (error) {
    console.error("otvoriBlagajnu error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Greška pri otvaranju blagajne" });
  }
};

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
