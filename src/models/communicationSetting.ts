import mongoose, { Schema, Document } from "mongoose";

export type CommunicationPurpose =
  | "LOGIN_OTP"
  | "SIGNUP_OTP"
  | "ORDER_CONFIRMATION"
  | "ORDER_CANCELLATION"
  | "ORDER_REFUND"
  | "ORDER_REPLACEMENT"
  | "PRODUCT_SHIPPED"
  | "PROMOTIONAL_ALL"
  | "PROMOTIONAL_CART"
  | "PROMOTIONAL_REGISTERED";

export type ProviderType = "SMS" | "WHATSAPP";

interface PurposeConfig {
  enabled: boolean;
  templateId?: string; 
  templateName?: string;
}

export interface CommunicationProviderDocument extends Document {
  provider: ProviderType;

  enabled: boolean; 

  sms_credentials: {
    apiKey?: string;
    senderId?: string; 
    phoneNumberId?: string; 
  };
    whatsapp_credentials: {
    auth_key?: string;
    app_key?: string; 
    device_id?: string; 
  };

  purposes: Record<CommunicationPurpose, PurposeConfig>;

  createdAt: Date;
  updatedAt: Date;
}

const PurposeSchema = new Schema<PurposeConfig>(
  {
    enabled: { type: Boolean, default: false },
    templateId: { type: String },
    templateName: { type: String },
  },
  { _id: false }
);

const CommunicationProviderSchema = new Schema<CommunicationProviderDocument>(
  {
    provider: {
      type: String,
      enum: ["SMS", "WHATSAPP"],
      required: true,
      unique: true,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    sms_credentials: {
      apiKey: { type: String },
      senderId: { type: String },
      phoneNumberId: { type: String },
    },

     whatsapp_credentials: {
      auth_key: { type: String },
      app_key: { type: String },
      device_id: { type: String },
    },

    purposes: {
  LOGIN_OTP: { type: PurposeSchema, default: {} },
  SIGNUP_OTP: { type: PurposeSchema, default: {} },
  ORDER_CONFIRMATION: { type: PurposeSchema, default: {} },
  ORDER_CANCELLATION: { type: PurposeSchema, default: {} },
  ORDER_REFUND: { type: PurposeSchema, default: {} },
  ORDER_REPLACEMENT: { type: PurposeSchema, default: {} },
  PRODUCT_SHIPPED: { type: PurposeSchema, default: {} },
  PROMOTIONAL_ALL: { type: PurposeSchema, default: {} },
  PROMOTIONAL_CART: { type: PurposeSchema, default: {} },
  PROMOTIONAL_REGISTERED: { type: PurposeSchema, default: {} },
    },
  },
  { timestamps: true }
);

export const CommunicationProvider =
  mongoose.model<CommunicationProviderDocument>(
    "CommunicationProvider",
    CommunicationProviderSchema
  );


/*
{
  "provider": "SMS",
  "enabled": true,
  "credentials": {
    "apiKey": "sms_key",
    "senderId": "SHOPIT"
  },
  "purposes": {
    "LOGIN_OTP": { "enabled": true, "templateId": "OTP_LOGIN" },
    "SIGNUP_OTP": { "enabled": true, "templateId": "OTP_SIGNUP" },
    "MARKETING": { "enabled": false }
  }
}

{
  "provider": "WHATSAPP",
  "enabled": true,
  "credentials": {
    "apiKey": "wa_key",
    "phoneNumberId": "123456789"
  },
  "purposes": {
    "MARKETING": {
      "enabled": true,
      "templateName": "promo_offer"
    },
    "ORDER_UPDATE": {
      "enabled": true,
      "templateName": "order_status"
    }
  }
}

*/ 