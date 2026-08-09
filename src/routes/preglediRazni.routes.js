import { Router } from "express";
import * as PreglediRazniController from "../controllers/preglediRazni.controller.js";

const router = Router();

router.get("/kif", PreglediRazniController.getKif);

export default router;
