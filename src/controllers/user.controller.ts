import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { generateToken } from "../middlewares/auth.middleware.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { generateCustomId } from "../utils/generateCustomId.js";

export const registerUser = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const userId = await generateCustomId(User, "userId", "USR");

    const user = await User.create({
      userId,
      username,
      email,
      password,
    });

    const token = generateToken(user._id.toString(), user.role);

    res
      .status(201)
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
      })
      .json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
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
         email: user.email,
         role: user.role,
       },
     });
};

export const logoutUser = (_: Request, res: Response) => {
  res
    .cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    })
    .json({ message: "Logged out" });
};


export const getUsers = async (_: Request, res: Response) => {
  const users = await User.find();
  res.json(users);
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
  const updated = await User.findOneAndUpdate({ userId: id }, req.body, {
    new: true,
  });

  res.json(updated);
};

export const deleteUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await User.findOne({ userId: id });
  if (!user) return res.status(404).json({ message: "User not found" });
  await User.findOneAndDelete({ userId: id });
  res.json({ message: "User deleted" });
};

export const me = async (req: AuthRequest, res: Response) => {
  res.json({ user: (req as any).user });
};
