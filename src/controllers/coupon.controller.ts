import type { Request, Response } from "express";
import { Coupon } from "../models/Coupon.ts";
import { generateCustomId } from "../utils/generateCustomId.ts";

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expirationDate,
      usageLimit
    } = req.body;

    const exists = await Coupon.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }
    
    const couponId = await generateCustomId(Coupon, "couponId", "CUP");

    const coupon = await Coupon.create({
      couponId,
      name,
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expirationDate,
      usageLimit,
    });

    return res.status(201).json({ message: "Coupon created", coupon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};

// GET ALL COUPONS (Paginated + Search)
export const getCoupons = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const query = search
      ? { code: { $regex: search as string, $options: "i" } }
      : {};

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Coupon.countDocuments(query);

    return res.json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      coupons,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};

// UPDATE COUPON
export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updated = await Coupon.findOneAndUpdate({ couponId: id }, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.json({ message: "Coupon updated", coupon: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};

// DELETE COUPON
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await Coupon.findOneAndDelete({ couponId: id });

    if (!deleted) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.json({ message: "Coupon deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};
