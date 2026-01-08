import type { Request, Response } from "express";
import { generateCustomId } from "../utils/generateCustomId";
import { Attribute } from "../models/Attribute";
import type { CategoryDoc } from "../models/Category";

export const createAttribute = async (req : Request, res : Response) => {
    try {
        const { name } = req.body;
        const attributeId = await generateCustomId(Attribute, "attributeId", "ATTR");

        const attribute = await Attribute.create({
            attributeId,
            name,
        });
        res.status(201).json(attribute);
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};

export const getAttributes = async (req : Request, res : Response) => {
    try {
         const page = Number(req.query.page) || 1;
         const limit = req.query.limit ? Number(req.query.limit) : 10;         
        const total = await Attribute.countDocuments();

         const sort = req.query.sort ? String(req.query.sort) : "desc";
         const sortOrder = sort === "asc" ? 1 : -1;

        const attributes = await Attribute.find()
              .sort({ createdAt: sortOrder })
              .skip((page - 1) * limit)
              .limit(limit)
              .lean<CategoryDoc[]>();

        res.status(200).json({
          success: true,
          page,
          total,
          pages: Math.ceil(total / limit),
          attributes,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
          message: "Something went wrong",
          success: false,
          page: 0,
          total: 0,
          pages: 0,
        });
    }
};

export const updateAttribute = async (req : Request, res : Response) => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;

        const attribute = await Attribute.findOne({ attributeId: id });
        if (!attribute) {
            return res.status(404).json({ message: "Attribute not found" });
        }

        if (name !== undefined) attribute.name = name;
        if (status !== undefined) attribute.status = status;

        await attribute.save();
        res.status(200).json(attribute);
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};

export const deleteAttribute = async (req : Request, res : Response) => {
    try {
        const { id } = req.params;

        const attribute = await Attribute.findOne({ attributeId: id });
        if (!attribute) {
            return res.status(404).json({ message: "Attribute not found" });
        }

        await Attribute.findOneAndDelete({ attributeId: id });
        res.status(200).json({ message: "Attribute deleted" });
    } catch (error) {
        console.log(error);
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};