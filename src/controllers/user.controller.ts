import type { Request, Response } from "express";
import { User, type UserDoc } from "../models/User.js";
import { generateToken } from "../middlewares/auth.middleware.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { generateCustomId } from "../utils/generateCustomId.js";
import bcrypt from "bcryptjs";
import { otpStore } from "./customer.controller.js";
import axios from "axios";

export const registerUser = async (req: AuthRequest, res: Response) => {
  const { username, mobile, email, password, role, permissions = [] } = req.body;

  // if (req.user?.role !== "admin") {
  //   return res.status(403).json({ message: "Only admin can create users" });
  // }

  const exists = await User.findOne({ $or: [{ email }, { mobile }] });
  if (exists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const userId = await generateCustomId(User, "userId", "USR");

  const user = await User.create({
    userId,
    username,
    mobile,
    email,
    password,
    role,
    permissions: role === "admin" ? [] : permissions,
    createdBy: req.user?.id,
  });

  res.status(201).json({
    userId: user.userId,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    permissions: user.permissions,
  });
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  
  const token = generateToken(user._id.toString(), user.role);

   res
     .cookie("token", token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === "production",
       sameSite: "strict",
       maxAge: 60 * 60 * 1000, // 1 hour
     })
     .json({
       user: {
         id: user._id,
         userId: user.userId,
         username: user.username,
         mobile: user.mobile,
         email: user.email,
         role: user.role,
         permissions: user.permissions,
       },
     });
};

export const sendOtpForUser = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile required" });
    }

    const formattedMobile = mobile.startsWith("91") ? mobile : "91" + mobile;

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["admin", "staff"].includes(user.role)) {
      return res.status(403).json({ message: "OTP login not allowed" });
    }

    if (!user.status) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[formattedMobile] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // WhatsApp payload (same as yours)
    const payload = {
      "auth-key": process.env.WA_AUTH_KEY,
      "app-key": process.env.WA_APP_KEY,
      destination_number: formattedMobile,
      template_id: process.env.WA_TEMPLATE_ID,
      device_id: process.env.WA_DEVICE_ID,
      language: "en",
      variables: [otp, "+917044076603"],
    };

    await axios.post("https://web.wabridge.com/api/createmessage", payload);

    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ message: "OTP send failed" });
  }
};

export const verifyOtpForUser = async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ message: "Mobile & OTP required" });
    }

    const formattedMobile = mobile.startsWith("91") ? mobile : "91" + mobile;

    const stored = otpStore[formattedMobile];

    if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    delete otpStore[formattedMobile];

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["admin", "staff"].includes(user.role)) {
      return res.status(403).json({ message: "OTP login not allowed" });
    }

    const token = generateToken(user._id.toString(), user.role);

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000,
      })
      .json({
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          permissions: user.permissions,
        },
      });
  } catch (err) {
    res.status(500).json({ message: "OTP verify failed" });
  }
};


export const logoutUser = (_: Request, res: Response) => {
  res
    .cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    })
    .json({ message: "Logged out" });
};


export const getUsers = async (req: Request, res: Response) => {
   const page = Number(req.query.page) || 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
  try {
    
      const total = await User.countDocuments();

      const users = await User.find()
        .populate("createdBy")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<UserDoc[]>();

      return res.json({
        success: true,
        page,
        total,
        pages: Math.ceil(total / limit),
        users,
      });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong",
      success: false,
      page: 0,
      total: 0,
      pages: 0,
    });
  }
};

export const getUserById = async (req: Request, res: Response) => {
    const { id } = req.params;
  const user = await User.findOne({ userId: id });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const user = await User.findOne({ userId: id });
    if (!user) return res.status(404).json({ message: "User not found" });
    if( req.body?.username) user.username = req.body.username;
    if( req.body?.email) user.email = req.body.email;
    if( req.body?.mobile) user.mobile = req.body.mobile;
    if( req.body?.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }
    if( req.body?.role) user.role = req.body.role;
    if( req.body?.status) user.status = req.body.status;
    console.log("statys", req.body.status);

    console.log(user);

    await user.save();
    res.json(user);
  
};

export const deleteUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await User.findOne({ userId: id });
  if (!user) return res.status(404).json({ message: "User not found" });
  await User.findOneAndDelete({ userId: id });
  res.json({ message: "User deleted" });
};

export const me = async (req: AuthRequest, res: Response) => {
  res.json(req.user);
};

