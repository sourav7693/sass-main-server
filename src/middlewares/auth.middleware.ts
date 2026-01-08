import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

interface JwtPayload {
  id: string;
  role: "admin" | "staff";
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "admin" | "staff";
    permissions: string[];
  };
}

export interface CustomerAuthRequest extends Request {
  user?: {
    id: string;
    role: "customer";    
  };
}


export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.status) {
      return res.status(403).json({ message: "Account disabled" });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      permissions: user.permissions,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authorizeRoles =
  (...allowedRoles: Array<"admin" | "staff">) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    // console.log("Authorizing roles:", allowedRoles, "for user:", req.user);

    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
export const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: "60d" });
};

export const customerAuth = (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: string;
    };
    // console.log(decoded);

    if (decoded.role !== "customer") {
      return res.status(403).json({ message: "Access denied" });
    }

    req.user = {
      id: decoded.id,
      role: "customer",
    };
    // console.log(req.user);

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
