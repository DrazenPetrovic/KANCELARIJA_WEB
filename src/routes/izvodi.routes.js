import { Router } from "express";
import * as IzvodiController from "../controllers/izvodi.controller.js";

const router = Router();

router.get(
  "/pregled-sa-uplatama",
  IzvodiController.getIzvodiPreglediSaUplatama,
);
router.get("/uplata-pojedinacna", IzvodiController.getUplataPojedinacna);
router.get("/kuf-pojedinacni", IzvodiController.getKufPojedinacni);

export default router;
