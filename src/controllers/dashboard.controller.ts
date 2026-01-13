import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { Customer } from "../models/Customer";

export const getDashboardOrders = async (req: Request, res: Response) => {
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
      .populate("product", "name price pickup")
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
        (addr) => addr._id.toString() === order.address.toString()
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

export const updateDashboardOrder = async (req: Request, res: Response) => {
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

export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const [
      newOrders,
      pendingOrders,
      totalOrders,
      totalCustomers,
      totalExpense,
    ] = await Promise.all([
      Order.countDocuments({ status: "Processing" }),
      Order.countDocuments({ status: "Cancelled" }),
      Order.countDocuments(),
      Customer.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$orderValue" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      overview: {
        newOrders,
        pendingOrders,
        totalOrders,
        totalCustomers,
        totalExpense: totalExpense[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

export const getDashboardCircularStats = async (req: Request, res: Response) => {

  try {
    const [totalCustomers, customersWithCart, customersWithOrders] =
      await Promise.all([
        Customer.countDocuments(),
        Customer.countDocuments({
          $expr: { $gt: [{ $size: "$cart" }, 0] },
        }),
        Order.distinct("customer"),
      ]);
   
    const customerVsCart =
      totalCustomers === 0
        ? 0
        : Math.round((customersWithCart / totalCustomers) * 100);
  
    const cartVsOrder =
      customersWithCart === 0
        ? 0
        : Math.round(
            (customersWithOrders.length / customersWithCart) * 100
          );
  
    res.json({
      customerVsCart,
      cartVsOrder,
      meta: {
        totalCustomers,
        customersWithCart,
        customersWithOrders: customersWithOrders.length,
      }
    });
  } catch (err) {
    console.error(err);
    res.json({
      customerVsCart: 0,
      cartVsOrder: 0,
      meta: {
        totalCustomers: 0,
        customersWithCart: 0,
        customersWithOrders: 0,
      }
    });
  }
};
