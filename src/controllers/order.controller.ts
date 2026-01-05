import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { generateCustomId } from "../utils/generateCustomId.js";
import { Order } from "../models/Order.js";
import type mongoose from "mongoose";

const razor = new Razorpay({
  key_id: process.env.RAZORPAY_SECRET_ID!,
  key_secret: process.env.RAZORPAY_SECRET_KEY!,
});

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

interface RazorpayPayment {
  method: string;
  [key: string]: unknown; // allow any extra fields Razorpay returns
}

export interface CreateOrderResponse {
  success: boolean;
  order?: RazorpayOrder;
  key?: string;
  message?: string;
}

export interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  orderId: string | null;
  message?: string;
}

export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    const { amount, currency = "INR" } = req.body;

    const order = await razor.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `rcpt_${Date.now()}`,
      payment_capture: true,
    });

    res.status(200).json({
      success: true,
      order,
      key: process.env.RAZORPAY_SECRET_ID,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
};

export const verifyPaymentAndCreateOrder = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer,
      mobile,
      address,
      items,
      couponCode,
      couponDiscount,
      orderValue,
    } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const payment = await razor.payments.fetch(razorpay_payment_id);
    // const format = new Date(payment.created_at * 1000).toLocaleString();

    const orderId = await generateCustomId(Order, "orderId", "PPN-", {
      enable: true,
    });

    const order = await Order.create({
      orderId,
      customer,
      mobile,
      address,
      items,
      couponCode,
      couponDiscount,
      orderValue,
      razorPayOrderId: razorpay_order_id,
      razorPayPaymentId: razorpay_payment_id,
      razorPaySignature: razorpay_signature,
      paymentMethod: payment.method,
      paymentStatus: razorpay_signature ? "Paid" : "Failed",
      status: "Processing",
    });

    res.status(201).json({
      success: true,
      orderId: order.orderId,
      message: "Payment verified and order created",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      search,
    } = req.query;

    const filter : Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (+page - 1) * +limit;
    const sortOrder = order === "asc" ? 1 : -1;

    const orders = await Order.find(filter)
      .populate("customer")
      .populate("items.product", "name price pickup")
      .sort({ [sort as string]: sortOrder })
      .skip(skip)
      .limit(+limit)
      .lean()

      const formattedOrders = orders.map((order) => {
      const customer = order.customer as {
        addresses?: Array<{
          _id: mongoose.Types.ObjectId;
          alternateMobile: string;
          city: string;
          state: string;
          pin: string;
          landmark: string;
          area: string;
          mobile: string;
        }>;
      };

      const address = customer?.addresses?.find(
        (addr) =>
          addr._id.toString() === order.address.toString()
      );

      return {
        ...order,
        address, 
      };
    });

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId })
    .populate("customer", "name mobile addresses")
    .populate("items.product")
    .lean();

  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
    const customer = order.customer as any;

  const address = customer?.addresses?.find(
    (addr: any) =>
      addr._id.toString() === order.address.toString()
  );

    res.json({
    success: true,
    order: {
      ...order,
      address,
    },
  });

};

export const updateOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await Order.findOneAndUpdate(
    { orderId },
    { $set: req.body },
    { new: true }
  );

  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });

  if (order.status === "Shipped" && status !== "Shipped") {
    return res.status(400).json({
      success: false,
      message: "Shipped orders cannot be modified",
    });
  }

  res.json({ success: true, order });
};

export const deleteOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const deleted = await Order.findOneAndDelete({ orderId });

  if (!deleted)
    return res.status(404).json({ success: false, message: "Order not found" });

  res.json({ success: true, message: "Order deleted" });
};


