import { Router } from "express";
import * as PartneriController from "../controllers/partneri.controller.js";

const router = Router();

router.get("/dodatne-lokacije", PartneriController.getPartneriDodatneLokacije);
router.get("/lokalna-dostava", PartneriController.getPartneriZaLokalnuDostavu);

export default router;
