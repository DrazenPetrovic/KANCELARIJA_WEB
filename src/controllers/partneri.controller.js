import * as PartneriService from "../services/partneri.service.js";

export const getPartneri = async (req, res) => {
  try {
    const data = await PartneriService.getPartneri();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled partnera error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju partnera" });
  }
};

export const getPartneriRazni = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriRazni();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled raznih kupaca error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju raznih kupaca" });
  }
};

export const createPartnerRazni = async (req, res) => {
  try {
    const { nazivPartnera, pripadaRadniku, sifraGrada } = req.body;
    if (!nazivPartnera || !pripadaRadniku || !sifraGrada) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (nazivPartnera, pripadaRadniku, sifraGrada)",
      });
    }
    const data = await PartneriService.dodajPartneraRaznog({ nazivPartnera, pripadaRadniku, sifraGrada });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Dodavanje raznog kupca error:", error);
    return res.status(500).json({ success: false, error: "Greška pri dodavanju kupca" });
  }
};

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
