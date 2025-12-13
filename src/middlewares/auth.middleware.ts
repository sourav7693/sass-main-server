import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { Customer } from "../models/Customer.js";

const JWT_SECRET = process.env.JWT_SECRET!;

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
      return res.status(401).json({ message: "Unauthorized" });

    const token = auth.split(" ")[1];

    let decoded;
    try {
      if (token) decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      return res.status(401).json({ message: "Token invalid" });
    }

    if (!decoded) return res.status(401).json({ message: "Token invalid" });

    const user = await Customer.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user; // attach user to request
    next();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Server Error" });
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });
  next();
};
