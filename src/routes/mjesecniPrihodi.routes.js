import { Router } from "express";
import * as MjesecniPrihodiController from "../controllers/mjesecniPrihodi.controller.js";

const router = Router();

router.get("/", MjesecniPrihodiController.getMjesecniPrihodi);
router.get("/izvoz", MjesecniPrihodiController.getMjesecniPrihodiIzvoz);

export default router;
