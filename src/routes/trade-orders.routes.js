import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as TradeOrdersController from "../controllers/trade-orders.controller.js";

const router = Router();

router.post("/create", verifyToken, TradeOrdersController.createTradeOrder);
router.get("/active", verifyToken, TradeOrdersController.getActiveOrders);
router.get(
  "/active/:orderId/items",
  verifyToken,
  TradeOrdersController.getActiveOrderItems,
);
router.get(
  "/partner-history",
  verifyToken,
  TradeOrdersController.getPartnerOrderHistory,
);

export default router;
