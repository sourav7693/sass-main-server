import { Router } from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} from "../controllers/review.controller.js";

const router = Router();

/* Public */
router.get("/product/:productId", getProductReviews);

/* Protected */
router.post("/", createReview);
router.put("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview);

export default router;
