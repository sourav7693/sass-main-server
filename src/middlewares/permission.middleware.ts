import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";

export const authorizePermission =
  (permission: string) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Admin can access everything
    if (req.user.role === "admin") {
      return next();
    }

    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
