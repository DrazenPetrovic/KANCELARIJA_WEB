import { Router } from "express";
import * as BlagajnaController from "../controllers/blagajna.controller.js";

const router = Router();

router.get("/stanje", BlagajnaController.getBlagajnaStanje);
router.post("/otvori", BlagajnaController.otvoriBlagajnu);

router.get(
  "/pregled-sa-uplatama",
  BlagajnaController.getBlagajnaPreglediSaUplatama,
);

export default router;
