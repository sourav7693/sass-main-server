import { Order } from "../models/Order.js";
import mongoose from "mongoose";

export const isVerifiedBuyer = async (
  customerId: string,
  productId: string
): Promise<boolean> => {
  const order = await Order.exists({
    customer: new mongoose.Types.ObjectId(customerId),
    status: "delivered",
    "items.product": new mongoose.Types.ObjectId(productId),
  });

  return !!order;
};
