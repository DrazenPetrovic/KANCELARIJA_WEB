import { Router } from "express";
import * as IzvodiController from "../controllers/izvodi.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.get(
  "/pregled-sa-uplatama",
  IzvodiController.getIzvodiPreglediSaUplatama,
);
router.get("/status", IzvodiController.getIzvodiStatus);
router.post("/otvori", IzvodiController.otvoriIzvod);
router.post("/zatvori", IzvodiController.zatvoriIzvod);
router.post("/uplate-unos", verifyToken, IzvodiController.unosUplataIzvoda);
router.get("/uplata-pojedinacna", IzvodiController.getUplataPojedinacna);
router.get("/kuf-pojedinacni", IzvodiController.getKufPojedinacni);

export default router;
