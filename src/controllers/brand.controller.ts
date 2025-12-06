import type { Request, Response } from "express";
import { Brand, type BrandDoc } from "../models/Brand.js";
import { generateCustomId } from "../utils/generateCustomId.js";
import { getUploadedFile } from "./category.controller.js";
import { deleteFile, uploadFile } from "../utils/cloudinaryService.js";

export const createBrand = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const imageFile = getUploadedFile(req.files?.image);
    if (!imageFile) {
      return res.status(400).json({ message: "Brand image is required." });
    }
    const uploaded = await uploadFile(
        imageFile.tempFilePath,
      imageFile.mimetype
    );
    if (uploaded instanceof Error) {
      return res
        .status(500)
        .json({ message: "Failed to upload image to Cloudinary." });
    }
    const image = {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
    };

    const brandId = await generateCustomId(Brand, "brandId", "BRD");
    const brand = await Brand.create({ brandId, name, image });
    res.status(201).json(brand);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const getBrands = async (req: Request, res: Response) => {
  try {
     const page = Number(req.query.page) || 1;
     const limit = req.query.limit ? Number(req.query.limit) : 10;
      const sort = req.query.sort ? String(req.query.sort) : "desc";
      const sortOrder = sort === "asc" ? 1 : -1;

     const total = await Brand.countDocuments();

     const brands = await Brand.find()
      .sort({ createdAt: sortOrder })
       .skip((page - 1) * limit)
       .limit(limit)
       .lean<BrandDoc[]>();

     return res.json({
       success: true,
       page,
       total,
       pages: Math.ceil(total / limit),
       brands,
     });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong",
      success: false,
      page: 0,
      total: 0,
      pages: 0,
    });
  }
};

export const updateBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const brand = await Brand.findOne({ brandId: id });
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    if (name !== undefined) brand.name = name;
    if (status !== undefined) brand.status = status;

    if (req.files?.image) {
      const imageFile = getUploadedFile(req.files.image);
      const uploaded = await uploadFile(
        imageFile.tempFilePath,
        imageFile.mimetype
      );
      if (uploaded instanceof Error) {
        return res
          .status(500)
          .json({ message: "Failed to upload image to Cloudinary." });
      }

      if (brand.image.public_id) await deleteFile(brand.image.public_id);

      brand.image = {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      };
    }

    await brand.save();
    res.status(200).json(brand);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const deleteBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findOne({ brandId: id });
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    if (brand.image.public_id) await deleteFile(brand.image.public_id);

    await Brand.findOneAndDelete({ brandId: id });
    res.status(200).json({ message: "Brand deleted" });
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};
