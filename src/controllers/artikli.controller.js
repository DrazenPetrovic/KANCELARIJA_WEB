import * as ArtikliService from "../services/artikli.service.js";

export const getArtikli = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikli();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala" });
  }
};

export const getArtikliPregledSve = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikliPregledSve();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled svih artikala error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju svih artikala" });
  }
};

export const getArtikliGrupe = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikliGrupe();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled artikala grupe error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju artikala grupe" });
  }
};

export const getArtikliGrupeZaUnos = async (req, res) => {
  try {
    const data = await ArtikliService.getArtikliGrupeZaUnos();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled grupa za unos artikla error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju grupa artikala" });
  }
};

export const getJedinicaMjere = async (req, res) => {
  try {
    const data = await ArtikliService.getJedinicaMjere();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled jedinica mjere error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju jedinica mjere" });
  }
};

export const unosArtikla = async (req, res) => {
  try {
    const body = req.body ?? {};

    const nazivProizvoda =
      typeof body.naziv_proizvoda === "string" ? body.naziv_proizvoda.trim() : "";
    const jm = Number(body.jm);

    if (!nazivProizvoda) {
      return res
        .status(400)
        .json({ success: false, error: "Naziv proizvoda je obavezan" });
    }
    if (!Number.isFinite(jm) || jm <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Jedinica mjere (JM) je obavezna" });
    }

    // Šifra proizvoda se dodjeljuje automatski u erp.artikli_unos.
    const podaci = {
      naziv_proizvoda: nazivProizvoda,
      jm,
      kolicina_proizvoda: Number(body.kolicina_proizvoda) || 0,
      cijena_bez: Number(body.cijena_bez) || 0,
      vpc: Number(body.vpc) || 0,
      marza: Number(body.marza) || 0,
      sirovina_da: body.sirovina_da ? 1 : 0,
      ogranicena_marza: body.ogranicena_marza ? 1 : 0,
      marza_za_kalkulaciju: Number(body.marza_za_kalkulaciju) || 0,
      grupa_proizvoda: Number(body.grupa_proizvoda) || 0,
      vrsta: Number(body.vrsta) || 0,
      minimalna_prodajna: Number(body.minimalna_prodajna) || 0,
      barkod: typeof body.barkod === "string" ? body.barkod.trim() : "",
      koristiti_za_ponudu: body.koristiti_za_ponudu ? 1 : 0,
    };

    await ArtikliService.unosArtikla(podaci);
    return res.json({ success: true });
  } catch (error) {
    console.error("Unos artikla error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri unosu artikla" });
  }
};

export const izmjenaArtikla = async (req, res) => {
  try {
    const body = req.body ?? {};

    const sifraProizvoda = Number(body.sifra_proizvoda);
    const nazivProizvoda =
      typeof body.naziv_proizvoda === "string" ? body.naziv_proizvoda.trim() : "";
    const jm = Number(body.jm);

    if (!Number.isFinite(sifraProizvoda) || sifraProizvoda <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Šifra proizvoda je obavezna" });
    }
    if (!nazivProizvoda) {
      return res
        .status(400)
        .json({ success: false, error: "Naziv proizvoda je obavezan" });
    }
    if (!Number.isFinite(jm) || jm <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Jedinica mjere (JM) je obavezna" });
    }

    const podaci = {
      sifra_proizvoda: sifraProizvoda,
      naziv_proizvoda: nazivProizvoda,
      jm,
      kolicina_proizvoda: Number(body.kolicina_proizvoda) || 0,
      cijena_bez: Number(body.cijena_bez) || 0,
      vpc: Number(body.vpc) || 0,
      marza: Number(body.marza) || 0,
      sirovina_da: body.sirovina_da ? 1 : 0,
      ogranicena_marza: body.ogranicena_marza ? 1 : 0,
      marza_za_kalkulaciju: Number(body.marza_za_kalkulaciju) || 0,
      grupa_proizvoda: Number(body.grupa_proizvoda) || 0,
      vrsta: Number(body.vrsta) || 0,
      minimalna_prodajna: Number(body.minimalna_prodajna) || 0,
      barkod: typeof body.barkod === "string" ? body.barkod.trim() : "",
      koristiti_za_ponudu: body.koristiti_za_ponudu ? 1 : 0,
    };

    await ArtikliService.izmjenaArtikla(podaci);
    return res.json({ success: true });
  } catch (error) {
    console.error("Izmjena artikla error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri izmjeni artikla" });
  }
};

export const getDogovoreneCijenePotpun = async (req, res) => {
  try {
    const data = await ArtikliService.getDogovoreneCijenePregledPotpun();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled ugovorenih cijena error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju ugovorenih cijena" });
  }
};

export const deaktivirajDogovoreneCijene = async (req, res) => {
  try {
    const partnerId = Number(req.body?.partner_id);
    const proizvodi = req.body?.proizvodi;
    const proizvodIds = Array.isArray(proizvodi)
      ? proizvodi
          .map((p) => Number(p?.proizvod_id))
          .filter((id) => Number.isFinite(id))
      : [];

    if (!Number.isFinite(partnerId) || proizvodIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "partner_id i proizvodi su obavezni" });
    }

    await ArtikliService.deaktivirajDogovoreneCijene(partnerId, proizvodIds);
    return res.json({ success: true });
  } catch (error) {
    console.error("Deaktivacija ugovorenih cijena error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri deaktivaciji ugovorenih cijena" });
  }
};
