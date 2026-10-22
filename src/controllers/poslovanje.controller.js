import * as PoslovanjeService from "../services/poslovanje.service.js";

export const getPoslovanjePregled = async (req, res) => {
  try {
    const { datumOd, datumDo } = req.query;
    if (!datumOd || !datumDo) {
      return res.status(400).json({
        success: false,
        error: "Parametri 'datumOd' i 'datumDo' su obavezni",
      });
    }
    const data = await PoslovanjeService.getPoslovanjePregled(datumOd, datumDo);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled poslovanja error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju pregleda poslovanja",
    });
  }
};

export const getPoslovanjeMjesecni = async (_req, res) => {
  try {
    const data = await PoslovanjeService.getPoslovanjeMjesecni();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Mjesečni pregled poslovanja error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju mjesečnog pregleda poslovanja",
    });
  }
};
