import { Router } from "express";
import * as NivelacijeController from "../controllers/nivelacije.controller.js";

const router = Router();

router.post("/", NivelacijeController.createNivelacija);

export default router;
