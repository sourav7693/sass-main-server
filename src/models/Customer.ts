import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

export interface CustomerDoc extends mongoose.Document {
  customerId: string;
  name: string;
  email: string;
  mobile: string;
  gender: string;
  avatar: ImageType;
  addresses: Array<{
    _id: mongoose.Types.ObjectId;
    type: string;
    name: string;
    mobile: string;
    area: string;
    city: string;
    state: string;
    pin: string;
    landmark: string;
    alternateMobile: string;
  }>;
  cart: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    priceAtTime: number;
  }>;
  wishlist: Array<{
    product: mongoose.Types.ObjectId;
    status?: boolean;
  }>;

  totalOrders: number;
  totalSpent: number;
  rewards: {
    points: number;
    tier: string;
  };
  giftCards: Array<{
    code: string;
    balance: number;
    expiry: Date;
  }>;
  recentlyViewed: mongoose.Types.ObjectId[];
  notifications: Array<{
    title: string;
    message: string;
    createdAt: Date;
  }>;

  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },

    name: { type: String, default: "" },
    email: { type: String, default: "" },
    mobile: { type: String, required: true, unique: true },
    gender: {
      type: String,
      enum: ["male", "female", "others"],
      default: "male",
    },
    avatar: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    status: { type: Boolean, default: true },

    addresses: {
      type: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
          type: {
            type: String,
            enum: ["Home", "Office", "Others"],
            default: "Home",
          },
          name: { type: String, default: "" },
          mobile: { type: String, default: "" },
          area: { type: String, default: "" },
          city: { type: String, default: "" },
          state: { type: String, default: "" },
          pin: { type: String, default: "" },
          landmark: { type: String, default: "" },
          alternateMobile: { type: String, default: "" },
        },
      ],
      default: [],
    },

    cart: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          quantity: { type: Number, default: 0 },
          priceAtTime: { type: Number, default: 0 },
        },
      ],
      default: [],
    },

    wishlist: {
      type: [
        {
          product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          status: {
            type: Boolean,
            default: true,
          },
        },
      ],
      default: [],
    },

    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },

    // EMPTY – admin updates later
    rewards: {
      points: { type: Number, default: 0 },
      tier: { type: String, default: "Silver" },
    },

    giftCards: {
      type: [
        {
          code: String,
          balance: Number,
          expiry: Date,
        },
      ],
      default: [],
    },

    recentlyViewed: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
    },

    notifications: {
      type: [
        {
          title: String,
          message: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [
        {
          title: "Welcome!",
          message: "Thanks for joining our store. Enjoy shopping!",
        },
      ],
    },
  },
  { timestamps: true },
);

CustomerSchema.pre("save", function () {
  if (!this.cart?.length) return;

  for (let i = this.cart.length - 1; i >= 0; i--) {
    const item = this.cart[i];

     if (!item) continue;

    if (
      !item.productId ||
      !mongoose.Types.ObjectId.isValid(item.productId)
    ) {
      this.cart.splice(i, 1);
    }
  }
});


export const Customer = mongoose.model<CustomerDoc>("Customer", CustomerSchema);
