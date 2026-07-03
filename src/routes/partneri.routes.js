import { Router } from "express";
import * as PartneriController from "../controllers/partneri.controller.js";

const router = Router();

router.get("/", PartneriController.getPartneri);
router.get("/razni", PartneriController.getPartneriRazni);
router.post("/razni", PartneriController.createPartnerRazni);
router.get("/dodatne-lokacije", PartneriController.getPartneriDodatneLokacije);
router.get("/lokalna-dostava", PartneriController.getPartneriZaLokalnuDostavu);

export default router;
