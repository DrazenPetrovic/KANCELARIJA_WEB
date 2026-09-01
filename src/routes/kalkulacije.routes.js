import { Router } from "express";
import * as KalkulacijeController from "../controllers/kalkulacije.controller.js";

const router = Router();

router.get("/pojedinacna", KalkulacijeController.getKalkulacijaPojedinacna);

export default router;
