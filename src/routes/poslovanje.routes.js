import { Router } from "express";
import * as PoslovanjeController from "../controllers/poslovanje.controller.js";

const router = Router();

router.get("/pregled", PoslovanjeController.getPoslovanjePregled);
router.get("/mjesecni", PoslovanjeController.getPoslovanjeMjesecni);

export default router;
