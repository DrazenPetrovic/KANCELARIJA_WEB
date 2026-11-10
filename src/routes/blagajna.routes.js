import { Router } from "express";
import * as BlagajnaController from "../controllers/blagajna.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.get("/stanje", BlagajnaController.getBlagajnaStanje);
router.post("/otvori", BlagajnaController.otvoriBlagajnu);
router.post("/zatvori", BlagajnaController.zatvoriBlagajnu);
router.post(
  "/uplate-unos",
  verifyToken,
  BlagajnaController.unosUplataBlagajne,
);

router.get(
  "/pregled-sa-uplatama",
  BlagajnaController.getBlagajnaPreglediSaUplatama,
);

export default router;
