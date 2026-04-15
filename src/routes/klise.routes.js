import { Router } from "express";
import * as KliseController from "../controllers/klise.controller.js";

const router = Router();

router.post("/klise-unos-novi", KliseController.dodajKlise);
router.post("/klise-unos-placanja-kupac", KliseController.unosNaplateOdKupca);
router.post("/klise-unos-podataka-od-dobavljaca", KliseController.unosKlisePodatakaOdDobavljaca);
router.get("/klise-pregled", KliseController.getKlisePregled);

export default router;
