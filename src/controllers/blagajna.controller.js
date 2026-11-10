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

export const zatvoriBlagajnu = async (req, res) => {
  const krajStvarno = Number(req.body?.krajStvarno);
  if (!Number.isFinite(krajStvarno) || krajStvarno < 0) {
    return res
      .status(400)
      .json({ success: false, message: "Neispravno prebrojano stanje gotovine" });
  }
  try {
    const rezultat = await BlagajnaService.zatvoriBlagajnu({
      krajStvarno,
      potvrdiRazliku: req.body?.potvrdiRazliku === true,
    });
    if (rezultat.potrebnaPotvrda) {
      return res.status(409).json({
        success: false,
        code: "RAZLIKA",
        message: "Prebrojano stanje se razlikuje od obračunatog",
        ...rezultat,
      });
    }
    return res.json({ success: true, ...rezultat });
  } catch (error) {
    console.error("zatvoriBlagajnu error:", error);
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message || "Greška pri zatvaranju blagajne" });
  }
};

export const unosUplataBlagajne = async (req, res) => {
  const stavke = req.body?.stavke;
  if (!Array.isArray(stavke) || stavke.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Nema stavki za unos" });
  }
  const sifraRadnika = req.user?.sifraRadnika;
  if (!sifraRadnika) {
    return res
      .status(401)
      .json({ success: false, message: "Operater nije prijavljen" });
  }
  try {
    const rezultat = await BlagajnaService.unosUplataBlagajne({
      stavke,
      sifraRadnika,
    });
    return res.json({ success: true, ...rezultat });
  } catch (error) {
    console.error("unosUplataBlagajne error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Greška pri unosu uplata u blagajnu",
    });
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
