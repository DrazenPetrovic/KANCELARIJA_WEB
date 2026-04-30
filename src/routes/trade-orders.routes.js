import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as TradeOrdersController from "../controllers/trade-orders.controller.js";

const router = Router();

router.post("/create", verifyToken, TradeOrdersController.createTradeOrder);

export default router;
