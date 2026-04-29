import * as NarudzbeService from "../services/narudzbe.service.js";

export const getAktivneNarudzbeGrupisano = async (req, res) => {
  try {
    const sifraTerena = req.query.sifraTerena || req.params.sifraTerena;
    if (!sifraTerena) {
      return res.status(400).json({ success: false, error: "Sifra terena je obavezna" });
    }
    const data = await NarudzbeService.getAktivneNarudzbeGrupisano(sifraTerena);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled grupisanih narudžbi error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju narudžbi" });
  }
};

export const getAktivneNarudzbe = async (req, res) => {
  try {
    const sifraTerena = req.query.sifraTerena || req.params.sifraTerena;
    if (!sifraTerena) {
      return res.status(400).json({ success: false, error: "Sifra terena je obavezna" });
    }
    const data = await NarudzbeService.getAktivneNarudzbe(sifraTerena);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled narudžbi error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju narudžbi" });
  }
};

export const getRanijeUzimano = async (req, res) => {
  try {
    const sifraPartnera = req.query.sifraPartnera || req.params.sifraPartnera;
    if (!sifraPartnera) {
      return res.status(400).json({ success: false, error: "Sifra partnera je obavezna" });
    }
    const nazivPartnera = req.query.nazivPartnera || req.params.nazivPartnera;
    const data = await NarudzbeService.getRanijeUzimano(sifraPartnera, nazivPartnera);
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled ranije uzimanih narudžbi error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju ranije uzimanih narudžbi" });
  }
};

export const getZadnjiDanNarudzbe = async (req, res) => {
  try {
    const data = await NarudzbeService.getZadnjiDanNarudzbe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled zadnjeg dana narudžbe error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju zadnjeg dana narudžbe" });
  }
};

export const createNarudzba = async (req, res) => {
  try {
    const { referentniBroj, sifraKupca, sifraTerenaDostava, vrstaPlacanja, proizvodi, dodatnaLokacija } = req.body;

    if (!sifraKupca || !sifraTerenaDostava || !vrstaPlacanja || !proizvodi || proizvodi.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (sifraKupca, sifraTerenaDostava, vrstaPlacanja, proizvodi)",
      });
    }

    const rezultat = await NarudzbeService.createNarudzba({
      referentniBroj,
      sifraKupca,
      sifraTerenaDostava,
      vrstaPlacanja,
      proizvodi,
      dodatnaLokacija,
    });

    return res.json({ success: true, message: "Narudžba uspješno unijeta", data: rezultat });
  } catch (error) {
    console.error("Greška pri kreiranju narudžbe:", error);
    return res.status(500).json({ success: false, error: "Greška pri spremanju narudžbe: " + error.message });
  }
};

export const narudzbaBrisanjePartnera = async (req, res) => {
  try {
    const { sifraKupca, sifraTerenaDostava, referentniBroj } = req.body;

    if (!sifraKupca || !sifraTerenaDostava || !referentniBroj) {
      return res.status(400).json({ success: false, error: "Nedostaju obavezni podaci" });
    }

    const poruka = await NarudzbeService.obrisiNarudzbuPartnera({
      p_sifra_terena: sifraTerenaDostava,
      p_sifra_partnera: sifraKupca,
      p_referentni_broj: referentniBroj,
    });

    if (poruka && poruka.toLowerCase().includes("nije dozvoljeno")) {
      return res.status(403).json({ success: false, error: poruka });
    }

    return res.json({ success: true, message: poruka });
  } catch (error) {
    console.error("Greška pri brisanju narudžbe:", error);
    return res.status(500).json({ success: false, error: "Greška pri brisanju narudžbe: " + error.message });
  }
};

export const narudzbaBrisanjePartneraProizvoda = async (req, res) => {
  try {
    const { sifraKupca, sifraTerenaDostava, sifraProizvoda, referentniBroj } = req.body;

    if (!sifraKupca || !sifraTerenaDostava || !sifraProizvoda || !referentniBroj) {
      return res.status(400).json({ success: false, error: "Nedostaju obavezni podaci" });
    }

    const poruka = await NarudzbeService.obrisiNarudzbuPartneraProizvoda({
      p_sifra_terena: sifraTerenaDostava,
      p_sifra_partnera: sifraKupca,
      p_sifra_proizvoda: sifraProizvoda,
      p_referentni_broj: referentniBroj,
    });

    if (poruka && poruka.toLowerCase().includes("nije dozvoljeno")) {
      return res.status(403).json({ success: false, error: poruka });
    }

    return res.json({ success: true, message: poruka });
  } catch (error) {
    console.error("Greška pri brisanju narudžbe:", error);
    return res.status(500).json({ success: false, error: "Greška pri brisanju narudžbe: " + error.message });
  }
};
