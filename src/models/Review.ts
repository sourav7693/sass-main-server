import mongoose from "mongoose";
import type { ImageType, VideoType } from "./Category.js";

export interface ReviewDoc extends mongoose.Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;

  rating: number; // 1–5
  title?: string;
  description: string;

  supporting_files?: ImageType[] | VideoType[];

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
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    title: {
      type: String,
      trim: true,
    },
    description: { type: String, required: true, trim: true },

    supporting_files: [
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
  { timestamps: true },
);

export const Review =
  mongoose.models.Review || mongoose.model<ReviewDoc>("Review", ReviewSchema);
