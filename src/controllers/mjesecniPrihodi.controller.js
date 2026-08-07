import * as MjesecniPrihodiService from "../services/mjesecniPrihodi.service.js";

export const getMjesecniPrihodi = async (req, res) => {
  try {
    const { datumOd, datumDo } = req.query;
    if (!datumOd || !datumDo) {
      return res.status(400).json({
        success: false,
        error: "Parametri 'datumOd' i 'datumDo' su obavezni",
      });
    }
    const data = await MjesecniPrihodiService.getMjesecniPrihodi(
      datumOd,
      datumDo,
    );
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled mjesečnih prihoda error:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri učitavanju mjesečnih prihoda",
    });
  }
};
