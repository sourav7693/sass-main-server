import mongoose, { Document, Schema } from "mongoose";

export interface ImageType {
  public_id?: string;
  url?: string;
}

export interface Level {
  type: string;
  name?: string; // optional for child levels
  image?: ImageType;
  children?: Level[];
}

export interface CategoryDoc extends Document {
  categoryId: string;
  name: string;
  image: ImageType;
  children: Level[];
  createdAt: Date;
  updatedAt: Date;
}

const LevelSchema = new Schema(
  {}
);

LevelSchema.add({
  type: { type: String, required: true },
  name: { type: String },
  image: {
    public_id: { type: String },
    url: { type: String },
  },
  children: { type: [LevelSchema], default: [] }, // recursive
});

const CategorySchema = new Schema<CategoryDoc>(
  {
    categoryId: { type: String, required: true },
    name: { type: String, required: true },
    image: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
    children: { type: [LevelSchema], default: [] },
  },
  { timestamps: true }
);

export const Category = mongoose.model<CategoryDoc>("Category", CategorySchema);
