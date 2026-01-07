import { Router } from "express";
import {
    getDashboardCircularStats,
 getDashboardOrders,
 getDashboardOverview,
 updateDashboardOrder
} from "../controllers/dashboard.controller.ts";
import { protect } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/", protect, getDashboardOrders);
router.get("/circular-stats", protect, getDashboardCircularStats);
router.get("/overview", protect, getDashboardOverview);
router.put("/:orderId", protect, updateDashboardOrder);

export default router;