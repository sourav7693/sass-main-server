import { Order } from "../models/Order";
import mongoose from "mongoose";

export const isVerifiedBuyer = async (
  customerId: string,
  productId: string,
): Promise<boolean> => {
  const order = await Order.exists({
    $and: [
      { customer: new mongoose.Types.ObjectId(customerId) },
      { status: "Delivered" },
      { product: new mongoose.Types.ObjectId(productId) },
    ],
  });

  return !!order;
};
