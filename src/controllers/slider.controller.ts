import type { Request, Response } from "express";
import { Slider, type SliderDoc } from "../models/Slider";
import { generateCustomId } from "../utils/generateCustomId";
import { getUploadedFile } from "./category.controller";
import { deleteFile, uploadFile } from "../utils/cloudinaryService";

export const createSlider = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const imageFile = getUploadedFile(req.files?.image);
    if (!imageFile) {
      return res.status(400).json({ message: "Slider image is required." });
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

    const sliderId = await generateCustomId(Slider, "sliderId", "SLD");
    const slider = await Slider.create({ sliderId, name, image });
    res.status(201).json(slider);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const getSliders = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const total = await Slider.countDocuments();

    const sliders = await Slider.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<SliderDoc[]>();

    return res.json({
      success: true,
      page,
      total,
      pages: Math.ceil(total / limit),
      sliders,
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

export const updateSlider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const slider = await Slider.findOne({ sliderId: id });
    if (!slider) {
      return res.status(404).json({ message: "Slider not found" });
    }

    if (name !== undefined) slider.name = name;
    if (status !== undefined) slider.status = status;

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

      if (slider.image.public_id) await deleteFile(slider.image.public_id);

      slider.image = {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      };
    }

    await slider.save();
    res.status(200).json(slider);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const deleteSlider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const slider = await Slider.findOne({ sliderId: id });
    if (!slider) {
      return res.status(404).json({ message: "Slider not found" });
    }

    if (slider.image.public_id) await deleteFile(slider.image.public_id);

    await Slider.findOneAndDelete({ sliderId: id });
    res.status(200).json({ message: "Slider deleted" });
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};
