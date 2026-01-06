import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

type SpecificationType = {
  name: string;
  details: string;
};

type DimensionType = {
  no_of_box: string;
  length: string;
  width: string;
  height: string;
};

export type TypeOfPackage =
  | "PLANT_BOX"
  | "PLANT_MAILER"
  | "NURSERY_POT_WRAP"
  | "POLY_BAG"
  | "GIFT_BOX"
  | "SERVICE_ONLY";

export type TypeOfReturn =
  | "RETURN_ONLY"
  | "REPLACEMENT_ONLY"
  | "RETURN_AND_REPLACEMENT"
  | "NO_RETURN_NO_REPLACEMENT";

export interface ProductDoc extends mongoose.Document {
  productId: string;
  slug: string;

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
  variables?: {
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

  specifications: SpecificationType[];

  mrp: number;
  price: number;
  discount: number;
  stock: number;

  status: boolean;

  weight: number;
  dimensions: DimensionType[];
  typeOfPackage: TypeOfPackage;
  returnPolicy: TypeOfReturn;
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

const DimensionSchema = new mongoose.Schema<DimensionType>({
  no_of_box: { type: String, required: true },
  length: { type: String, required: true },
  width: { type: String, required: true },
  height: { type: String, required: true },
});

const ProductSchema = new mongoose.Schema<ProductDoc>(
  {
    productId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },

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

    weight: { type: Number, required: true },

    dimensions: [DimensionSchema],

    typeOfPackage: {
      type: String,
      enum: [
        "PLANT_BOX",
        "PLANT_MAILER",
        "NURSERY_POT_WRAP",
        "POLY_BAG",
        "GIFT_BOX",
        "SERVICE_ONLY",
      ],
      default: "PLANT_BOX",
    },
    returnPolicy: {
      type: String,
      enum: [
        "RETURN_ONLY",
        "REPLACEMENT_ONLY",
        "RETURN_AND_REPLACEMENT",
        "NO_RETURN_NO_REPLACEMENT",
      ],
      default: "NO_RETURN_NO_REPLACEMENT",
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model<ProductDoc>("Product", ProductSchema);
