import mongoose, { Document, Types } from "mongoose";

interface IScheduledCustomer {
  customerId: Types.ObjectId;
  mobile: string;
  name?: string;
  status: "pending" | "sent" | "failed";
  sentAt?: Date;
  messageId?: string;
  error?: string;
}

// Main interface
interface ICampaign extends Document {
  templateId: string;
  templateName: string;
  customerType: "all" | "ordered" | "registered" | "cart" | "wishlist";
  parameters: Map<string, string>;
  parametersArray: string[];
  scheduledCustomers: IScheduledCustomer[]; // ✅ Use interface, not schema
  totalCustomers: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  sendImmediately: boolean;
  scheduledFor?: Date;
  startedAt?: Date;
  mobileNumbers: string[];
  completedAt?: Date;
  cancelledAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledCustomerSchema = new mongoose.Schema<IScheduledCustomer>({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "sent", "failed"],
    default: "pending",
  },
  sentAt: {
    type: Date,
  },
  messageId: {
    type: String,
  },
  error: {
    type: String,
  },
});

const campaignSchema = new mongoose.Schema<ICampaign>(
  {
    templateId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
    },
    customerType: {
      type: String,
      required: true,
      enum: ["all", "ordered", "registered", "cart", "wishlist"],
    },
    parameters: {
      type: Map,
      of: String,
      default: {},
    },
    parametersArray: {
      type: [String],
      default: [],
    },
    scheduledCustomers: [scheduledCustomerSchema],
    totalCustomers: {
      type: Number,
      default: 0,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["scheduled", "processing", "completed", "failed", "cancelled"],
      default: "scheduled",
    },
    sendImmediately: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    mobileNumbers: {
      type: [String],
      default: [],
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index for querying scheduled campaigns
campaignSchema.index({ status: 1, scheduledFor: 1 });
campaignSchema.index({ createdAt: -1 });

export const Campaign =
  mongoose.models.Campaign ||
  mongoose.model<any>("Campaign", campaignSchema);
