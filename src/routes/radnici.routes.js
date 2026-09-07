import { Router } from "express";
import * as RadniciController from "../controllers/radnici.controller.js";

const router = Router();

router.get("/pregled-sve", RadniciController.getRadniciPregledSve);
router.post("/azuriraj", RadniciController.azurirajRadnika);
router.post("/unos", RadniciController.dodajRadnika);
router.post("/prisutnost/unos", RadniciController.unosPrisutnosti);
router.get("/prisutnost/po-danu", RadniciController.getPrisutnostPoDanu);

export default router;
