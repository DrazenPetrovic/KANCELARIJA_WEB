import { Router } from "express";
import * as BankeController from "../controllers/banke.controller.js";

const router = Router();

router.get("/pregled", BankeController.getBankePregled);

export default router;
