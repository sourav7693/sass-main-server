import express from "express";
import {
  createRazorpayOrder,
  verifyPaymentAndCreateOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getCustomerOrders,
} from "../controllers/order.controller";

const router = express.Router();

router.post("/razorpay/create", createRazorpayOrder);
router.post("/razorpay/verify", verifyPaymentAndCreateOrder);

router.get("/", getAllOrders);
router.get("/customers/:id", getCustomerOrders);

router.get("/:orderId", getOrderById);
router.put("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);

export default router;
