import type { Request, Response, NextFunction } from "express";
import { CommunicationProvider } from "../models/communicationSetting";
import mongoose from "mongoose";

 type CommunicationPurpose =
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


export const createCommunicationProvider = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      provider,
      enabled,
      sms_credentials,
      whatsapp_credentials,
      purposes,
    } = req.body;

    // check duplicate
    const exists = await CommunicationProvider.findOne({ provider });
    if (exists) {
      return res.status(400).json({
        message: `${provider} provider already exists`,
      });
    }

    const data: any = {
      provider,
      enabled: enabled ?? true,
      purposes,
    };

    // assign credentials based on provider
    if (provider === "SMS") {
      data.sms_credentials = sms_credentials;
      data.whatsapp_credentials = undefined;
    }

    if (provider === "WHATSAPP") {
      data.whatsapp_credentials = whatsapp_credentials;
      data.sms_credentials = undefined;
    }

    const providerConfig = await CommunicationProvider.create(data);

    res.status(201).json({
      message: "Communication provider created successfully",
      data: providerConfig,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCommunicationProvider = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ message: "Invalid provider id" });
    }

    const {
      enabled,
      sms_credentials,
      whatsapp_credentials,
      purposes,
    } = req.body;

    const providerConfig = await CommunicationProvider.findById(id);

    if (!providerConfig) {
      return res.status(404).json({ message: "Provider not found" });
    }

    /* ---------------- ENABLE / DISABLE PROVIDER ---------------- */
    if (typeof enabled === "boolean") {
      providerConfig.enabled = enabled;
    }

    /* ---------------- UPDATE CREDENTIALS ---------------- */
    if (providerConfig.provider === "SMS" && sms_credentials) {
      providerConfig.sms_credentials = {
        ...providerConfig.sms_credentials,
        ...sms_credentials,
      };
    }

    if (providerConfig.provider === "WHATSAPP" && whatsapp_credentials) {
      providerConfig.whatsapp_credentials = {
        ...providerConfig.whatsapp_credentials,
        ...whatsapp_credentials,
      };
    }

    /* ---------------- UPDATE PURPOSE CONFIG ---------------- */
    if (purposes) {
      (Object.keys(purposes) as CommunicationPurpose[]).forEach((key) => {
        providerConfig.purposes[key] = {
          ...providerConfig.purposes[key],
          ...purposes[key],
        };
      });
    }

    await providerConfig.save();

    res.json({
      success: true,
      message: "Communication provider updated successfully",
      data: providerConfig,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET ALL PROVIDERS
 */
export const getCommunicationProviders = async (
  req: Request,
  res: Response
) => {
  const providers = await CommunicationProvider.find().sort({ createdAt: -1 });
  res.json({ data: providers });
};


export const deleteCommunicationProvider = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Validate Mongo ObjectId
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        message: "Invalid provider id",
      });
    }

    const provider = await CommunicationProvider.findById(id);

    if (!provider) {
      return res.status(404).json({
        message: "Communication provider not found",
      });
    }

    await provider.deleteOne();

    res.json({
      success: true,
      message: "Communication provider deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
