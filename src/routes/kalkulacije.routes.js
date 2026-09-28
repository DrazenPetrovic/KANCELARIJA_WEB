import { Router } from "express";
import * as KalkulacijeController from "../controllers/kalkulacije.controller.js";

const router = Router();

router.get("/pojedinacna", KalkulacijeController.getKalkulacijaPojedinacna);
router.get("/glavni", KalkulacijeController.getKalkulacijeGlavni);
router.get("/stavke", KalkulacijeController.getKalkulacijeStavke);
router.get(
  "/zavisni-troskovi",
  KalkulacijeController.getKalkulacijeZavisniTroskovi,
);

export default router;
