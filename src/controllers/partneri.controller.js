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

export const getPartneriDodatneLokacijePregled = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriDodatneLokacijePregled();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled partnera dodatne lokacije (pregled) error:", error);
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

export const getDogovoreneCijene = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriDogovoreneCijene();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled dogovorenih cijena error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju dogovorenih cijena" });
  }
};

export const getDogovoreneCijeneOsnovno = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriDogovoreneCijeneOsnovno();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled dogovorenih cijena (osnovno) error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju dogovorenih cijena" });
  }
};

export const getKomercijalisti = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriKomercijalisti();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled komercijalista error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju komercijalista" });
  }
};

export const getDrzave = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriDrzave();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled drzava error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju država" });
  }
};

export const getGradovi = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriGradovi();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled gradova error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju gradova" });
  }
};

export const getListaSve = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriListaSve();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled partnera (lista sve) error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju partnera" });
  }
};

export const getListaPoslovnice = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriListaPoslovnice(
      req.params.id,
    );
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled poslovnica partnera error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju poslovnica" });
  }
};

export const getListaTelefoni = async (req, res) => {
  try {
    const data = await PartneriService.getPartneriListaTelefoni(
      req.params.id,
    );
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled telefona partnera error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju telefona" });
  }
};

export const createPartnerGlavni = async (req, res) => {
  try {
    const data = await PartneriService.setPartneriGlavno(req.body);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos partnera (glavni) error:", error);
    return res.status(500).json({
      success: false,
      error: error.sqlMessage || error.message || "Greška pri unosu partnera",
    });
  }
};

export const updatePartnerGlavni = async (req, res) => {
  try {
    const partnerId = Number(req.params.id);
    const data = await PartneriService.azurirajPartneriGlavno(
      partnerId,
      req.body,
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Izmjena partnera (glavni) error:", error);
    return res.status(500).json({
      success: false,
      error:
        error.sqlMessage || error.message || "Greška pri izmjeni partnera",
    });
  }
};
