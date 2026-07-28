import { Router } from "express";
import * as RacuniController from "../controllers/racuni.controller.js";

const router = Router();

router.get("/istorija", RacuniController.getIstorijaRacuna);
router.get("/stavke", RacuniController.getRacunPoIstorija);
router.get("/podgrupe", RacuniController.getRacuniPodgrupe);
router.get("/pregled-stavke", RacuniController.getRacunPoPregled);
router.get(
  "/dogovorene-cijene-potpun",
  RacuniController.getDogovoreneCijenePotpun,
);
router.post(
  "/dogovorene-cijene",
  RacuniController.unosDogovorenihCijena,
);
router.post("/unos", RacuniController.unosRacuna);
router.post(
  "/azuriraj-fiskalne-podatke",
  RacuniController.azurirajFiskalnePodatke,
);
router.post("/storniraj", RacuniController.oznaciRacunStorniran);

export default router;
