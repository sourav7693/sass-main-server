import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

export interface BrandDoc extends mongoose.Document {
  brandId: string;
  name: string;
  image: ImageType;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new mongoose.Schema<BrandDoc>(
  {
    brandId: { type: String, required: true },
    name: { type: String, required: true },
    image: {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
    },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Brand = mongoose.model<BrandDoc>("Brand", BrandSchema);