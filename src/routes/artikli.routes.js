import { Router } from "express";
import * as ArtikliController from "../controllers/artikli.controller.js";

const router = Router();

router.get("/", ArtikliController.getArtikli);
router.get("/grupe", ArtikliController.getArtikliGrupe);
router.get(
  "/dogovorene-cijene-potpun",
  ArtikliController.getDogovoreneCijenePotpun,
);
router.post(
  "/dogovorene-cijene/deaktiviraj",
  ArtikliController.deaktivirajDogovoreneCijene,
);

export default router;
