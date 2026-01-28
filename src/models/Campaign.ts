import mongoose from "mongoose";

const scheduledCustomerSchema = new mongoose.Schema({
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

const campaignSchema = new mongoose.Schema(
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

const Campaign =
  mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema);

export default Campaign;
