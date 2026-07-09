import { Router } from "express";
import * as RacuniController from "../controllers/racuni.controller.js";

const router = Router();

router.get("/istorija", RacuniController.getIstorijaRacuna);
router.get("/stavke", RacuniController.getRacunPoIstorija);
router.get("/podgrupe", RacuniController.getRacuniPodgrupe);
router.get("/pregled-stavke", RacuniController.getRacunPoPregled);
router.post("/unos", RacuniController.unosRacuna);

export default router;
