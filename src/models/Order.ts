import mongoose from "mongoose";

export interface OrderDoc extends mongoose.Document {
  orderId: string;
  customer: mongoose.Types.ObjectId;
  mobile: string;
  address: mongoose.Types.ObjectId;  
  couponCode: string;
  couponDiscount: number;
  razorPayPaymentId: string;
  razorPayOrderId: string;
  razorPaySignature: string;
  paymentMethod: string;
  orderValue: number;
  items: Array<{
    product: mongoose.Types.ObjectId;
    quantity: number;    
  }>;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new mongoose.Schema<OrderDoc>(
  {
    orderId: { type: String, required: true, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    mobile: { type: String, required: true },
    address: { type: mongoose.Schema.Types.ObjectId, required: true },
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },
    razorPayPaymentId: { type: String, required: true },
    razorPayOrderId: { type: String, required: true },
    razorPaySignature: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    orderValue: { type: Number, required: true },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, default: 1 },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "delivered", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "failed"],
      default: "unpaid",
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model<OrderDoc>("Order", OrderSchema);