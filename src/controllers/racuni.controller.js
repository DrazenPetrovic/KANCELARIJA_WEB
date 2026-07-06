import * as RacuniService from "../services/racuni.service.js";

export const getIstorijaRacuna = async (req, res) => {
  try {
    const sifraPartnera = req.query.sifraPartnera || req.params.sifraPartnera;
    if (!sifraPartnera) {
      return res.status(400).json({ success: false, error: "Sifra partnera je obavezna" });
    }
    const data = await RacuniService.getIstorijaRacuna(sifraPartnera);
    const poslednjih = [...data]
      .sort((a, b) => new Date(b.datum_racuna).getTime() - new Date(a.datum_racuna).getTime())
      .slice(0, 6);
    return res.json({ success: true, data: poslednjih, count: poslednjih.length });
  } catch (error) {
    console.error("Istorija računa error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju istorije računa" });
  }
};

export const getRacunPoIstorija = async (req, res) => {
  try {
    const sifraTabele = req.query.sifraTabele || req.params.sifraTabele;
    if (!sifraTabele) {
      return res.status(400).json({ success: false, error: "Sifra tabele je obavezna" });
    }
    const data = await RacuniService.getRacunPoIstorija(sifraTabele);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Stavke računa error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju stavki računa" });
  }
};

export const getRacuniPodgrupe = async (req, res) => {
  try {
    const data = await RacuniService.getRacuniPodgrupe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Podgrupe računa error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju podgrupa računa" });
  }
};
