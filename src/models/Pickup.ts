import mongoose from "mongoose";

export interface PickupDoc extends mongoose.Document {
  pickupId: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pin: string;
  mobile: string;
  status: boolean;
  shipmozoWarehouseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PickupSchema = new mongoose.Schema<PickupDoc>(
  {
    pickupId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address1: { type: String, required: true },
    address2: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pin: { type: String, required: true },
    mobile: { type: String, required: true },
    status: { type: Boolean, default: true },
    shipmozoWarehouseId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const Pickup = mongoose.model<PickupDoc>("Pickup", PickupSchema);
