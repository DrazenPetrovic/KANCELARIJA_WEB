import { Router } from "express";
import * as AuthController from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", AuthController.login);
router.get("/verify", AuthController.verify);
router.post("/logout", AuthController.logout);

export default router;
