import type { Request, Response } from "express";
import { Order } from "../models/Order.ts";


export const shipmozoWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    console.log("📦 Shipmozo Webhook Received:", payload);

    const {
      order_id,
      awb_number,
      carrier,
      current_status,
      status_time,
      expected_delivery_date,
      status_feed,
    } = payload;

    // 🔍 Find order using Shipmozo order id OR AWB
    const order = await Order.findOne({
      "shipping.shipmozoOrderId": order_id,
    });

    if (!order) {
      console.warn("⚠️ Order not found for webhook:", order_id);
      return res.status(200).json({ success: false });
    }

    // ✅ Update shipping details
    order.shipping = {
      ...order.shipping,
      awbNumber: awb_number,
      courierName: carrier,
      currentStatus: current_status,
      expectedDeliveryDate: expected_delivery_date,
      lastStatusTime: status_time,
      trackingHistory: status_feed?.scan || [],
    };

    // 🔄 Auto order status mapping
    if (current_status === "Delivered") {
      order.status = "Delivered";
      order.paymentStatus = "Paid";
    } else if (current_status === "Out for delivery") {
      order.status = "OutForDelivery";
    } else if (current_status === "Shipment picked up") {
      order.status = "InTransit";
    }

    await order.save();

    console.log("✅ Order updated from webhook:", order.orderId);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Shipmozo webhook error:", err);
    return res.status(500).json({ success: false });
  }
};
