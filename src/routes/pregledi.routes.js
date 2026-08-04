import { Router } from "express";
import * as PreglediController from "../controllers/pregledi.controller.js";

const router = Router();

// Pregled svih računa
router.get("/racuna", PreglediController.getPregledRacuna);

// Dvofazno ucitavanje (vidi docs/sp_racuni_gl_nit_glavna_pozadina.sql) — stats
// pa onda glavna (zadnjih ~200) i pozadina (ostatak) po istoj granici.
router.get("/racuna/stats", PreglediController.getPregledRacunaStats);
router.get("/racuna/glavna", PreglediController.getPregledRacunaGlavna);
router.get("/racuna/pozadina", PreglediController.getPregledRacunaPozadina);

export default router;
