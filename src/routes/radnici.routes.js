import { Router } from "express";
import * as RadniciController from "../controllers/radnici.controller.js";

const router = Router();

router.get("/", RadniciController.getPregledRadnika);

export default router;
