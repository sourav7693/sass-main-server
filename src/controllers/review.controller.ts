// import type { Request, Response } from "express";
// import mongoose from "mongoose";
// import { Review } from "../models/Review.ts";
// import { Product } from "../models/Product.ts";
// import { isVerifiedBuyer } from "../utils/isVerifiedBuyer.ts";
// import { generateCustomId } from "../utils/generateCustomId.ts";

// /* =========================
//    CREATE REVIEW (Verified)
// ========================= */
// export const createReview = async (req: Request, res: Response) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const customerId = req.user.id;
//     const { productId, rating, description, images, title } = req.body;

//     const verified = await isVerifiedBuyer(customerId, productId);
//     if (!verified) {
//       return res.status(403).json({
//         message: "Only verified buyers can submit reviews",
//       });
//     }

//     const alreadyReviewed = await Review.exists({
//       product: productId,
//       user: customerId,
//     });

//     if (alreadyReviewed) {
//       return res.status(400).json({
//         message: "You have already reviewed this product",
//       });
//     }
//     const reviewId = await generateCustomId(Review, "reviewId", "REV");
//     const review = await Review.create(
//       [
//         {
//           reviewId,
//           product: productId,
//           user: customerId,
//           personName: req.user.name,
//           rating,
//           description,
//           title,
//           images,
//           status: "approved",
//         },
//       ],
//       { session }
//     );

//     /* ===== Update Product Rating ===== */
//     const product = await Product.findById(productId).session(session);
//     if (!product) throw new Error("Product not found");

//     const newCount = product.ratingCount + 1;
//     const newAvg =
//       (product.averageRating * product.ratingCount + rating) / newCount;

//     product.ratingCount = newCount;
//     product.averageRating = Number(newAvg.toFixed(2));
//     product.ratingBreakdown[rating] += 1;

//     await product.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({ review: review[0] });
//   } catch (err: any) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(500).json({ error: err.message });
//   }
// };

// /* =========================
//    GET REVIEWS (Pagination)
// ========================= */
// export const getProductReviews = async (req: Request, res: Response) => {
//   try {
//     const { productId } = req.params;
//     const { page = 1, limit = 10, sort = "latest" } = req.query;

//     const sortMap: any = {
//       latest: { createdAt: -1 },
//       oldest: { createdAt: 1 },
//       rating_high: { rating: -1 },
//       rating_low: { rating: 1 },
//     };

//     const reviews = await Review.find({
//       product: productId,
//       status: "approved",
//     })
//       .sort(sortMap[sort as string] || sortMap.latest)
//       .skip((+page - 1) * +limit)
//       .limit(+limit)
//       .select("-__v");

//     const total = await Review.countDocuments({
//       product: productId,
//       status: "approved",
//     });

//     res.json({
//       reviews,
//       pagination: {
//         page: +page,
//         limit: +limit,
//         total,
//         pages: Math.ceil(total / +limit),
//       },
//     });
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// };

// /* =========================
//    UPDATE REVIEW
// ========================= */
// export const updateReview = async (req: Request, res: Response) => {
//   try {
//     const { reviewId } = req.params;
//     const userId = req.user.id;

//     const review = await Review.findOne({
//       _id: reviewId,
//       user: userId,
//     });

//     if (!review) {
//       return res.status(404).json({ message: "Review not found" });
//     }

//     review.description = req.body.description ?? review.description;
//     review.title = req.body.title ?? review.title;
//     review.images = req.body.images ?? review.images;

//     await review.save();

//     res.json({ review });
//   } catch (err: any) {
//     res.status(500).json({ error: err.message });
//   }
// };

// /* =========================
//    DELETE REVIEW (Rollback)
// ========================= */
// export const deleteReview = async (req: Request, res: Response) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { reviewId } = req.params;
//     const userId = req.user.id;

//     const review = await Review.findOne({
//       _id: reviewId,
//       user: userId,
//     }).session(session);

//     if (!review) {
//       return res.status(404).json({ message: "Review not found" });
//     }

//     const product = await Product.findById(review.product).session(session);
//     if (!product) throw new Error("Product not found");

//     product.ratingCount -= 1;
//     product.ratingBreakdown[review.rating] -= 1;

//     if (product.ratingCount === 0) {
//       product.averageRating = 0;
//     } else {
//       const totalRating =
//         product.averageRating * (product.ratingCount + 1) - review.rating;
//       product.averageRating = Number(
//         (totalRating / product.ratingCount).toFixed(2)
//       );
//     }

//     await product.save({ session });
//     await review.deleteOne({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.json({ message: "Review deleted successfully" });
//   } catch (err: any) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(500).json({ error: err.message });
//   }
// };
