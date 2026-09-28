import * as IzvodiService from "../services/izvodi.service.js";

export const getUplataPojedinacna = async (req, res) => {
  try {
    const sifraUplate = req.query.sifraUplate || req.params.sifraUplate;
    if (!sifraUplate) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra uplate je obavezna" });
    }
    const data = await IzvodiService.getUplataPojedinacna(sifraUplate);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Uplata nije pronađena" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled pojedinačne uplate error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju uplate" });
  }
};

export const getKufPojedinacni = async (req, res) => {
  try {
    const sifraTabele = req.query.sifraTabele || req.params.sifraTabele;
    if (!sifraTabele) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra tabele je obavezna" });
    }
    const data = await IzvodiService.getKufPojedinacni(sifraTabele);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Stavka KUF-a nije pronađena" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Pregled pojedinačne KUF stavke error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju KUF stavke" });
  }
};

export const getIzvodiStatus = async (req, res) => {
  try {
    const banke = await IzvodiService.getIzvodiStatus();
    return res.json({ success: true, banke });
  } catch (error) {
    console.error("getIzvodiStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Greška pri dohvatanju statusa izvoda" });
  }
};

export const otvoriIzvod = async (req, res) => {
  const { sifraBanke, sifraIzvoda, datumIzvoda } = req.body ?? {};
  if (!sifraBanke || !sifraIzvoda || !datumIzvoda) {
    return res.status(400).json({
      success: false,
      message: "Banka, broj izvoda i datum izvoda su obavezni",
    });
  }
  try {
    const izvod = await IzvodiService.otvoriIzvod({
      sifraBanke,
      sifraIzvoda,
      datumIzvoda,
    });
    return res.json({ success: true, izvod });
  } catch (error) {
    console.error("otvoriIzvod error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Greška pri otvaranju izvoda",
    });
  }
};

export const zatvoriIzvod = async (req, res) => {
  const { redniBroj } = req.body ?? {};
  if (!redniBroj) {
    return res
      .status(400)
      .json({ success: false, message: "Redni broj izvoda je obavezan" });
  }
  try {
    await IzvodiService.zatvoriIzvod({ redniBroj });
    return res.json({ success: true });
  } catch (error) {
    console.error("zatvoriIzvod error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Greška pri zatvaranju izvoda",
    });
  }
};

export const unosUplataIzvoda = async (req, res) => {
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
    const rezultat = await IzvodiService.unosUplataIzvoda({
      stavke,
      sifraRadnika,
    });
    return res.json({ success: true, ...rezultat });
  } catch (error) {
    console.error("unosUplataIzvoda error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Greška pri unosu uplata",
    });
  }
};

export const getIzvodiPreglediSaUplatama = async (req, res) => {
  try {
    const { izvodi, uplate } =
      await IzvodiService.getIzvodiPreglediSaUplatama();
    return res.json({
      success: true,
      izvodi,
      uplate,
      count: izvodi.length,
    });
  } catch (error) {
    console.error("Pregled izvoda error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju pregleda izvoda" });
  }
};
