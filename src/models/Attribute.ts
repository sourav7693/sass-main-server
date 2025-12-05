import mongoose from "mongoose";

export interface AttributeDoc extends mongoose.Document {
  attributeId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  status: boolean;
}

const AttributeSchema = new mongoose.Schema<AttributeDoc>(
  {
    attributeId: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Attribute = mongoose.model<AttributeDoc>(
  "Attribute",
  AttributeSchema
);