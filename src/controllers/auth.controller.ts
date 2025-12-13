import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request, Response } from "express";
import { Customer } from "../models/Customer.js";
import { generateCustomId } from "../utils/generateCustomId.js";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN!;
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN!;

const signToken = (payload: JwtPayload, expiresIn: string | number): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn });

export const register = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      avatar,
      addresses,
      role,
      status,
      cart,
      wishlist,
      totalOrders,
      totalSpent,
      rewards,
      giftCards,
      recentlyViewed,
      notifications,
    } = req.body;

    const exists = await Customer.findOne({
      $or: [{ email }, { mobile }],
    });
    const hash = await bcrypt.hash(password, 12);

    if (exists) {
      return res.status(400).json({ message: "Customer already exists" });
    }
    const customerId = await generateCustomId(Customer, "customerId", "CUS");
    const newCustomer = await Customer.create({
      customerId,
      name,
      email,
      mobile,
      password: hash,
      avatar,
      addresses,
      role,
      status,
      cart,
      wishlist,
      totalOrders,
      totalSpent,
      rewards,
      giftCards,
      recentlyViewed,
      notifications,
    });
    if (!newCustomer) {
      return res.status(400).json({ message: "Failed to create customer" });
    }

    // create tokens
    const accessToken = signToken({ id: newCustomer._id }, JWT_EXPIRES_IN);
    const refreshToken = signToken({ id: newCustomer._id }, REFRESH_EXPIRES_IN);

    // set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // return minimal profile + access token
    res.status(201).json({
      message: "Customer created",
      customer: newCustomer,
      accessToken,
    });
    // res.status(201).json({
    //   message: "Registered",
    //   data: {
    //     id: customer._id,
    //     name: customer.name,
    //     email: customer.email,
    //     mobile: customer.mobile,
    //   },
    //   accessToken,
    // });
  } catch (error) {
    res
      .status(500)
      .json({
        message: error instanceof Error ? error.message : "Server Error",
      });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { emailOrMobile, password } = req.body;
    if (!emailOrMobile || !password)
      return res.status(400).json({ message: "Missing credentials" });

    const customer = await Customer.findOne({
      $or: [{ email: emailOrMobile }, { mobile: emailOrMobile }],
    });

    if (!customer) return res.status(401).json({ message: "Invalid creds" });

    const ok = await bcrypt.compare(password, customer.password);
    if (!ok) return res.status(401).json({ message: "Invalid creds" });

    const accessToken = signToken({ id: customer._id }, JWT_EXPIRES_IN);
    const refreshToken = signToken({ id: customer._id }, REFRESH_EXPIRES_IN);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({
      message: "Logged in",
      data: {
        id: customer.customerId,
        name: customer.name,
        email: customer.email,
      },
      accessToken,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: error instanceof Error ? error.message : "Server Error",
      });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const customer = await Customer.findById(decoded.id);
    if (!customer) return res.status(401).json({ message: "User not found" });

    const accessToken = signToken({ id: customer._id }, JWT_EXPIRES_IN);
    res.json({ accessToken });
  } catch (error) {
    res
      .status(500)
      .json({
        message: error instanceof Error ? error.message : "Server Error",
      });
  }
};

export const logout = async (req : Request, res : Response) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.json({ message: "Logged out" });
  } catch (error) {
     res
      .status(500)
      .json({
        message: error instanceof Error ? error.message : "Server Error",
      });
  }
  
};

export const getMe = async (req: Request, res: Response) => {
  try {
    res.status(200).json({ message: "Success", data: req.user });
  } catch (error) {
     res
      .status(500)
      .json({
        message: error instanceof Error ? error.message : "Server Error",
      });
  }
  
};
