import { Router } from "express";
import * as KliseController from "../controllers/klise.controller.js";

const router = Router();

router.post("/klise-unos-novi", KliseController.dodajKlise);
router.get("/klise-pregled", KliseController.getKlisePregled);

export default router;
