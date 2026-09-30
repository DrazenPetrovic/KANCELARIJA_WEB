import { Router } from "express";
import * as NivelacijeController from "../controllers/nivelacije.controller.js";

const router = Router();

router.post("/", NivelacijeController.createNivelacija);
router.post("/unos", NivelacijeController.unosNivelacijeArtikala);
router.get("/aktivne", NivelacijeController.getNivelacijeAktivne);
router.post("/trenutno-stanje", NivelacijeController.azurirajTrenutnoStanje);

export default router;
