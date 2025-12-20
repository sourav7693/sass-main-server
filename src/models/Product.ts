import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

type SpecificationType = {
  name:string;
  details:string;

}

export interface ProductDoc extends mongoose.Document {
  productId: string;
  slug:string;

  parentProduct?: mongoose.Types.ObjectId | null;
  isVariant?: boolean;
  variants?: mongoose.Types.ObjectId[];

  name: string;
  shortDescription: string;
  longDescription: string;

  coverImage: ImageType;
  images?: ImageType[];
  video?: ImageType;

  categoryLevels: mongoose.Types.ObjectId[];
  brand: mongoose.Types.ObjectId;
  attributes: mongoose.Types.ObjectId[];
  variables? : {
    name: string;
    values: string[];
  }[];
  pickup: mongoose.Types.ObjectId | null;
  averageRating: number;
  ratingCount: number;
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  
  specifications: SpecificationType[],

  mrp: number;
  price: number;
  discount: number;
  stock: number;

  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}



const SpecificationSchema = new mongoose.Schema<SpecificationType>({
  name: {
    type: String,
  },
  details: {
    type: String,
  },
});

const ProductSchema = new mongoose.Schema<ProductDoc>(
  {
    productId: { type: String, required: true, unique: true },
    slug:{type: String, required: true, unique: true},

    // Varaint prod
    parentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    isVariant: { type: Boolean, default: false },
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    name: { type: String, required: true },
    shortDescription: String,
    longDescription: String,

    coverImage: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
    images: [
      {
        public_id: { type: String },
        url: { type: String },
      },
    ],

    video: {
      public_id: { type: String },
      url: { type: String },
    },

    categoryLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    attributes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attribute" }],
    variables: [
      {
        name: { type: String },
        values: [String],
      },
    ],
    pickup: { type: mongoose.Schema.Types.ObjectId, ref: "Pickup" },
    specifications: [SpecificationSchema],

    averageRating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },

    mrp: Number,
    price: Number,
    discount: Number,
    stock: Number,

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = mongoose.model<ProductDoc>("Product", ProductSchema);
