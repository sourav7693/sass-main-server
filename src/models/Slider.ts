import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

export interface SliderDoc extends mongoose.Document {
  sliderId: string;
  name: string;
  image: ImageType;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SliderSchema = new mongoose.Schema<SliderDoc>(
  {
    sliderId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
    },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Slider = mongoose.model<SliderDoc>("Slider", SliderSchema);    