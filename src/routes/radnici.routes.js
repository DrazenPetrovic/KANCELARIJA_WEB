import { Router } from "express";
import * as RadniciController from "../controllers/radnici.controller.js";

const router = Router();

router.get("/pregled-sve", RadniciController.getRadniciPregledSve);
router.post("/azuriraj", RadniciController.azurirajRadnika);
router.post("/unos", RadniciController.dodajRadnika);
router.post("/prisutnost/unos", RadniciController.unosPrisutnosti);
router.get("/prisutnost/pregled", RadniciController.getPrisutnostPregled);
router.get("/prisutnost/po-danu", RadniciController.getPrisutnostPoDanu);
router.get(
  "/prisutnost/pristigli",
  RadniciController.getPrisutnostPristiglihRadnika,
);
router.post("/prisutnost/obrisi", RadniciController.obrisiPrisutnost);

export default router;
