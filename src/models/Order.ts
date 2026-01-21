import mongoose from "mongoose";

export interface OrderDoc extends mongoose.Document {
  orderId: string;

  payment: mongoose.Types.ObjectId; // 🔗 link to Payment
  customer: mongoose.Types.ObjectId;

  mobile: string;
  address: mongoose.Types.ObjectId;

  product: mongoose.Types.ObjectId; // 🔥 FINAL SKU
  quantity: number;
  price: number;
  orderValue: number;

  couponCode?: string;
  couponDiscount?: number;

  status:
    | "Processing"
    | "Confirmed"
    | "Shipped"
    | "InTransit"
    | "OutForDelivery"
    | "Delivered"
    | "Cancelled"
    | "RTO";

  paymentStatus: "Paid" | "Unpaid" | "Refunded";

  shipping: {
    shipmozoOrderId?: string;
    courierId?: number;
    courierName?: string;
    awbNumber?: string;
    trackingUrl?: string;
    labelGenerated?: boolean;
    currentStatus?: string;
    expectedDeliveryDate?: string;
    lastStatusTime?: string;
    trackingHistory?: {
      date: string;
      status: string;
      location: string;
    }[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new mongoose.Schema<OrderDoc>(
  {
    orderId: { type: String, unique: true },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    mobile: { type: String, required: true },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    orderValue: { type: Number, required: true },

    couponCode: String,
    couponDiscount: Number,

    status: {
      type: String,
      enum: [
        "Processing",
        "Confirmed",
        "Shipped",
        "InTransit",
        "OutForDelivery",
        "Delivered",
        "Cancelled",
        "RTO",
      ],
      default: "Processing",
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Unpaid", "Refunded"],
      default: "Paid",
    },

    shipping: {
      shipmozoOrderId: String,
      courierId: Number,
      courierName: String,
      awbNumber: String,
      trackingUrl: String,
      labelGenerated: { type: Boolean, default: false },
      currentStatus: String,
      expectedDeliveryDate: String,
      lastStatusTime: String,

      trackingHistory: [
        {
          date: String,
          status: String,
          location: String,
        },
      ],
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model<OrderDoc>("Order", OrderSchema);
