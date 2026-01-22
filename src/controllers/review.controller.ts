import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Review } from "../models/Review";
import { isVerifiedBuyer } from "../utils/isVerifiedBuyer";
import { generateCustomId } from "../utils/generateCustomId";
import { Product } from "../models/Product";
import { deleteFile, uploadFile } from "../utils/cloudinaryService";

/* =========================
   CREATE REVIEW (Verified)
========================= */
export const createReview = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(req.files);
    const { productId, rating, description, title, customerId } = req.body;

    const verified = await isVerifiedBuyer(customerId, productId);
    if (!verified) {
      return res.status(403).json({
        message: "Only verified buyers can submit reviews",
      });
    }

    const alreadyReviewed = await Review.exists({
      product: productId,
      user: customerId,
    });

    if (alreadyReviewed) {
      return res.status(400).json({
        message: "You have already reviewed this product",
      });
    }

    let images: { public_id: string; url: string }[] = [];
    if (req.files && req.files.images) {
      if (Array.isArray(req.files.images)) {
        const uploadPromises = req.files.images.map(async (file: any) => {
          const result = await uploadFile(file.tempFilePath, file.mimetype);
          if (result instanceof Error) throw result;
          return { public_id: result.public_id, url: result.secure_url };
        });

        images = await Promise.all(uploadPromises);
      } else {
        const file = req.files.images;
        const result = await uploadFile(file.tempFilePath, file.mimetype);
        if (result instanceof Error) throw result;
        images = [{ public_id: result.public_id, url: result.secure_url }];
      }
    }
    const reviewId = await generateCustomId(Review, "reviewId", "REV");
    const review = new Review({
      reviewId,
      product: productId,
      user: customerId,
      rating,
      description,
      title,
      supporting_files: images,
      status: "approved",
    });

    await review.save({ session });

    /* ===== Update Product Rating ===== */
    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error("Product not found");

    const newCount = product.ratingCount + 1;
    const newAvg =
      (product.averageRating * product.ratingCount + rating) / newCount;

    product.ratingCount = newCount;
    product.averageRating = Number(newAvg.toFixed(2));
    product.ratingBreakdown[rating] += 1;

    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ review: review });
  } catch (err: any) {
    console.log(err);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   GET REVIEWS (Pagination)
========================= */
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = "latest" } = req.query;

    const sortMap: any = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      rating_high: { rating: -1 },
      rating_low: { rating: 1 },
    };

    const reviews = await Review.find({
      product: productId,
      status: "approved",
    })
      .sort(sortMap[sort as string] || sortMap.latest)
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .select("-__v");

    const total = await Review.countDocuments({
      product: productId,
      status: "approved",
    });

    res.json({
      reviews,
      pagination: {
        page: +page,
        limit: +limit,
        total,
        pages: Math.ceil(total / +limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   UPDATE REVIEW
========================= */
export const updateReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findOne({
      $or: [
        {
          _id: mongoose.Types.ObjectId.isValid(reviewId as string)
            ? reviewId
            : undefined,
        },
        { reviewId },
      ],
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.description = req.body.description ?? review.description;
    review.title = req.body.title ?? review.title;
    review.rating = req.body.rating ?? review.rating;

    // Parse images from req.body if it's a JSON string
    let existingImages = [];
    if (req.body.images) {
      try {
        // Check if it's a JSON string
        if (typeof req.body.images === "string") {
          existingImages = JSON.parse(req.body.images);
        } else {
          existingImages = req.body.images;
        }
      } catch (error) {
        console.error("Error parsing images:", error);
        existingImages = [];
      }
    }

    if (req.files && req.files.images) {
      let images = req.files.images;
      if (Array.isArray(images)) {
        const imageUrls = await Promise.all(
          images.map(async (file: any) => {
            const result = await uploadFile(file.tempFilePath, file.mimetype);
            if (result instanceof Error) throw result;
            return { public_id: result.public_id, url: result.secure_url };
          }),
        );

        if (existingImages.length > 0) {
          const filesToDelete = existingImages.filter((image: any) => {
            return !image.public_id;
          });

          // Delete files from cloud storage
          for (const file of filesToDelete) {
            if (file.public_id) {
              try {
                await deleteFile(file.public_id);
              } catch (error) {
                console.error("Error deleting file:", error);
              }
            }
          }

          review.supporting_files = [
            ...existingImages.filter((image: any) => {
              return image.public_id;
            }),
            ...imageUrls,
          ];
        } else {
          review.supporting_files = imageUrls;
        }
      } else {
        const result = await uploadFile(images.tempFilePath, images.mimetype);
        if (result instanceof Error) throw result;

        if (existingImages.length > 0) {
          const filesToDelete = existingImages.filter((image: any) => {
            return !image.public_id;
          });

          for (const file of filesToDelete) {
            if (file.public_id) {
              try {
                await deleteFile(file.public_id);
              } catch (error) {
                console.error("Error deleting file:", error);
              }
            }
          }

          review.supporting_files = [
            ...existingImages.filter((image: any) => {
              return image.public_id;
            }),
            { public_id: result.public_id, url: result.secure_url },
          ];
        } else {
          review.supporting_files = [
            ...review.supporting_files,
            { public_id: result.public_id, url: result.secure_url },
          ];
        }
      }
    } else {
      // Handle case when no new files are uploaded
      if (existingImages.length > 0) {
        const filesToDelete = existingImages.filter((image: any) => {
          return !image.public_id;
        });

        for (const file of filesToDelete) {
          if (file.public_id) {
            try {
              await deleteFile(file.public_id);
            } catch (error) {
              console.error("Error deleting file:", error);
            }
          }
        }

        review.supporting_files = existingImages.filter((image: any) => {
          return image.public_id;
        });
      } else {
        review.supporting_files =
          req.body.supporting_files ?? review.supporting_files;
      }
    }

    await review.save();

    res.json({ review });
  } catch (err: any) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   DELETE REVIEW (Rollback)
========================= */
export const deleteReview = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reviewId } = req.params;

    const review = await Review.findOne({
      _id: reviewId,
    }).session(session);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const product = await Product.findById(review.product).session(session);
    if (!product) throw new Error("Product not found");

    product.ratingCount -= 1;
    product.ratingBreakdown[review.rating] -= 1;

    if (product.ratingCount === 0) {
      product.averageRating = 0;
    } else {
      const totalRating =
        product.averageRating * (product.ratingCount + 1) - review.rating;
      product.averageRating = Number(
        (totalRating / product.ratingCount).toFixed(2),
      );
    }

    await product.save({ session });
    await review.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Review deleted successfully" });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

export async function getAllReviews(req: Request, res: Response) {
  try {
    const { user } = req.query;
    const reviews = await Review.find({ user })
      .sort({ createdAt: -1 })
      .populate("product")
      .lean();
    res.status(200).json({ reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getReviewsById(req: Request, res: Response) {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId).populate("product").lean();
    res.status(200).json({ review });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
}
