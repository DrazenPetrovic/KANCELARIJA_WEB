import { Router } from "express";
import * as RadniNalogController from "../controllers/radniNalog.controller.js";

const router = Router();

router.get("/magacin-1", RadniNalogController.getMagacin1);
router.get("/magacin-2", RadniNalogController.getMagacin2);
router.get("/zatvoreni",RadniNalogController.getZatvoreniRadniNalozi);
router.get("/zatvoreni/:sifra", RadniNalogController.getZatvoreniRadniNalogDetalji);

export default router;
