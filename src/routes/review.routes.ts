import { Router } from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getAllReviews,
} from "../controllers/review.controller.js";

const router = Router();

/* Public */
router.get("/product/:productId", getProductReviews);

/* Protected */
router.route("/").post(createReview).get(getAllReviews);
router.put("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview);

export default router;
