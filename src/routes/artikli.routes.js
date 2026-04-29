import { Router } from "express";
import * as ArtikliController from "../controllers/artikli.controller.js";

const router = Router();

router.get("/", ArtikliController.getArtikli);
router.get("/grupe", ArtikliController.getArtikliGrupe);

export default router;
