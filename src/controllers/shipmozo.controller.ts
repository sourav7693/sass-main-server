import type { Request, Response } from "express";
import { Order } from "../models/Order";
import axios from "axios";

const formatMobile = (mobile: string) => {
  const raw = mobile.replace(/\D/g, "");
  return raw.startsWith("91") ? raw : "91" + raw;
};

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
    }).populate("customer");

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
      await axios.post("https://web.wabridge.com/api/createmessage", {
        "auth-key": process.env.WA_AUTH_KEY,
        "app-key": process.env.WA_APP_KEY,
        destination_number: formatMobile(order.mobile),
        template_id: "1189674629421688",
        device_id: process.env.WA_DEVICE_ID,
        language: "en",
        variables: [order.orderId, expected_delivery_date],
      });
      order.status = "OutForDelivery";
    } else if (current_status === "Shipment picked up") {
      order.status = "InTransit";
      await axios.post("https://web.wabridge.com/api/createmessage", {
        "auth-key": process.env.WA_AUTH_KEY,
        "app-key": process.env.WA_APP_KEY,
        destination_number: formatMobile(order.mobile),
        template_id: "827590426765356",
        device_id: process.env.WA_DEVICE_ID,
        language: "en",
        variables: [order.customer.name, order.orderId, expected_delivery_date],
      });
    }

    await order.save();

    console.log("✅ Order updated from webhook:", order.orderId);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Shipmozo webhook error:", err);
    return res.status(500).json({ success: false });
  }
};
