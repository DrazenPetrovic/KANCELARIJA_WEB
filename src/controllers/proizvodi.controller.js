import * as ProizvodiService from "../services/proizvodi.service.js";

export const getNormativiZaProizvod = async (req, res) => {
  try {
    const data = await ProizvodiService.getNormativiZaProizvod();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled normativa proizvoda error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju normativa" });
  }
};

export const izmjenaNormativa = async (req, res) => {
  try {
    const body = req.body ?? {};

    const sifraTabele = Number(body.sifra_tabele);
    const sifraProizvoda = Number(body.sifra_proizvoda);
    const sifraSirovine = Number(body.sifra_sirovine);
    const kolicinaSirovine = Number(body.kolicina_sirovine);

    if (!Number.isFinite(sifraTabele) || sifraTabele <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_tabele je obavezna" });
    }
    if (!Number.isFinite(sifraProizvoda) || sifraProizvoda <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_proizvoda je obavezna" });
    }
    if (!Number.isFinite(sifraSirovine) || sifraSirovine <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_sirovine je obavezna" });
    }
    if (!Number.isFinite(kolicinaSirovine) || kolicinaSirovine < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Količina sirovine je obavezna" });
    }

    const podaci = {
      sifra_tabele: sifraTabele,
      sifra_proizvoda: sifraProizvoda,
      sifra_sirovine: sifraSirovine,
      kolicina_sirovine: kolicinaSirovine,
    };

    const rezultat = await ProizvodiService.izmjenaNormativa(podaci);
    return res.json({ success: true, data: rezultat });
  } catch (error) {
    console.error("Izmjena normativa error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Greška pri izmjeni normativa" });
  }
};

export const unosNormativa = async (req, res) => {
  try {
    const body = req.body ?? {};

    const sifraProizvoda = Number(body.sifra_proizvoda);
    const sifraSirovine = Number(body.sifra_sirovine);
    const kolicinaSirovine = Number(body.kolicina_sirovine);

    if (!Number.isFinite(sifraProizvoda) || sifraProizvoda <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_proizvoda je obavezna" });
    }
    if (!Number.isFinite(sifraSirovine) || sifraSirovine <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_sirovine je obavezna" });
    }
    if (!Number.isFinite(kolicinaSirovine) || kolicinaSirovine < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Količina sirovine je obavezna" });
    }

    const podaci = {
      sifra_proizvoda: sifraProizvoda,
      sifra_sirovine: sifraSirovine,
      kolicina_sirovine: kolicinaSirovine,
    };

    const rezultat = await ProizvodiService.unosNormativa(podaci);
    return res.json({ success: true, data: rezultat });
  } catch (error) {
    console.error("Unos normativa error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Greška pri unosu normativa" });
  }
};

export const brisanjeStavkeNormativa = async (req, res) => {
  try {
    const sifraTabele = Number(req.params.sifraTabele);

    if (!Number.isFinite(sifraTabele) || sifraTabele <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "sifra_tabele je obavezna" });
    }

    const rezultat =
      await ProizvodiService.brisanjeStavkeNormativa(sifraTabele);
    return res.json({ success: true, data: rezultat });
  } catch (error) {
    console.error("Brisanje stavke normativa error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Greška pri brisanju normativa" });
  }
};
