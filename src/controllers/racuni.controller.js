import * as RacuniService from "../services/racuni.service.js";

export const getIstorijaRacuna = async (req, res) => {
  try {
    const sifraPartnera = req.query.sifraPartnera || req.params.sifraPartnera;
    if (!sifraPartnera) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra partnera je obavezna" });
    }
    const data = await RacuniService.getIstorijaRacuna(sifraPartnera);
    const poslednjih = [...data]
      .sort(
        (a, b) =>
          new Date(b.datum_racuna).getTime() -
          new Date(a.datum_racuna).getTime(),
      )
      .slice(0, 6);
    return res.json({
      success: true,
      data: poslednjih,
      count: poslednjih.length,
    });
  } catch (error) {
    console.error("Istorija računa error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju istorije računa" });
  }
};

export const getRacunPoIstorija = async (req, res) => {
  try {
    const sifraTabele = req.query.sifraTabele || req.params.sifraTabele;
    if (!sifraTabele) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra tabele je obavezna" });
    }
    const data = await RacuniService.getRacunPoIstorija(sifraTabele);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Stavke računa error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju stavki računa" });
  }
};

export const getRacuniPodgrupe = async (req, res) => {
  try {
    const data = await RacuniService.getRacuniPodgrupe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Podgrupe računa error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju podgrupa računa" });
  }
};

export const getRacunPoPregled = async (req, res) => {
  try {
    const sifraTabele = req.query.sifraTabele || req.params.sifraTabele;
    if (!sifraTabele) {
      return res
        .status(400)
        .json({ success: false, error: "Sifra tabele je obavezna" });
    }
    const data = await RacuniService.getRacunPoPregled(sifraTabele);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled po računu error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju detalja računa" });
  }
};

export const unosRacuna = async (req, res) => {
  try {
    const { header, items } = req.body;
    if (!header || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (header, items)",
      });
    }

    const rezultat = await RacuniService.unosRacuna({ header, items });
    if (!rezultat) {
      return res.status(500).json({
        success: false,
        error: "Nema odgovora od procedure za unos računa",
      });
    }

    const kod = Number(rezultat.kod);
    if (kod !== 0) {
      return res.status(400).json({
        success: false,
        kod,
        error: rezultat.poruka || "Greška pri unosu računa",
      });
    }

    const brojRacuna = rezultat.broj_racuna;
    const affectedRows = Number(rezultat.affected_rows ?? 0);
    const imaBrojRacuna =
      brojRacuna !== undefined &&
      brojRacuna !== null &&
      String(brojRacuna).trim() !== "";
    const imaAffectedRows = Number.isFinite(affectedRows) && affectedRows > 0;

    if (!imaBrojRacuna && !imaAffectedRows) {
      return res.status(500).json({
        success: false,
        error:
          "Upis nije pouzdano potvrđen (nema broj_racuna ni affected_rows > 0).",
      });
    }

    return res.json({
      success: true,
      kod,
      poruka: rezultat.poruka,
      sifra_tabele: rezultat.sifra_tabele,
      broj_racuna: brojRacuna,
      affected_rows: imaAffectedRows ? affectedRows : null,
      response_source: rezultat.response_source || "result_set",
    });
  } catch (error) {
    console.error("Unos računa error:", error);
    const detalj =
      error?.sqlMessage || error?.message || "Greška pri unosu računa";
    return res.status(500).json({ success: false, error: detalj });
  }
};
