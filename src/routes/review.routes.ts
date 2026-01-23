import { Router } from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  getReviewsById,
} from "../controllers/review.controller.js";

const router = Router();

/* Public */
router.get("/product/:productId", getProductReviews);

/* Protected */
router.route("/").post(createReview).get(getAllReviews);
router
  .route("/:reviewId")
  .get(getReviewsById)
  .put(updateReview)
  .delete(deleteReview);

export default router;
