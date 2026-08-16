import * as ArtikliService from "../services/artikli.service.js";

export const getArtikli = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikli();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala" });
  }
};

export const getArtikliGrupe = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikliGrupe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala grupe error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala grupe" });
  }
};

export const getDogovoreneCijenePotpun = async (req, res) => {
  try {
    const data = await ArtikliService.getDogovoreneCijenePregledPotpun();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled ugovorenih cijena error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju ugovorenih cijena" });
  }
};

export const deaktivirajDogovoreneCijene = async (req, res) => {
  try {
    const partnerId = Number(req.body?.partner_id);
    const proizvodi = req.body?.proizvodi;
    const proizvodIds = Array.isArray(proizvodi)
      ? proizvodi
          .map((p) => Number(p?.proizvod_id))
          .filter((id) => Number.isFinite(id))
      : [];

    if (!Number.isFinite(partnerId) || proizvodIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "partner_id i proizvodi su obavezni" });
    }

    await ArtikliService.deaktivirajDogovoreneCijene(partnerId, proizvodIds);
    return res.json({ success: true });
  } catch (error) {
    console.error("Deaktivacija ugovorenih cijena error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri deaktivaciji ugovorenih cijena" });
  }
};
