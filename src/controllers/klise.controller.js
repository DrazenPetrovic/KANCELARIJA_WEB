import * as KliseService from "../services/klise.service.js";

export const dodajKlise = async (req, res) => {
  try {
    const {
      naziv_klisea,
      lokacija_partnera,
      dimenzija_za_stampu,
      povrsina_klisea,
      cijena_klisea,
      napomena,
    } = req.body;

    if (!naziv_klisea || !lokacija_partnera || !dimenzija_za_stampu || !povrsina_klisea || !cijena_klisea) {
      return res.status(400).json({
        success: false,
        message: "Sva obavezna polja moraju biti popunjena",
      });
    }

    const result = await KliseService.dodajKlise({
      naziv_klisea,
      lokacija_partnera,
      dimenzija_za_stampu,
      povrsina_klisea,
      cijena_klisea,
      napomena,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("dodajKlise error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri dodavanju kliša",
    });
  }
};

export const unosKlisePodatakaOdDobavljaca = async (req, res) => {
  try {
    const {
      sifra,
      placeno_dobavljacu,
      obracunata_povrsina_kod_dobavljaca,
      broj_racuna,
      datum_racuna,
      dobavljac_klisea,
    } = req.body;

    if (
      !sifra ||
      placeno_dobavljacu === undefined || placeno_dobavljacu === "" ||
      obracunata_povrsina_kod_dobavljaca === undefined || obracunata_povrsina_kod_dobavljaca === "" ||
      !broj_racuna ||
      !datum_racuna ||
      !dobavljac_klisea
    ) {
      return res.status(400).json({
        success: false,
        message: "Sva polja su obavezna",
      });
    }

    const result = await KliseService.unosKlisePodatakaOdDobavljaca({
      sifra,
      placeno_dobavljacu,
      obracunata_povrsina_kod_dobavljaca,
      broj_racuna,
      datum_racuna,
      dobavljac_klisea,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("unosKlisePodatakaOdDobavljaca error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri unosu podataka od dobavljača",
    });
  }
};

export const unosNaplateOdKupca = async (req, res) => {
  try {
    const { sifra, ukupno_naplaceno } = req.body;

    if (!sifra || ukupno_naplaceno === undefined || ukupno_naplaceno === null || ukupno_naplaceno === "") {
      return res.status(400).json({
        success: false,
        message: "Šifra kliša i iznos naplate su obavezni",
      });
    }

    const result = await KliseService.unosNaplateOdKupca({ sifra, ukupno_naplaceno });
    return res.status(200).json(result);
  } catch (error) {
    console.error("unosNaplateOdKupca error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri unosu naplate",
    });
  }
};

export const getKlisePregled = async (_req, res) => {
  try {
    const result = await KliseService.getKlisePregled();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju kliša",
    });
  } catch (error) {
    console.error("getKlisePregled error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahtjeva",
    });
  }
};
