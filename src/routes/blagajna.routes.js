import { Router } from "express";
import * as BlagajnaController from "../controllers/blagajna.controller.js";

const router = Router();

router.get(
  "/pregled-sa-uplatama",
  BlagajnaController.getBlagajnaPreglediSaUplatama,
);

export default router;
