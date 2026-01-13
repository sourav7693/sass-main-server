import mongoose from "mongoose";

export interface PaymentDoc extends mongoose.Document {
  paymentGroupId: string; // internal payment reference (PG-001)

  customer: mongoose.Types.ObjectId;

  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;

  amount: string;
  currency: string;

  method: string; 
  status: "Created" | "Paid" | "Failed" | "Refunded";

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new mongoose.Schema<PaymentDoc>(
  {
    paymentGroupId: { type: String, unique: true },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },

    amount: { type: String, required: true },
    currency: { type: String, default: "INR" },

    method: { type: String },
    status: {
      type: String,
      enum: ["Created", "Paid", "Failed", "Refunded"],
      default: "Created",
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<PaymentDoc>("Payment", PaymentSchema);
