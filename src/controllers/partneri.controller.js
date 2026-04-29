import * as PartneriService from "../services/partneri.service.js";

export const getPartneriDodatneLokacije = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriDodatneLokacije();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled partnera dodatne lokacije error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju partnera dodatne lokacije" });
  }
};

export const getPartneriZaLokalnuDostavu = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriZaLokalnuDostavu();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Partneri za lokalnu dostavu error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju partnera za lokalnu dostavu" });
  }
};
