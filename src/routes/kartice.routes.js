import { Router } from "express";
import * as KarticeController from "../controllers/kartice.controller.js";

const router = Router();

router.get("/partner/:id", KarticeController.getKarticaPartnera);

export default router;
