import type { Request, Response } from "express";
import { Attribute } from "../models/Attribute.ts";
import { Brand } from "../models/Brand.ts";
import { Category } from "../models/Category.ts";
import { Product } from "../models/Product.ts";

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ success: true, results: [] });
    }

    const regex = new RegExp(q, "i");

    const [categories, brands, attributes, products] = await Promise.all([
      // Categories (main + sub + child)
      Category.find({ name: regex }).limit(5).lean(),

      // Brands
      Brand.find({ name: regex }).limit(5).lean(),

      // Attributes
      Attribute.find({ name: regex }).limit(5).lean(),

      // Products
      Product.find({
        status: true,
        $or: [
          { name: regex },
          { shortDescription: regex },
          { longDescription: regex },
        ],
      })
        .select("name slug productId coverImage")
        .limit(5)
        .lean(),
    ]);

    res.json({
      success: true,
      results: [
        ...categories.map(c => ({
          type: "category",
          id: c._id,
          name: c.name,
        })),
        ...brands.map(b => ({
          type: "brand",
          id: b._id,
          name: b.name,
        })),
        ...attributes.map(a => ({
          type: "attribute",
          id: a._id,
          name: a.name,
        })),
        ...products.map(p => ({
          type: "product",
          id: p._id,
          name: p.name,
          slug: p.slug,
          image: p.coverImage?.url,
        })),
      ],
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getRandomSuggestions = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 8;

    const [categories, brands, attributes, products] = await Promise.all([
      Category.aggregate([{ $sample: { size: 3 } }]),
      Brand.aggregate([{ $sample: { size: 2 } }]),
      Attribute.aggregate([{ $sample: { size: 2 } }]),
      Product.aggregate([
        { $match: { status: true } },
        { $sample: { size: 3 } },
        { $project: { name: 1, slug: 1, coverImage: 1 } },
      ]),
    ]);

    const results = [
      ...categories.map(c => ({
        type: "category",
        name: c.name,
      })),
      ...brands.map(b => ({
        type: "brand",
        name: b.name,
      })),
      ...attributes.map(a => ({
        type: "attribute",
        name: a.name,
      })),
      ...products.map(p => ({
        type: "product",
        name: p.name,
        slug: p.slug,
        image: p.coverImage?.url,
      })),
    ].slice(0, limit);

    return res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Random suggestion error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch suggestions",
    });
  }
};