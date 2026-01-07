import type { Request, Response } from "express";
import { Category, type CategoryDoc, type ImageType, type Level } from "../models/Category.ts";
import {
  deleteFile,
  uploadFile,
} from "../utils/cloudinaryService.ts";
import { generateCustomId } from "../utils/generateCustomId.ts";
import { Types } from "mongoose";

const validateLevels = (levels: Level[]): boolean => {
  if (!Array.isArray(levels)) return false;

  for (const lvl of levels) {
    if (!lvl.type || typeof lvl.type !== "string") return false;

    if (lvl.name && typeof lvl.name !== "string") return false;

    if (lvl.children && !validateLevels(lvl.children)) return false;
  }
  return true;
};

export const getUploadedFile = (file: any) => {
  if (!file) return null;

  if (Array.isArray(file)) return file[0];

  return file;
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, children } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required." });
    }

    const imageFile = getUploadedFile(req.files?.image);
    if (!imageFile) {
      return res.status(400).json({ message: "Category image is required." });
    }

    // Generate custom Category ID
    const categoryId = await generateCustomId(Category, "categoryId", "CAT");

    // Upload the image (stored by express-fileupload)
    const uploaded = await uploadFile(
      imageFile.tempFilePath,
      imageFile.mimetype
    );

    if (uploaded instanceof Error) {
      return res
        .status(500)
        .json({ message: "Failed to upload image to Cloudinary." });
    }

    // Parse children if provided
    let parsedChildren = [];
   if (children) {
     try {
       parsedChildren = JSON.parse(children);

       // Validate structure
       if (!validateLevels(parsedChildren)) {
         return res
           .status(400)
           .json({ message: "Invalid structure for child levels." });
       }

       // Ensure type exists on all nested children
       const ensureTypeExists = (levels: Level[]) => {
         for (const lvl of levels) {
           if (!lvl.type) {
             throw new Error("Each child level must include a 'type' field.");
           }
           if (lvl.children) ensureTypeExists(lvl.children);
         }
       };

       ensureTypeExists(parsedChildren);

        for (let i = 0; i < parsedChildren.length; i++) {
      const fieldName = parsedChildren[i].imageField; // ex: "child_1_img"

      if (fieldName && req.files?.[fieldName]) {
        const file = getUploadedFile(req.files[fieldName]);
        const childUpload = await uploadFile(
          file.tempFilePath,
          file.mimetype
        );

        if (!(childUpload instanceof Error)) {
          parsedChildren[i].image = {
            public_id: childUpload.public_id,
            url: childUpload.secure_url,
          };
        }
      }
      
    }
     } catch (err) {
       return res
         .status(400)
         .json({
           message: "Invalid children JSON format or missing 'type' field.",
         });
     }
   }

    const newCategory = new Category({
      categoryId,
      name,
      image: {
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      },
      children: parsedChildren,
    });

    await newCategory.save();

    return res.status(201).json({
      message: "Category created successfully.",
      category: newCategory,
    });
  } catch (error: any) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

const insertChildById = (
  nodes: Level[],
  parentId: string,
  newChild: Level
): boolean => {
  for (const node of nodes) {
    if (String(node._id) === parentId) {
      node.children?.push(newChild);
      return true;
    }

    if (node.children && insertChildById(node.children, parentId, newChild)) {
      return true;
    }
  }

  return false;
};

export const addChildCategory = async (req: Request, res: Response) => {
  try {
    // const { id } = req.params; // categoryId
    const { categoryId, parentId, name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        message: "name and type are required",
      });
    }

    const category = await Category.findOne({ categoryId });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let childImage: ImageType = {};
    if (req.files?.image) {
      const file = getUploadedFile(req.files.image);
      const uploaded = await uploadFile(file.tempFilePath, file.mimetype);

      if (!(uploaded instanceof Error)) {
        childImage = {
          public_id: uploaded.public_id,
          url: uploaded.secure_url,
        };
      }
    }

    const newChild: Level = {
      _id: new Types.ObjectId(),
      name,
      type,
      image: childImage,
      children: [],
    };

    // ---- If parentId is missing or matches root category, push to root ----
    if (!parentId || parentId === String(category._id)) {
      category.children.push(newChild);
      await category.save();

      return res.json({
        success: true,
        message: "Child added to root category",
        category,
      });
    }

    // ---- Recursive insert under nested children ----
    const insertChildById = (nodes: Level[], parentId: string): boolean => {
      for (const node of nodes) {
        if (String(node._id) === parentId) {
          node.children?.push(newChild);
          return true;
        }
        if (node.children && insertChildById(node.children, parentId)) {
          return true;
        }
      }
      return false;
    };

    const inserted = insertChildById(category.children, parentId);

    if (!inserted) {
      return res.status(404).json({
        message: "Parent node not found",
      });
    }

    await category.save();

    return res.json({
      success: true,
      message: "Child category added successfully",
      category,
    });
  } catch (error: any) {
    console.error("Add Child Category Error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const search = req.query.search ? String(req.query.search) : "";
   
    const sort = req.query.sort ? String(req.query.sort) : "desc";
    const sortOrder = sort === "asc" ? 1 : -1;

    const regex = new RegExp(search, "i"); // Case-insensitive search

    // Fetch all categories (fast on indexed db)
    const allCategories = await Category.find()
      .sort({ createdAt: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<CategoryDoc[]>();

    // Recursive function to check deep children
    const matchesDeep = (children: Level[]): boolean => {
      for (const child of children) {
        if (child.name && regex.test(child.name)) return true;
        if (child.children && matchesDeep(child.children)) return true;
      }
      return false;
    };

    // Filter by main name OR by deep children
    const filtered = allCategories.filter((cat) => {
      if (cat.name && regex.test(cat.name)) return true;
      if (cat.children && matchesDeep(cat.children)) return true;
      return false;
    });

    // Pagination applied *after* filtering
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return res.json({
      success: true,
      page,
      total,
      pages: Math.ceil(total / limit),
      categories: paginated,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
      page: 0,
      total: 0,
      pages: 0,
    });
  }
};

const updateNestedChildrenById = async(
  children: Level[],
  targetId: string,
  newName?: string,
  newImage?: ImageType
): Promise<boolean> => {
  for (const child of children) {
    if (String(child._id) === targetId) {
      if (newName) child.name = newName;
      if (newImage) {
        if (child.image?.public_id) {
          await deleteFile(child.image.public_id);
        }
        child.image = newImage;
      }
      return true;
    }

    if (
      child.children &&
      await updateNestedChildrenById(child.children, targetId, newName, newImage)
    ) {
      return true;
    }
  }
  return false;
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, childId, newChildName } = req.body;

    const category = await Category.findOne({ categoryId: id });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let uploadedImage: ImageType | undefined;

    if (req.files?.image) {
      const file = getUploadedFile(req.files.image);
      const upload = await uploadFile(file.tempFilePath, file.mimetype);

      if (upload instanceof Error) {
        return res.status(500).json({ message: "Image upload failed" });
      }

      uploadedImage = {
        public_id: upload.public_id,
        url: upload.secure_url,
      };
    }

    // ---- Update main category if no childId ----
    if (!childId) {
      if (name) category.name = name;

      if (uploadedImage) {
        // Delete old main category image
        if (category.image?.public_id) {
          await deleteFile(category.image.public_id);
        }
        category.image = uploadedImage;
      }

      await category.save();
      return res.json({ success: true, category });
    }

    // ---- Update nested child ----
    const updated = await updateNestedChildrenById(
      category.children,
      childId,
      newChildName,
      uploadedImage
    );

    if (!updated) {
      return res.status(404).json({ message: "Child node not found" });
    }

    await category.save();

    return res.json({
      success: true,
      message: "Child updated successfully",
      category,
    });
  } catch (err: any) {
    console.error("Update Category Error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
};
const deleteImagesRecursively = async (node: Level) => {
  if (node.image?.public_id) {
    await deleteFile(node.image.public_id);
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await deleteImagesRecursively(child);
    }
  }
};

const deleteNestedChildById = async (
  children: Level[],
  targetId: string
): Promise<boolean> => {
  const index = children.findIndex((c) => String(c._id) === targetId);

  if (index !== -1) {
    const targetNode = children[index];

    if (targetNode) {
      await deleteImagesRecursively(targetNode);
    }
    children.splice(index, 1);

    return true;
  }

  for (const child of children) {
    if (child.children) {
      const deleted = await deleteNestedChildById(child.children, targetId);
      if (deleted) return true;
    }
  }

  return false;
};
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const childId = req.body?.childId;

    const category = await Category.findOne({ categoryId: id });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Delete entire category
    if (!childId) {
      if (category.image?.public_id) await deleteFile(category.image.public_id);

      for (const child of category.children) {
        await deleteImagesRecursively(child);
      }

      await Category.findOneAndDelete({ categoryId: id });

      return res.json({ success: true, message: "Category deleted" });
    }

    // Delete nested child
    const deleted = await deleteNestedChildById(category.children, childId);

    if (!deleted) {
      return res.status(404).json({ message: "Child not found" });
    }

    await category.save();

    return res.json({
      success: true,
      message: "Child deleted",
      category,
    });
  } catch (err) {
    console.error("Delete Category Error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
};