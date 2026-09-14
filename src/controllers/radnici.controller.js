import * as RadniciService from "../services/radnici.service.js";

export const getRadniciPregledSve = async (req, res) => {
  try {
    const data = await RadniciService.getRadniciPregledSve();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled radnika (sve) error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju radnika" });
  }
};

export const azurirajRadnika = async (req, res) => {
  try {
    const rezultat = await RadniciService.azurirajRadnika(req.body);
    return res.json({ success: true, azurirano: true, data: rezultat });
  } catch (error) {
    console.error("Ažuriranje radnika error:", error);
    return res.status(500).json({
      success: false,
      azurirano: false,
      error: error.message || "Greška pri ažuriranju radnika",
    });
  }
};

export const dodajRadnika = async (req, res) => {
  try {
    const data = await RadniciService.unosRadnika(req.body);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos radnika error:", error);
    return res.status(500).json({
      success: false,
      error: error.sqlMessage || error.message || "Greška pri unosu radnika",
    });
  }
};

export const unosPrisutnosti = async (req, res) => {
  try {
    const data = await RadniciService.unosPrisutnosti(req.body);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos prisutnosti error:", error);
    return res.status(500).json({
      success: false,
      error:
        error.sqlMessage || error.message || "Greška pri unosu prisutnosti",
    });
  }
};

const danasnjiDatum = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getPrisutnostPoDanu = async (req, res) => {
  try {
    const datum = req.query.datum || danasnjiDatum();
    const data = await RadniciService.getPrisutnostPoDanu(datum);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled prisutnosti po danu error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju prisutnosti za dati dan",
    });
  }
};

export const getPrisutnostPristiglihRadnika = async (req, res) => {
  try {
    const data = await RadniciService.getPrisutnostPristiglihRadnika();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled pristiglih radnika error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju pristiglih radnika",
    });
  }
};
