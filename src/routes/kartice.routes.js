import { Router } from "express";
import * as KarticeController from "../controllers/kartice.controller.js";

const router = Router();

router.get("/partner/:id", KarticeController.getKarticaPartnera);
router.get("/proizvod/:id", KarticeController.getKarticaProizvoda);

export default router;
