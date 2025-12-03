import mongoose, { Schema, Document, Model } from "mongoose";

export interface VariableDoc extends Document {
  variableId: string;
  name: string;
  value: string[];
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VariableSchema = new Schema<VariableDoc>(
  {
    variableId: { type: String, required: true },
    name: { type: String, required: true },
    value: { type: [String], required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Variable: Model<VariableDoc> = mongoose.model(
  "Variable",
  VariableSchema
);
