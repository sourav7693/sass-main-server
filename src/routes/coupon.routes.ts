import { Router } from "express";
import {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
} from "../controllers/coupon.controller";

const router = Router();

router.post("/", createCoupon);
router.get("/", getCoupons);
router.put("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);

export default router;
