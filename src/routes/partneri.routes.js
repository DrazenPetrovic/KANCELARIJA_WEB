import { Router } from "express";
import * as PartneriController from "../controllers/partneri.controller.js";

const router = Router();

router.get("/", PartneriController.getPartneri);
router.get("/razni", PartneriController.getPartneriRazni);
router.post("/razni", PartneriController.createPartnerRazni);
router.put("/razni/:sifra", PartneriController.updatePartnerRazni);
router.get("/dodatne-lokacije", PartneriController.getPartneriDodatneLokacije);
router.get("/dodatne-lokacije-pregled", PartneriController.getPartneriDodatneLokacijePregled);
router.get("/lokalna-dostava", PartneriController.getPartneriZaLokalnuDostavu);
router.get("/komercijalisti", PartneriController.getKomercijalisti);
router.get("/dogovorene-cijene", PartneriController.getDogovoreneCijene);
router.get(
  "/dogovorene-cijene-osnovno",
  PartneriController.getDogovoreneCijeneOsnovno,
);
router.get("/drzave", PartneriController.getDrzave);
router.get("/drzave-pregled", PartneriController.getDrzavePregled);
router.post("/drzave", PartneriController.createDrzava);
router.get("/gradovi", PartneriController.getGradovi);
router.get("/gradovi-pregled", PartneriController.getGradoviPregled);
router.post("/gradovi", PartneriController.createGrad);
router.get("/lista-sve", PartneriController.getListaSve);
router.get("/:id/poslovnice", PartneriController.getListaPoslovnice);
router.get("/:id/telefoni", PartneriController.getListaTelefoni);
router.post("/:id/poslovnice", PartneriController.createPoslovnica);
router.put("/poslovnice/:poslovnicaId", PartneriController.updatePoslovnica);
router.post("/:id/telefoni", PartneriController.createTelefonPartnera);
router.put("/telefoni/:telefonId", PartneriController.updateTelefonPartnera);
router.post("/glavni", PartneriController.createPartnerGlavni);
router.put("/:id", PartneriController.updatePartnerGlavni);

export default router;
