import type { Request, Response, NextFunction } from "express";
import { type UploadedFile } from "express-fileupload";
import mongoose, { Types } from "mongoose";

import {
  Product,
  type ProductDoc,
  type TypeOfPackage,
  type TypeOfReturn,
} from "../models/Product";
import {
  uploadFile,
  deleteFile,
  type UploadFileResult,
} from "../utils/cloudinaryService";
import { generateCustomId } from "../utils/generateCustomId";
import { Category } from "../models/Category";
import { findLevelById } from "../utils/FindLevelById";
import { generateProductSlug } from "../utils/generateSlug";
import { Brand } from "../models/Brand";
import { Attribute } from "../models/Attribute";
import { Order } from "../models/Order";
import { Review } from "../models/Review";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const VIDEO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function collectCategoryIdsByName(
  categories: any[],
  categoryName: string,
): Types.ObjectId[] {
  const ids: Types.ObjectId[] = [];

  function traverse(category: any) {
    if (category.name.toLowerCase() === categoryName.toLowerCase()) {
      ids.push(category._id);

      function collectChildren(children: any[]) {
        for (const child of children || []) {
          ids.push(child._id);
          collectChildren(child.children || []);
        }
      }

      collectChildren(category.children || []);
    } else {
      for (const child of category.children || []) {
        traverse(child);
      }
    }
  }

  for (const cat of categories) {
    traverse(cat);
  }

  return ids;
}

export async function getBrandIdByName(name: string) {
  const brand = await Brand.findOne({
    name: { $regex: `^${name}$`, $options: "i" },
  }).select("_id");

  return brand?._id || null;
}

export async function getAttributeIdsByNames(
  names: string[],
): Promise<Types.ObjectId[]> {
  if (!names.length) return [];

  const attributes = await Attribute.find({
    name: {
      $in: names.map((n) => new RegExp(`^${n}$`, "i")),
    },
  }).select("_id");

  return attributes.map((a) => a._id);
}

function toUploadedArray(
  input: UploadedFile | UploadedFile[] | undefined,
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
  file: UploadedFile | undefined,
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
  next: NextFunction,
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

      weight,
      dimensions,
      typeOfPackage,
      returnPolicy,
    } = req.body;

    let parsedSpecifications: any[] = [];

    const productId = await generateCustomId(Product, "productId", "PROD");
    if (!productId || !name) {
      res.status(400).json({ message: "productId and name are required" });
      return;
    }

    // files
    const coverFiles = toUploadedArray(
      files?.coverImage as UploadedFile | UploadedFile[] | undefined,
    );
    const imagesFiles = toUploadedArray(
      files?.images as UploadedFile | UploadedFile[] | undefined,
    );
    const videoFiles = toUploadedArray(
      files?.video as UploadedFile | UploadedFile[] | undefined,
    );

    let parsedDimensions: any[] = [];

    if (dimensions) {
      try {
        parsedDimensions =
          typeof dimensions === "string" ? JSON.parse(dimensions) : dimensions;
      } catch {
        res.status(400).json({ message: "Invalid dimensions format" });
        return;
      }
    }

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
      (s) => new Types.ObjectId(s),
    );
    if (parsedCategoryLevels.length === 0) {
      res.status(400).json({
        message: "categoryLevels is required and must contain at least one id",
      });
      return;
    }
    const parsedAttributes = parseStringArrayField(attributes).map(
      (s) => new Types.ObjectId(s),
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

    if (req.body.specifications) {
      try {
        parsedSpecifications =
          typeof req.body.specifications === "string"
            ? JSON.parse(req.body.specifications)
            : req.body.specifications;
      } catch {
        res.status(400).json({ message: "Invalid specifications format" });
        return;
      }
    }

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

    const generatedSlug = await generateProductSlug(name, parsedVariables);

    // prepare create payload
    const payload: Partial<ProductDoc> = {
      productId: String(productId),
      slug: generatedSlug,
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
      ...(parsedSpecifications.length && {
        specifications: parsedSpecifications,
      }),

      ...(weight && { weight: Number(weight) }),
      ...(parsedDimensions.length && { dimensions: parsedDimensions }),
      ...(typeOfPackage && { typeOfPackage: String(typeOfPackage) }),
      ...(returnPolicy && { returnPolicy: String(returnPolicy) }),
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

    res.status(201).json({ message: "Product created successfully", created });
  } catch (err) {
    next(err);
  }
}

export async function createVariant(
  req: Request,
  res: Response,
  next: NextFunction,
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

export async function getProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      $or: [
        { productId }, // PROD0005
        { slug: productId }, // abjdjo-odjlkd-1
        {
          _id: mongoose.Types.ObjectId.isValid(productId as string)
            ? productId
            : undefined,
        },
      ],
    })
      .populate("brand")
      .populate("attributes")
      .populate("pickup")
      .populate({
        path: "variants",
        populate: [
          { path: "brand" },
          { path: "attributes" },
          { path: "pickup" },
        ],
      })
      .populate("parentProduct")
      .lean();

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const reviews = await Review.find({ product: product._id })
      .populate("user")
      .lean();

    product.reviews = reviews;

    const categories = await Category.find().lean();

    const resolvedCategories: any[] = [];

    for (const levelId of product.categoryLevels as any[]) {
      const idStr = levelId.toString();

      // 1️⃣ MAIN CATEGORY
      const main = categories.find((c) => c._id.toString() === idStr);

      if (main) {
        resolvedCategories.push({
          _id: main._id,
          name: main.name,
          type: "Main",
        });
        continue;
      }

      // 2️⃣ SUB / CHILD CATEGORY
      for (const cat of categories) {
        const found = findLevelById(cat.children, idStr);
        if (found) {
          resolvedCategories.push({
            _id: found._id,
            name: found.name,
            type: found.type,
          });
          break;
        }
      }
    }
    res.json({
      ...product,
      categoryLevels: resolvedCategories,
    });
  } catch (err) {
    next(err);
  }
}

export const getProductsByCategory = async (req: Request, res: Response) => {
  const { categoryId } = req.query;

  const products = await Product.find({
    status: true,
    categoryLevels: categoryId, // MongoDB auto does $in
  });

  res.json(products);
};
/**
 * LIST products (pagination + simple filters)
 */
export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const status = req.query.status;

    const skip = (page - 1) * limit;
    const categoryName = String(req.query.category || "");
    const brandName = String(req.query.brand || "");
    const attributeQuery = String(req.query.attribute || "");

    const q = String(req.query.q || "").trim();
    const categories = await Category.find().lean();

    const keywords = q
      .split(" ")
      .map((k) => k.trim())
      .filter(Boolean);

    const filter: Record<string, unknown> = {};
    if (status !== undefined) {
      if (status === "Active") {
        filter.status = true;
      } else if (status === "Inactive") {
        filter.status = false;
      }
    }
    const andConditions: any[] = [];

    /* ================= SEARCH ================= */
    if (keywords.length > 0) {
      const orConditions: any[] = [];

      // text fields
      keywords.forEach((word) => {
        orConditions.push(
          { name: { $regex: word, $options: "i" } },
          { shortDescription: { $regex: word, $options: "i" } },
          { longDescription: { $regex: word, $options: "i" } },
        );
      });

      // category (main + sub + child)
      let searchCategoryIds = collectCategoryIdsByName(categories, q);

      // 2️⃣ If not found, fallback to keyword-based
      if (searchCategoryIds.length === 0) {
        for (const word of keywords) {
          searchCategoryIds.push(...collectCategoryIdsByName(categories, word));
        }
      }

      if (searchCategoryIds.length > 0) {
        orConditions.push({
          categoryLevels: { $in: searchCategoryIds },
        });
      }

      // brand
      const brands = await Brand.find({
        name: { $regex: keywords.join("|"), $options: "i" },
      }).select("_id");

      if (brands.length > 0) {
        orConditions.push({
          brand: { $in: brands.map((b) => b._id) },
        });
      }

      // attributes
      const attrs = await Attribute.find({
        name: { $regex: keywords.join("|"), $options: "i" },
      }).select("_id");

      if (attrs.length > 0) {
        orConditions.push({
          attributes: { $in: attrs.map((a) => a._id) },
        });
      }

      // variables (color, size)
      keywords.forEach((word) => {
        orConditions.push({
          variables: {
            $elemMatch: {
              values: { $regex: word, $options: "i" },
            },
          },
        });
      });

      andConditions.push({ $or: orConditions });
    }

    if (categoryName) {
      const categoryIds = collectCategoryIdsByName(categories, categoryName);

      if (categoryIds.length === 0) {
        // force empty result
        filter._id = { $exists: false };
      } else {
        filter.categoryLevels = { $in: categoryIds };
      }
    }

    // 🏷 BRAND (name-wise)
    if (brandName) {
      const brandId = await getBrandIdByName(brandName);
      if (brandId) {
        filter.brand = brandId;
      }
    }
    // 🧩 ATTRIBUTE FILTER (name-wise)
    if (attributeQuery) {
      const attributeNames = attributeQuery
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const attributeIds = await getAttributeIdsByNames(attributeNames);

      if (attributeIds.length > 0) {
        filter.attributes = { $all: attributeIds };
      } else {
        filter._id = { $exists: false };
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("attributes")
        .populate("pickup")
        .populate("parentProduct")
        .populate("variants")
        .populate("brand")
        .populate({
          path: "variants",
          populate: [
            { path: "brand" },
            { path: "attributes" },
            { path: "pickup" },
          ],
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // 🔐 FIND PRODUCTS THAT HAVE ORDERS
    const productIds = products.map((p) => p._id);

    const orderedProductIds = await Order.distinct("product", {
      product: { $in: productIds },
    });

    // Convert to fast lookup set
    const orderedSet = new Set(orderedProductIds.map(String));

    const data = products.map((product) => {
      const resolvedCategories: any[] = [];

      for (const catId of product.categoryLevels || []) {
        const idStr = catId.toString();

        // MAIN CATEGORY
        const main = categories.find((c) => c._id.toString() === idStr);

        if (main) {
          resolvedCategories.push({
            _id: main._id,
            name: main.name,
            type: "Main",
            image: main.image || null,
          });
          continue;
        }

        // SUB / CHILD CATEGORY
        for (const cat of categories) {
          const found = findLevelById(cat.children, idStr);
          if (found) {
            resolvedCategories.push({
              _id: found._id,
              name: found.name,
              type: found.type,
              image: found.image || null,
            });
            break;
          }
        }
      }

      return {
        ...product,
        categoryLevels: resolvedCategories,
        hasOrders: orderedSet.has(String(product._id)),
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        totalCount: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Something went wrong",
      success: false,
      pagination: {
        totalCount: 0,
        currentPage: 0,
        limit: 0,
        totalPages: 0,
      },
    });
    next(err);
  }
}

export const getRelatedProducts = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    /* 1️⃣ FIND CURRENT PRODUCT */
    const currentProduct = await Product.findOne({
      $or: [
        { slug },
        { productId: slug },
        {
          _id: mongoose.Types.ObjectId.isValid(slug as string)
            ? slug
            : undefined,
        },
      ].filter(Boolean),
    }).lean();

    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      _id,
      categoryLevels = [],
      brand,
      attributes = [],
      variables = [],
    } = currentProduct;

    /* 2️⃣ BUILD MATCH CONDITIONS */
    const matchConditions: any[] = [];

    if (categoryLevels.length) {
      matchConditions.push({
        categoryLevels: { $in: categoryLevels },
      });
    }

    if (brand) {
      matchConditions.push({ brand });
    }

    if (attributes.length) {
      matchConditions.push({
        attributes: { $in: attributes },
      });
    }

    if (variables.length) {
      matchConditions.push({
        variables: {
          $elemMatch: {
            values: {
              $in: variables.flatMap((v: any) => v.values),
            },
          },
        },
      });
    }

    /* 3️⃣ FIND RELATED PRODUCTS */
    let relatedProducts = await Product.find({
      _id: { $ne: _id },
      status: true,
      $or: matchConditions,
    })
      .limit(20)
      .populate("brand")
      .populate("attributes")
      .populate("pickup")
      .populate("variants")
      .lean();

    const categories = await Category.find().lean();

    /* 4️⃣ FILL WITH RANDOM PRODUCTS IF LESS THAN 20 */
    if (relatedProducts.length < 20) {
      const remaining = 20 - relatedProducts.length;

      const excludeIds = [_id, ...relatedProducts.map((p) => p._id)];

      const randomProducts = await Product.aggregate([
        {
          $match: {
            status: true,
            _id: { $nin: excludeIds },
          },
        },
        { $sample: { size: remaining } },
      ]);

      relatedProducts = [...relatedProducts, ...randomProducts];
    }

    const resolvedData = relatedProducts.map((product: any) => {
      const resolvedCategories: any[] = [];

      for (const levelId of product.categoryLevels || []) {
        const idStr = levelId.toString();

        // MAIN CATEGORY
        const main = categories.find((c) => c._id.toString() === idStr);

        if (main) {
          resolvedCategories.push({
            _id: main._id,
            name: main.name,
            type: "Main",
            image: main.image || null,
          });
          continue;
        }

        // SUB / CHILD CATEGORY
        for (const cat of categories) {
          const found = findLevelById(cat.children, idStr);
          if (found) {
            resolvedCategories.push({
              _id: found._id,
              name: found.name,
              type: found.type,
              image: found.image || null,
            });
            break;
          }
        }
      }
      return {
        ...product,
        categoryLevels: resolvedCategories,
      };
    });

    res.json({
      success: true,
      count: relatedProducts.length,
      data: resolvedData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch related products",
    });
  }
};

function parseJSONArray<T = any>(value: any): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const files = req.files;
    const coverFiles = toUploadedArray(
      files?.coverImage as UploadedFile | UploadedFile[] | undefined,
    );
    const imagesFiles = toUploadedArray(
      files?.images as UploadedFile | UploadedFile[] | undefined,
    );
    const videoFiles = toUploadedArray(
      files?.video as UploadedFile | UploadedFile[] | undefined,
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
      specifications,
      pickup,
      mrp,
      price,
      discount,
      stock,
      categoryLevels,
      status,
      weight,
      dimensions,
      typeOfPackage,
      returnPolicy,
    } = req.body;

    // prevent changing brand/categoryLevels for variants
    if (product.isVariant && (brand || categoryLevels)) {
      res.status(400).json({
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

    let parsedDimensions: any[] | undefined;

    if (dimensions) {
      try {
        parsedDimensions =
          typeof dimensions === "string" ? JSON.parse(dimensions) : dimensions;
      } catch {
        res.status(400).json({ message: "Invalid dimensions format" });
        return;
      }
    }

    // update scalar fields
    if (name) product.name = String(name);
    if (status !== undefined) {
      const hasOrders = await productHasOrders(product._id);

      if (hasOrders) {
        res.status(400).json({
          message: "This product has orders and its status cannot be changed",
          hasOrders: true,
        });
        return;
      } else product.status = Boolean(status);
    }

    if (shortDescription) product.shortDescription = String(shortDescription);
    if (longDescription) product.longDescription = String(longDescription);
    if (attributes)
      product.attributes = parseStringArrayField(attributes).map(
        (s) => new Types.ObjectId(s),
      );
    if (variables) {
      product.variables =
        typeof variables === "string" ? JSON.parse(variables) : variables;
    }
    if (specifications) {
      try {
        product.specifications = parseJSONArray(specifications);
        product.markModified("specifications");
      } catch {
        res.status(400).json({ message: "Invalid specifications format" });
        return;
      }
    }
    if (pickup && isValidObjectId(pickup))
      product.pickup = new Types.ObjectId(String(pickup));
    if (mrp) product.mrp = Number(mrp);
    if (price) product.price = Number(price);
    if (discount) product.discount = Number(discount);
    if (stock) product.stock = Number(stock);

    if (!product.isVariant && categoryLevels) {
      const parsed = parseStringArrayField(categoryLevels).map(
        (s) => new Types.ObjectId(s),
      );
      if (parsed.length > 0) product.categoryLevels = parsed;
    }
    if (!product.isVariant && brand && isValidObjectId(brand)) {
      product.brand = new Types.ObjectId(String(brand));
    }

    if (weight) product.weight = Number(weight);
    if (parsedDimensions) {
      product.dimensions = parsedDimensions;
      product.markModified("dimensions");
    }
    if (typeOfPackage) {
      product.typeOfPackage = typeOfPackage as TypeOfPackage;
    }

    if (returnPolicy) {
      product.returnPolicy = returnPolicy as TypeOfReturn;
    }

    const updatedName = name ? String(name) : product.name;
    const updatedVariables = variables
      ? typeof variables === "string"
        ? JSON.parse(variables)
        : variables
      : product.variables;

    product.slug = await generateProductSlug(updatedName, updatedVariables);

    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateVariant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { productId } = req.params;

    const variant = await Product.findOne({ productId });
    if (!variant) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }

    if (!variant.isVariant) {
      res.status(400).json({ message: "This product is not a variant" });
      return;
    }

    delete req.body.categoryLevels;
    delete req.body.brand;
    delete req.body.attributes;
    delete req.body.parentProduct;
    delete req.body.returnPolicy;

    try {
      req.body.variables = parseJSON(req.body.variables);
      req.body.specifications = parseJSONArray(req.body.specifications);
      if (req.body.dimensions) {
        req.body.dimensions =
          typeof req.body.dimensions === "string"
            ? JSON.parse(req.body.dimensions)
            : req.body.dimensions;
      }
    } catch {
      res.status(400).json({ message: "Invalid variables format" });
      return;
    }

    const updatedName = req.body.name ? String(req.body.name) : variant.name;

    const updatedVariables = req.body.variables
      ? req.body.variables
      : variant.variables;

    variant.slug = await generateProductSlug(updatedName, updatedVariables);

    if (req.body.name) variant.name = req.body.name;
    if (req.body.status !== undefined)
      variant.status = Boolean(req.body.status);
    if (req.body.shortDescription)
      variant.shortDescription = req.body.shortDescription;
    if (req.body.longDescription)
      variant.longDescription = req.body.longDescription;
    if (req.body.mrp) variant.mrp = Number(req.body.mrp);
    if (req.body.price) variant.price = Number(req.body.price);
    if (req.body.discount) variant.discount = Number(req.body.discount);
    if (req.body.stock) variant.stock = Number(req.body.stock);
    if (req.body.variables) {
      variant.variables = req.body.variables;
      variant.markModified("variables");
    }

    if (req.body.pickup !== undefined) {
      if (req.body.pickup && isValidObjectId(req.body.pickup)) {
        variant.pickup = new mongoose.Types.ObjectId(String(req.body.pickup));
      } else if (req.body.pickup === "" || req.body.pickup === null) {
        variant.pickup = null;
      }
    }

    if (req.body.specifications) {
      variant.specifications = req.body.specifications;
      variant.markModified("specifications");
    }

    if (req.body.weight) variant.weight = Number(req.body.weight);
    if (req.body.returnPolicy) {
      variant.returnPolicy = req.body.returnPolicy as TypeOfReturn;
    }

    if (req.body.dimensions) {
      variant.dimensions = req.body.dimensions as any[];
      variant.markModified("dimensions");
    }

    const files = req.files as
      | { [key: string]: UploadedFile | UploadedFile[] }
      | undefined;

    if (files?.coverImage) {
      const file = files.coverImage as UploadedFile;

      if (variant.coverImage?.public_id) {
        await deleteFile(variant.coverImage.public_id);
      }

      const uploaded = await uploadFile(file.tempFilePath, file.mimetype);
      if (uploaded instanceof Error) {
        res.status(500).json({ message: uploaded.message });
        return;
      }

      variant.coverImage = {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      };
    }

    if (files?.images) {
      const images = Array.isArray(files.images)
        ? files.images
        : [files.images];

      for (const img of images) {
        const uploaded = await uploadFile(img.tempFilePath, img.mimetype);
        if (uploaded instanceof Error) {
          res.status(500).json({ message: uploaded.message });
          return;
        }

        if (!variant.images) {
          variant.images = [];
        }

        variant.images.push({
          public_id: uploaded.public_id,
          url: uploaded.secure_url,
        });
      }
    }

    if (files?.video) {
      const video = files.video as UploadedFile;

      if (video.size > 5 * 1024 * 1024) {
        res.status(400).json({ message: "Video must be <= 5MB" });
        return;
      }

      if (variant.video?.public_id) {
        await deleteFile(variant.video.public_id);
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

    await variant.save();

    res.status(200).json({
      message: "Variant updated successfully",
      variant,
    });
  } catch (err) {
    next(err);
  }
}

export async function productHasOrders(productId: mongoose.Types.ObjectId) {
  return await Order.exists({ product: productId });
}

export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction,
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

    const hasOrders = await productHasOrders(product._id);

    if (hasOrders) {
      res.status(400).json({
        message: "This product has already been ordered and cannot be deleted",
        hasOrders: true,
      });
      return;
    }

    // if parent has variants, prevent deletion (per your preference)
    if (product.variants && product.variants.length > 0) {
      res.status(400).json({
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
        product.images.map((img: { public_id: string }) =>
          img.public_id ? deleteFile(img.public_id) : Promise.resolve(),
        ),
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
  res: Response,
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

export async function getProductWithVariants(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { slug } = req.params;

    // 1️⃣ Find product by slug (can be parent or variant)
    const product = await Product.findOne({ slug, status: true })
      .populate("brand")
      .populate("attributes")
      .populate("pickup")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 2️⃣ Resolve parent product
    let parentProductId;

    if (product.isVariant && product.parentProduct) {
      parentProductId = product.parentProduct;
    } else {
      parentProductId = product._id;
    }

    // 3️⃣ Fetch parent product
    const parentProduct = await Product.findById(parentProductId)
      .populate("brand")
      .populate("attributes")
      .populate("pickup")
      .lean();

    if (!parentProduct) {
      return res.status(404).json({
        success: false,
        message: "Parent product not found",
      });
    }

    // 4️⃣ Fetch all variants of this parent
    const variants = await Product.find({
      parentProduct: parentProductId,
      status: true,
    })
      .populate("brand")
      .populate("attributes")
      .populate("pickup")
      .lean();

    // 5️⃣ Combine parent + variants (parent acts like default variant)
    const allOptions = [
      {
        ...parentProduct,
        isDefault: true,
      },
      ...variants.map((v) => ({
        ...v,
        isDefault: false,
      })),
    ];

    // 6️⃣ Detect selected product
    const selectedProduct = product.isVariant ? product : parentProduct;

    // 7️⃣ Extract variant attributes (Color, Size etc.)
    const variantOptions: Record<string, string[]> = {};

    allOptions.forEach((p) => {
      p.variables?.forEach((v: { name: string; values: string[] }) => {
        if (!variantOptions[v.name]) {
          variantOptions[v.name] = [];
        }

        v.values.forEach((val) => {
          if (!variantOptions[v.name]!.includes(val)) {
            variantOptions[v.name]!.push(val);
          }
        });
      });
    });

    return res.json({
      success: true,
      data: {
        selectedProduct,
        parentProduct,
        variants: allOptions,
        variantOptions, // 👈 Color, Size groups
      },
    });
  } catch (err) {
    next(err);
  }
}

const parseJSON = (value: any) => {
  if (!value) return undefined;
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
};

export async function deleteVariant(
  req: Request,
  res: Response,
  next: NextFunction,
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
