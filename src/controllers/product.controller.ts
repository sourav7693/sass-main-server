import type { Request, Response, NextFunction } from "express";
import { type UploadedFile } from "express-fileupload";
import { Types } from "mongoose";

import { Product, type ProductDoc } from "../models/Product.js";
import {
  uploadFile,
  deleteFile,
  type UploadFileResult,
} from "../utils/cloudinaryService.js";
import { generateCustomId } from "../utils/generateCustomId.js";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const VIDEO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

function toUploadedArray(
  input: UploadedFile | UploadedFile[] | undefined
): UploadedFile[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parseStringArrayField(field: unknown): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter(Boolean).map(String);
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // fallback: comma separated
      return field
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function isValidObjectId(value: unknown): boolean {
  return typeof value === "string" && Types.ObjectId.isValid(value);
}

async function uploadAndReturn(
  file: UploadedFile | undefined
): Promise<{ public_id: string; url: string } | null> {
  if (!file) return null;
  const path = (file as unknown as { tempFilePath?: string }).tempFilePath;
  if (!path) return null;
  const result = await uploadFile(path, file.mimetype);
  if (result instanceof Error) throw result;
  return { public_id: result.public_id, url: result.secure_url };
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files;

    const {
      name,
      shortDescription,
      longDescription,
      brand,
      attributes,
      variables,
      pickup,
      mrp,
      price,
      discount,
      stock,
      parentProduct,
      categoryLevels,
    } = req.body;

    const productId = await generateCustomId(Product, "productId", "PROD");
    if (!productId || !name) {
      res.status(400).json({ message: "productId and name are required" });
      return;
    }

    // files
    const coverFiles = toUploadedArray(
      files?.coverImage as UploadedFile | UploadedFile[] | undefined
    );
    const imagesFiles = toUploadedArray(
      files?.images as UploadedFile | UploadedFile[] | undefined
    );
    const videoFiles = toUploadedArray(
      files?.video as UploadedFile | UploadedFile[] | undefined
    );

    // validate sizes
    if (coverFiles.length > 0 && (coverFiles[0]?.size ?? 0) > IMAGE_MAX_BYTES) {
      res.status(400).json({ message: "coverImage must be <= 2MB" });
      return;
    }
    const oversizedImage = imagesFiles.find((im) => im.size > IMAGE_MAX_BYTES);
    if (oversizedImage) {
      res.status(400).json({ message: "Each image must be <= 2MB" });
      return;
    }
    if (videoFiles.length > 0 && (videoFiles[0]?.size ?? 0) > VIDEO_MAX_BYTES) {
      res.status(400).json({ message: "Video must be <= 5MB" });
      return;
    }

    // parse arrays
    const parsedCategoryLevels = parseStringArrayField(categoryLevels).map(
      (s) => new Types.ObjectId(s)
    );
    if (parsedCategoryLevels.length === 0) {
      res
        .status(400)
        .json({
          message:
            "categoryLevels is required and must contain at least one id",
        });
      return;
    }
    const parsedAttributes = parseStringArrayField(attributes).map(
      (s) => new Types.ObjectId(s)
    );
    const parsedVariables = JSON.parse(variables) || [];
    const parsedPickup =
      pickup && isValidObjectId(pickup)
        ? new Types.ObjectId(String(pickup))
        : null;

    // variant logic
    let parentProductId: Types.ObjectId | null = null;
    const isVariant = !!parentProduct;
    if (isVariant) {
      if (!isValidObjectId(parentProduct)) {
        res.status(400).json({ message: "Invalid parentProduct id" });
        return;
      }
      parentProductId = new Types.ObjectId(String(parentProduct));
    }

    let coverImageRes: { public_id: string; url: string } | undefined;
    const imagesRes: { public_id: string; url: string }[] = [];
    let videoRes: { public_id: string; url: string } | undefined;

    try {
      if (coverFiles.length > 0) {
        const r = await uploadAndReturn(coverFiles[0]);
        if (r) coverImageRes = r;
      }
      for (const img of imagesFiles) {
        const r = await uploadAndReturn(img);
        if (r) imagesRes.push(r);
      }
      if (videoFiles.length > 0) {
        const r = await uploadAndReturn(videoFiles[0]);
        if (r) videoRes = r;
      }
    } catch (uploadErr) {
      // on failure try deleting any uploaded resources
      try {
        if (coverImageRes) await deleteFile(coverImageRes.public_id);
        for (const im of imagesRes) await deleteFile(im.public_id);
        if (videoRes) await deleteFile(videoRes.public_id);
      } catch {
        // ignore cleanup errors
      }
      next(uploadErr);
      return;
    }

    // prepare create payload
    const payload: Partial<ProductDoc> = {
      productId: String(productId),
      name: String(name),
      shortDescription: shortDescription ? String(shortDescription) : "",
      longDescription: longDescription ? String(longDescription) : "",
      ...(coverImageRes && {
        coverImage: {
          public_id: coverImageRes.public_id,
          url: coverImageRes.url,
        },
      }),
      ...(imagesRes.length && {
        images: imagesRes.map((i) => ({ public_id: i.public_id, url: i.url })),
      }),
      ...(videoRes && {
        video: { public_id: videoRes.public_id, url: videoRes.url },
      }),
      categoryLevels: parsedCategoryLevels,
      attributes: parsedAttributes,
      ...(parsedVariables.length && { variables: parsedVariables }),
      ...(parsedPickup && { pickup: parsedPickup }),
      ...(mrp && { mrp: Number(mrp) }),
      ...(price && { price: Number(price) }),
      ...(discount && { discount: Number(discount) }),
      ...(stock && { stock: Number(stock) }),
      status: true,
    };

    // If variant: inherit categoryLevels and brand from parent and lock them
    if (isVariant && parentProductId) {
      const parent = await Product.findById(parentProductId).lean();
      if (!parent) {
        if (coverImageRes) await deleteFile(coverImageRes.public_id);
        for (const im of imagesRes) await deleteFile(im.public_id);
        if (videoRes) await deleteFile(videoRes.public_id);
        res.status(404).json({ message: "Parent product not found" });
        return;
      }
      payload.parentProduct = parentProductId;
      payload.isVariant = true;
      payload.categoryLevels = parent.categoryLevels;
      payload.brand = parent.brand;
    } else if (!isVariant && brand && isValidObjectId(brand)) {
      payload.brand = new Types.ObjectId(String(brand));
    }
    // console.log("Creating product with payload:", payload);
    const created = await Product.create(payload as ProductDoc);

    // If variant, push to parent variants
    if (isVariant && parentProductId) {
      await Product.findByIdAndUpdate(parentProductId, {
        $push: { variants: created._id },
      });
    }

    res.status(201).json(created);
    res.json({ message: "Product created successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * CREATE VARIANT (convenience) - receives parentId as param
 * forwards to createProduct behavior but ensures parentProduct is set
 */
export async function createVariant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parentId = req.params.parentId;

    if (!isValidObjectId(parentId)) {
      res.status(400).json({ message: "Invalid parentId" });
      return;
    }

    const parent = await Product.findById(parentId);

    if (!parent) {
      res.status(404).json({ message: "Parent product not found" });
      return;
    }

    if (parent.isVariant) {
      res.status(400).json({ message: "Cannot create a variant of a variant" });
      return;
    }

    // inherit locked fields from parent
    req.body.parentProduct = parentId;
    req.body.categoryLevels = parent.categoryLevels;
    req.body.brand = parent.brand;
    req.body.attributes = parent.attributes;

    // lock these fields so variant cannot change them
    req.body.isVariant = true;

    await createProduct(req, res, next);
  } catch (err) {
    next(err);
  }
}


/**
 * GET single product (populate relations and variants)
 */

export async function getProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const product = await Product.findById(id)
      .populate("brand")
      .populate("attributes")
      .populate("variables")
      .populate("pickup")
      .populate("categoryLevels")
      .populate("categoryLevels.children")
      .populate({
        path: "variants",
        populate: [
          { path: "brand" },
          { path: "attributes" },
          { path: "variables" },
        ],
      })
      .populate("parentProduct");

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * LIST products (pagination + simple filters)
 */
export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.brand && isValidObjectId(String(req.query.brand))) {
      filter.brand = new Types.ObjectId(String(req.query.brand));
    }
    if (req.query.categoryId && isValidObjectId(String(req.query.categoryId))) {
      filter.categoryLevels = new Types.ObjectId(String(req.query.categoryId));
    }
    if (req.query.search) {
      filter.name = { $regex: String(req.query.search), $options: "i" };
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("brand")
        .populate("categoryLevels")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    res.json({ total, page, limit, data: products });
  } catch (err) {
    next(err);
  }
}

/**
 * UPDATE product
 * - if variant: cannot change categoryLevels or brand (they are inherited)
 * - coverImage/video replacement deletes old cloudinary file
 * - images[] uploads are appended to existing images
 */
export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const files = req.files;
    const coverFiles = toUploadedArray(
      files?.coverImage as UploadedFile | UploadedFile[] | undefined
    );
    const imagesFiles = toUploadedArray(
      files?.images as UploadedFile | UploadedFile[] | undefined
    );
    const videoFiles = toUploadedArray(
      files?.video as UploadedFile | UploadedFile[] | undefined
    );

    // verify sizes
    if (coverFiles.length > 0 && (coverFiles[0]?.size ?? 0) > IMAGE_MAX_BYTES) {
      res.status(400).json({ message: "coverImage must be <= 2MB" });
      return;
    }
    const overs = imagesFiles.find((i) => i.size > IMAGE_MAX_BYTES);
    if (overs) {
      res.status(400).json({ message: "Each image must be <= 2MB" });
      return;
    }
    if (videoFiles.length > 0 && (videoFiles[0]?.size ?? 0) > VIDEO_MAX_BYTES) {
      res.status(400).json({ message: "Video must be <= 5MB" });
      return;
    }

    // parse body for updates
    const {
      name,
      shortDescription,
      longDescription,
      brand,
      attributes,
      variables,
      pickup,
      mrp,
      price,
      discount,
      stock,
      categoryLevels,
    } = req.body;

    // prevent changing brand/categoryLevels for variants
    if (product.isVariant && (brand || categoryLevels)) {
      res
        .status(400)
        .json({
          message:
            "Cannot change categoryLevels or brand of a variant (inherits from parent)",
        });
      return;
    }

    // handle cover replacement
    if (coverFiles.length > 0) {
      // delete old if exists
      if (product.coverImage?.public_id) {
        await deleteFile(product.coverImage.public_id);
      }
      const r = await uploadAndReturn(coverFiles[0]);
      if (r) product.coverImage = { public_id: r.public_id, url: r.url };
    }

    // handle video replacement
    if (videoFiles.length > 0) {
      if (product.video?.public_id) {
        await deleteFile(product.video.public_id);
      }
      const r = await uploadAndReturn(videoFiles[0]);
      if (r) product.video = { public_id: r.public_id, url: r.url };
    }

    // append images
    if (imagesFiles.length > 0) {
      const current = product.images ?? [];
      for (const img of imagesFiles) {
        const r = await uploadAndReturn(img);
        if (r) current.push({ public_id: r.public_id, url: r.url });
      }
      product.images = current;
    }

    // update scalar fields
    if (name) product.name = String(name);
    if (shortDescription) product.shortDescription = String(shortDescription);
    if (longDescription) product.longDescription = String(longDescription);
    if (attributes)
      product.attributes = parseStringArrayField(attributes).map(
        (s) => new Types.ObjectId(s)
      );
    if (variables)
      product.variables = variables;
    if (pickup && isValidObjectId(pickup))
      product.pickup = new Types.ObjectId(String(pickup));
    if (mrp) product.mrp = Number(mrp);
    if (price) product.price = Number(price);
    if (discount) product.discount = Number(discount);
    if (stock) product.stock = Number(stock);

    if (!product.isVariant && categoryLevels) {
      const parsed = parseStringArrayField(categoryLevels).map(
        (s) => new Types.ObjectId(s)
      );
      if (parsed.length > 0) product.categoryLevels = parsed;
    }
    if (!product.isVariant && brand && isValidObjectId(brand)) {
      product.brand = new Types.ObjectId(String(brand));
    }

    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE product
 * - prevents deleting parent if variants exist
 * - deletes cloudinary files for product and (optionally) variants when allowed (here we prevent parent delete)
 */
export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // if parent has variants, prevent deletion (per your preference)
    if (product.variants && product.variants.length > 0) {
      res
        .status(400)
        .json({
          message:
            "Cannot delete parent product while variants exist. Remove variants first.",
        });
      return;
    }

    // delete media
    if (product.coverImage?.public_id)
      await deleteFile(product.coverImage.public_id);
    if (product.video?.public_id) await deleteFile(product.video.public_id);
    if (product.images && product.images.length > 0) {
      await Promise.all(
        product.images.map((img) =>
          img.public_id ? deleteFile(img.public_id) : Promise.resolve()
        )
      );
    }

    // if variant: remove from parent variants array
    if (product.parentProduct) {
      await Product.findByIdAndUpdate(product.parentProduct, {
        $pull: { variants: product._id },
      });
    }

    await product.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
}

export async function getVariantById(
  req: Request,
  res: Response
): Promise<void> {
  const { variantId } = req.params;

  if (!isValidObjectId(variantId)) {
    res.status(400).json({ message: "Invalid variantId" });
    return;
  }

  const variant = await Product.findById(variantId)
  .populate("categoryLevels")
    .populate("categoryLevels.children")
    .populate("brand")
    .populate("attributes")
    .populate("parentProduct")
    .lean();

  if (!variant) {
    res.status(404).json({ message: "Variant not found" });
    return;
  }

  res.status(200).json(variant);
}

export async function updateVariant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { variantId } = req.params;

    if (!isValidObjectId(variantId)) {
      res.status(400).json({ message: "Invalid variantId" });
      return;
    }

    const variant = await Product.findById(variantId);

    if (!variant) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }

    if (!variant.isVariant) {
      res.status(400).json({ message: "This product is not a variant" });
      return;
    }

    // Prevent updating inherited locked fields:
    delete req.body.categoryLevels;
    delete req.body.brand;
    delete req.body.attributes;
    delete req.body.parentProduct;

    // Update text fields
    Object.assign(variant, req.body);

    // Process file uploads if any
    const files = req.files as { [key: string]: UploadedFile | UploadedFile[] } | undefined;

    // --- Cover Image ---
    if (files?.coverImage) {
      if (variant.coverImage?.public_id) {
        await deleteFile(variant.coverImage.public_id);
      }
      const uploaded = await uploadFile(
        (files.coverImage as UploadedFile).tempFilePath,
        (files.coverImage as UploadedFile).mimetype
      );
      if (uploaded instanceof Error) {
        res.status(500).json({ message: uploaded.message });
        return;
      }
      variant.coverImage = {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      };
    }

    // --- Additional Images ---
    if (files?.images) {
      const imgArray = Array.isArray(files.images)
        ? files.images
        : [files.images];

      for (const img of imgArray) {
        const uploaded = await uploadFile(img.tempFilePath, img.mimetype);
        if (uploaded instanceof Error) {
          res.status(500).json({ message: uploaded.message });
          return;
        }
        variant.images?.push({
          public_id: uploaded.public_id,
          url: uploaded.secure_url,
        });       
      }
    }

    // --- Video Upload ---
    if (files?.video) {
      const videoArray = Array.isArray(files.video)
        ? files.video
        : [files.video];

      for (const video of videoArray) {
        if (video.size > 5 * 1024 * 1024) {
          res.status(400).json({ message: "Video must be <= 5MB" });
          return;
        }
        const uploaded = await uploadFile(video.tempFilePath, video.mimetype);
        if (uploaded instanceof Error) {
          res.status(500).json({ message: uploaded.message });
          return;
        }
        variant.video = {
          public_id: uploaded.public_id,
          url: uploaded.secure_url,
        };
      }
    }

    await variant.save();

    res.status(200).json({ message: "Variant updated", variant });
  } catch (err) {
    next(err);
  }
}


export async function deleteVariant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { variantId } = req.params;

    if (!isValidObjectId(variantId)) {
      res.status(400).json({ message: "Invalid variantId" });
      return;
    }

    const variant = await Product.findById(variantId);

    if (!variant) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }

    if (!variant.isVariant) {
      res.status(400).json({ message: "This product is not a variant" });
      return;
    }

    // Remove from parent list
    await Product.findByIdAndUpdate(variant.parentProduct, {
      $pull: { variables: variant._id },
    });

    // Delete images
    if (variant.coverImage?.public_id) {
      await deleteFile(variant.coverImage.public_id);
    }

    if (variant.images?.length) {
      for (const img of variant.images) {
        if (img.public_id) await deleteFile(img.public_id);
      }
    }

    // Delete video
    if (variant.video?.public_id) {
      await deleteFile(variant.video.public_id);
    }

    await variant.deleteOne();

    res.status(200).json({ message: "Variant deleted successfully" });
  } catch (err) {
    next(err);
  }
}
