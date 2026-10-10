import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as BackupController from "../controllers/backup.controller.js";

const router = Router();

router.get("/status", verifyToken, BackupController.getBackupStatus);

export default router;
