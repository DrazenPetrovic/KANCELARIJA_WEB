import * as NivelacijeService from "../services/nivelacije.service.js";

export const createNivelacija = async (req, res) => {
  try {
    const { datumNivelacije, ukupnoStaro, ukupnoNovo, nivelacijaRobe, stavke } = req.body;

    if (
      !datumNivelacije ||
      ukupnoStaro === undefined ||
      ukupnoNovo === undefined ||
      nivelacijaRobe === undefined ||
      !Array.isArray(stavke) ||
      stavke.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (datumNivelacije, ukupnoStaro, ukupnoNovo, nivelacijaRobe, stavke)",
      });
    }

    const data = await NivelacijeService.unosNivelacije({
      datumNivelacije,
      ukupnoStaro,
      ukupnoNovo,
      nivelacijaRobe,
      stavke,
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos nivelacije error:", error);
    return res.status(500).json({ success: false, error: "Greška pri unosu nivelacije" });
  }
};

export const unosNivelacijeArtikala = async (req, res) => {
  try {
    const { datum_nivelacije, nivelacija_robe, sifra_knjizenja, stavke } = req.body;

    if (
      !datum_nivelacije ||
      nivelacija_robe === undefined ||
      !Array.isArray(stavke) ||
      stavke.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (datum_nivelacije, nivelacija_robe, stavke)",
      });
    }

    const neispravna = stavke.find(
      (s) =>
        !s ||
        s.sifra_proizvoda === undefined ||
        !Number.isFinite(Number(s.kolicina_proizvoda)) ||
        !Number.isFinite(Number(s.cijena_stara)) ||
        !(Number(s.cijena_nova) > 0),
    );
    if (neispravna) {
      return res.status(400).json({ success: false, error: "Neispravna stavka nivelacije" });
    }

    const data = await NivelacijeService.unosNivelacijeArtikala({
      datum_nivelacije,
      nivelacija_robe: Number(nivelacija_robe),
      sifra_knjizenja: Number(sifra_knjizenja) || 0,
      stavke: stavke.map((s) => ({
        sifra_proizvoda: Number(s.sifra_proizvoda),
        kolicina_proizvoda: Number(s.kolicina_proizvoda),
        cijena_stara: Number(s.cijena_stara),
        cijena_nova: Number(s.cijena_nova),
      })),
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Unos nivelacije artikala error:", error);
    return res.status(500).json({
      success: false,
      error: error?.sqlMessage || "Greška pri unosu nivelacije",
    });
  }
};

export const getNivelacijeAktivne = async (req, res) => {
  try {
    const data = await NivelacijeService.getNivelacijeAktivne();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled aktivnih nivelacija error:", error);
    return res.status(500).json({ success: false, error: "Greška pri učitavanju aktivnih nivelacija" });
  }
};

export const azurirajTrenutnoStanje = async (req, res) => {
  try {
    const { sifraProizvoda, vpcStvarna, vpcTrenutna, sifraNivelacije } = req.body;

    if (
      sifraProizvoda === undefined ||
      vpcStvarna === undefined ||
      vpcTrenutna === undefined ||
      sifraNivelacije === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (sifraProizvoda, vpcStvarna, vpcTrenutna, sifraNivelacije)",
      });
    }

    const data = await NivelacijeService.azurirajTrenutnoStanje({
      sifraProizvoda,
      vpcStvarna,
      vpcTrenutna,
      sifraNivelacije,
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Ažuriranje trenutnog stanja nivelacije error:", error);
    return res.status(500).json({ success: false, error: "Greška pri ažuriranju trenutnog stanja nivelacije" });
  }
};
