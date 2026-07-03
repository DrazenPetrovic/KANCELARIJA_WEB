import { Router } from "express";
import * as GradoviController from "../controllers/gradovi.controller.js";

const router = Router();

router.get("/", GradoviController.getPregledGradova);

export default router;
