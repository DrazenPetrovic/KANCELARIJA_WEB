import * as RadniNalogService from "../services/radniNalog.service.js";

export const getZatvoreniRadniNalozi = async (_req, res) => {
  try {
    const result = await RadniNalogService.getZatvoreniRadniNalozi();
    return res.json(result);
  } catch (error) {
    console.error("getZatvoreniRadniNalozi error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju zatvorenih radnih naloga",
    });
  }
};

export const getMagacin1 = async (_req, res) => {
  try {
    return res.json(await RadniNalogService.getMagacin1());
  } catch (error) {
    console.error("getMagacin1 error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju magacina 1",
    });
  }
};

export const getMagacin2 = async (_req, res) => {
  try {
    return res.json(await RadniNalogService.getMagacin2());
  } catch (error) {
    console.error("getMagacin2 error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju magacina 2",
    });
  }
};

export const getUnosPodaci = async (_req, res) => {
  try {
    return res.json(await RadniNalogService.getUnosPodaci());
  } catch (error) {
    console.error("getUnosPodaci error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju sirovina i proizvoda",
    });
  }
};

export const prenosMagacin1Magacin2 = async (req, res) => {
  try {
    const sifra_proizvoda = parseInt(req.body?.sifra_proizvoda);
    const kolicina = Number(req.body?.kolicina);
    const transferna_cijena = Number(req.body?.transferna_cijena);
    const vpc = Number(req.body?.vpc);

    if (
      !Number.isFinite(sifra_proizvoda) ||
      !(kolicina > 0) ||
      !(transferna_cijena > 0) ||
      !(vpc > 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Neispravni podaci za prenos",
      });
    }

    const result = await RadniNalogService.prenosMagacin1Magacin2({
      sifra_proizvoda,
      kolicina,
      transferna_cijena,
      vpc,
    });
    return res.json(result);
  } catch (error) {
    console.error("prenosMagacin1Magacin2 error:", error);
    // Greške iz procedure (SIGNAL SQLSTATE '45000') vraćamo operateru kako jesu.
    if (error?.sqlState === "45000") {
      return res.status(400).json({ success: false, message: error.sqlMessage });
    }
    return res.status(500).json({
      success: false,
      message: "Greška pri prenosu proizvoda",
    });
  }
};

export const getZatvoreniRadniNalogDetalji =async (req, res) => {
  try {
    const sifra = parseInt(req.params.sifra);
    if (!Number.isFinite(sifra)) {
      return res.status(400).json({
        success: false,
        message: "Neispravna šifra radnog naloga",
      });
    }

    const result = await RadniNalogService.getZatvoreniRadniNalogDetalji(sifra);
    return res.json(result);
  } catch (error) {
    console.error("getZatvoreniRadniNalogDetalji error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju detalja radnog naloga",
    });
  }
};
