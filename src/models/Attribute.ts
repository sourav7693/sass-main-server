import mongoose from "mongoose";

export interface AttributeDoc extends mongoose.Document {
  name: string;
  values: string[];
}