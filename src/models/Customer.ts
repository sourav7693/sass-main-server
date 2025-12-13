import mongoose from "mongoose";
import type { ImageType } from "./Category.js";

export interface CustomerDoc extends mongoose.Document {
  customerId: string;
  name: string;
  email: string;
  mobile: string;
  password: string;
  pin: string;
  role: string;
  avatar: ImageType;
  addresses: Array<{
    _id: mongoose.Types.ObjectId;
    type: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pin: string;
    isPrimary: boolean;
  }>;
  cart: Array<{
    productId: mongoose.Types.ObjectId;
    variantId: mongoose.Types.ObjectId;
    quantity: number;
    priceAtTime: number;
  }>;
  wishlist: mongoose.Types.ObjectId[];
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
  orderList: mongoose.Types.ObjectId[];
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: {
      public_id: { type: String },
      url: { type: String },
    },

    role: { type: String, default: "customer" },
    status: { type: Boolean, default: true },

    addresses: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        type: { type: String, default: "home" },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pin: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // EMPTY ARRAYS BY DEFAULT
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
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
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
  { timestamps: true }
);

export const Customer = mongoose.model<CustomerDoc>("Customer", CustomerSchema);
