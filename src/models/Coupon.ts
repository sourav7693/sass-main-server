import mongoose from "mongoose";

export interface CouponDoc extends mongoose.Document {
  couponId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  startDate: Date;
  expirationDate: Date;
  usageLimit: number;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new mongoose.Schema<CouponDoc>(
  {
    couponId: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    discountType: { type: String, required: true },
    discountValue: { type: Number, required: true },
    minOrderAmount: { type: Number, required: true },
    maxDiscountAmount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    usageLimit: { type: Number, required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<CouponDoc>(
  "Coupon",
  CouponSchema
);