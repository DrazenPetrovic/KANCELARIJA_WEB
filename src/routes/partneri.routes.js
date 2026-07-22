import { Router } from "express";
import * as PartneriController from "../controllers/partneri.controller.js";

const router = Router();

router.get("/", PartneriController.getPartneri);
router.get("/razni", PartneriController.getPartneriRazni);
router.post("/razni", PartneriController.createPartnerRazni);
router.get("/dodatne-lokacije", PartneriController.getPartneriDodatneLokacije);
router.get("/lokalna-dostava", PartneriController.getPartneriZaLokalnuDostavu);
router.get("/drzave", PartneriController.getDrzave);
router.get("/gradovi", PartneriController.getGradovi);
router.get("/lista-sve", PartneriController.getListaSve);
router.post("/glavni", PartneriController.createPartnerGlavni);

export default router;
