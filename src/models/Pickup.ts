import mongoose from "mongoose";

export interface PickupDoc extends mongoose.Document {
    pickupId: string;
    name: string;
    address: string;
    pin: string;
    mobile: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date
}

const PickupSchema = new mongoose.Schema<PickupDoc>(
  {
    pickupId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    pin: { type: String, required: true },
    mobile: { type: String, required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Pickup = mongoose.model<PickupDoc>("Pickup", PickupSchema);