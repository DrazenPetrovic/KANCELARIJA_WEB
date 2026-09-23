import { Router } from "express";
import * as TrgovackeKnjigeController from "../controllers/trgovackeKnjige.controller.js";

const router = Router();

router.get("/veleprodaja", TrgovackeKnjigeController.getTrgovackaKnjigaVeleprodaja);

export default router;
