import { Router } from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} from "../controllers/review.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = Router();

/* Public */
router.get("/product/:productId", getProductReviews);

/* Protected */
router.post("/", isAuthenticated, createReview);
router.put("/:reviewId", isAuthenticated, updateReview);
router.delete("/:reviewId", isAuthenticated, deleteReview);

export default router;
