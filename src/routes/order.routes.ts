import express from "express";
import {
  createRazorpayOrder,
  verifyPaymentAndCreateOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

router.post("/razorpay/create", createRazorpayOrder);
router.post("/razorpay/verify", verifyPaymentAndCreateOrder);

router.get("/", getAllOrders);
router.get("/:orderId", getOrderById);
router.put("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);

export default router;
