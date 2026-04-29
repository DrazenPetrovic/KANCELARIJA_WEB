import { Router } from "express";
import * as TerenController from "../controllers/teren.controller.js";

const router = Router();

router.get("/terena-po-danima", TerenController.getTerenPoDanima);
router.get("/teren-grad", TerenController.getTerenGrad);
router.get("/teren-kupci", TerenController.getTerenKupci);

export default router;
