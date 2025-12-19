import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

export interface ReviewDoc extends mongoose.Document {
  product: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId; // optional (guest review allowed)
  personName: string;

  rating: number; // 1–5
  title?: string;
  description: string;

  images?: ImageType[];

  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new mongoose.Schema<ReviewDoc>(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    personName: { type: String, required: true },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    title: String,
    description: { type: String, required: true },

    images: [
      {
        public_id: String,
        url: String,
      },
    ],

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Review = mongoose.model<ReviewDoc>("Review", ReviewSchema);
