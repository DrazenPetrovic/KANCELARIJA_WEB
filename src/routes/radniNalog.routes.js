import { Router } from "express";
import * as RadniNalogController from "../controllers/radniNalog.controller.js";

const router = Router();

router.get("/zatvoreni", RadniNalogController.getZatvoreniRadniNalozi);
router.get("/zatvoreni/:sifra", RadniNalogController.getZatvoreniRadniNalogDetalji);

export default router;
