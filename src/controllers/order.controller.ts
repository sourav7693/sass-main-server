import type { NextFunction, Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { generateCustomId } from "../utils/generateCustomId";
import { Order } from "../models/Order";
import type mongoose from "mongoose";
import { pushOrderToShipmozo } from "../services/shipmozo.pushOrder";
import { prepareCourierForOrder } from "../services/shipmozo.prepareCourier";
import { Pickup } from "../models/Pickup";
import { Customer } from "../models/Customer";
import { Payment } from "../models/Payment";
import { Product } from "../models/Product";
import Mongoose  from "mongoose";

type CustomerWithAddresses = {
  addresses?: Array<{
    _id: mongoose.Types.ObjectId;
    type?: string;
    name?: string;
    mobile: string;
    area: string;
    city: string;
    state: string;
    pin: string;
    landmark?: string;
    alternateMobile?: string;
  }>;
};

export const extractOrderAddress = (
  orderAddressId: mongoose.Types.ObjectId,
  customer?: CustomerWithAddresses,
) => {
  if (!customer?.addresses?.length) return null;

  return (
    customer.addresses.find(
      (addr) => addr._id.toString() === orderAddressId.toString(),
    ) || null
  );
};

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
  res: Response,
) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer,
      mobile,
      address,
      items, // [{ product, quantity, price }]
      couponCode,
      couponDiscount,
    } = req.body;

    /* ---------------- VERIFY SIGNATURE ---------------- */
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

    /* ---------------- FETCH PAYMENT ---------------- */
    const razorPayment = await razor.payments.fetch(razorpay_payment_id);

    /* ---------------- CREATE PAYMENT RECORD ---------------- */
    const paymentGroupId = await generateCustomId(
      Payment,
      "paymentGroupId",
      "PAY-",
      { enable: true },
    );

    const payment = await Payment.create({
      paymentGroupId,
      customer,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      amount: String(Number(razorPayment.amount) / 100),
      currency: razorPayment.currency,
      method: razorPayment.method,
      status: "Paid",
    });

    /* ---------------- CREATE ORDERS (ONE PER PRODUCT) ---------------- */
    const orders = [];

    for (const item of items) {
      const orderId = await generateCustomId(Order, "orderId", "PPN-", {
        enable: true,
      });

      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      await Product.findByIdAndUpdate(
        product._id,
        {
          $inc: { stock: -item.quantity }, // 🔥 IMPORTANT
        },
        { new: true },
      );

      const order = await Order.create({
        orderId,
        payment: payment._id, // 🔗 link payment
        customer,
        mobile,
        address,

        product: item.product,
        quantity: item.quantity,
        price: item.price,
        orderValue: item.price * item.quantity,

        couponCode,
        couponDiscount,

        paymentStatus: "Paid",
        status: "Processing",
      });

      orders.push(order);
    }

    /* ---------------- CLEAR CART ---------------- */
 await Customer.updateOne(
  { _id: customer },
  {
    $pull: {
      cart: {
        productId: {
          $in: items.map(
            (i: any) => new Mongoose.Types.ObjectId(i.product)
          ),
        },
      },
    },
  }
);


    /* ---------------- RESPONSE ---------------- */
    res.status(201).json({
      success: true,
      paymentGroupId: payment.paymentGroupId,
      orders: orders.map((o) => o.orderId),
      message: "Payment verified & orders created",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId })
    .populate("customer", "name mobile addresses")
    .populate("product")
    .populate("payment")
    .lean();

  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });
  const customer = order.customer as any;

  const address = customer?.addresses?.find(
    (addr: any) => addr._id.toString() === order.address.toString(),
  );

  res.json({
    success: true,
    order: {
      ...order,
      address,
    },
  });
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      search,
      status,
    } = req.query;

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    const skip = (+page - 1) * +limit;
    const sortOrder = order === "asc" ? 1 : -1;

    const orders = await Order.find(filter)
      .populate("customer")
      .populate(
        "product",
        "name price pickup mrp discount productId weight dimensions typeOfPackage stock ",
      )
      .populate("payment")
      .sort({ [sort as string]: sortOrder })
      .skip(skip)
      .limit(+limit)
      .lean();

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
        (addr) => addr._id.toString() === order.address.toString(),
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

export const getCustomerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerId = req.params.id;

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
    const toDate = req.query.to ? new Date(String(req.query.to)) : null;

    const filter: any = {
      customer: customerId,
    };

    // 📅 DATE FILTER
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = fromDate;
      if (toDate) filter.createdAt.$lte = toDate;
    }

    const [totalOrders, orders] = await Promise.all([
      Order.countDocuments(filter),

      Order.find(filter)
        .populate({
          path: "product",
          select: "name slug coverImage price mrp discount shortDescription longDescription variables stock",
        })
        .populate("payment")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        totalOrders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;

  // ✅ FULL populate (mandatory)
  const order = await Order.findOne({ orderId })
    .populate("customer")
    .populate(
      "product",
      "name price pickup mrp discount productId weight dimensions typeOfPackage",
    )
    .populate("payment");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const previousStatus = order.status;

  // ❌ Do not allow changes after shipped
  if (previousStatus === "Shipped") {
    return res.status(400).json({
      message: "Shipped orders cannot be modified",
    });
  }

  // 🔑 RESOLVE ADDRESS HERE (same as getAllOrders)
  const resolvedAddress = extractOrderAddress(
    order.address as any,
    order.customer as any,
  );

  if (!resolvedAddress) {
    return res.status(400).json({
      message: "Order address not found in customer addresses",
    });
  }

  // Attach resolved address (runtime only)
  (order as any).address = resolvedAddress;

  const firstItem = order.product as any;
  if (!firstItem) {
    return res.status(400).json({
      message: "Order has no items",
    });
  }
  const pickupId = (firstItem as any).pickup;

  const pickup = await Pickup.findById(pickupId);

  const pickupCode = pickup?.pin;

  // 🚀 Shipmozo flow ONLY on Processing → Confirm
  if (previousStatus === "Processing" && status === "Confirmed") {
    const shipmozo = await pushOrderToShipmozo(order, resolvedAddress);

    order.shipping = {
      shipmozoOrderId: shipmozo.order_id,
    };

    const courier = await prepareCourierForOrder(
      order,
      resolvedAddress,
      pickupCode || "",
    );

    order.shipping = {
      ...order.shipping,
      courierId: courier.courierId,
      courierName: courier.courierName,
      awbNumber: courier.awbNumber,
      trackingUrl: `https://shipping-api.com/app/api/v1/track-order?awb_number=${courier.awbNumber}`,
      labelGenerated: false,
      currentStatus: "Shipped",
    };

    order.status = "Shipped";
  } else if (status === "Cancelled") {
    const customer = await Customer.findById(order.customer);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    customer.totalOrders = customer.totalOrders - 1;
    customer.totalSpent = customer.totalSpent - order.orderValue;
    await customer.save();
  } else {
    order.status = status;
  }

  await order.save();

  res.json({ success: true, order });
};

export const deleteOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const deleted = await Order.findOneAndDelete({ orderId });

  if (!deleted)
    return res.status(404).json({ success: false, message: "Order not found" });

  res.json({ success: true, message: "Order deleted" });
};
