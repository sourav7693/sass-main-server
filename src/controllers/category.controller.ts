import type { Request, Response } from "express";
import { Category, type CategoryDoc, type ImageType, type Level } from "../models/Category.js";
import {
  deleteFile,
  uploadFile,
} from "../utils/cloudinaryService.js";
import { generateCustomId } from "../utils/generateCustomId.js";

// -------------------------------
// VALIDATION HELPERS
// -------------------------------
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

  // Multiple files?
  if (Array.isArray(file)) return file[0];

  return file;
};

// -------------------------------
// CREATE CATEGORY
// -------------------------------

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

// -------------------------------
// GET ALL CATEGORIES
// -------------------------------
export const getCategories = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const search = req.query.search ? String(req.query.search) : "";

    const regex = new RegExp(search, "i"); // Case-insensitive search

    // Fetch all categories (fast on indexed db)
    const allCategories = await Category.find().lean<CategoryDoc[]>();

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


// -------------------------------
// UPDATE CATEGORY
// -------------------------------
const updateNestedChildren = (
  children: Level[],
  targetName: string,
  targetType: string,
  newName: string,
  newImage?: ImageType
): boolean => {
  for (const child of children) {
    // must match both type + name
    if (child.name === targetName && child.type === targetType) {
      child.name = newName;
      if (newImage) child.image = newImage;
      return true;
    }

    // recursive search
    if (child.children && child.children.length > 0) {
      const updated = updateNestedChildren(
        child.children,
        targetName,
        targetType,
        newName,
        newImage
      );
      if (updated) return true;
    }
  }
  return false;
};



export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, targetChildName, targetChildType, newChildName } = req.body;

    const category = await Category.findOne({ categoryId: id });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let uploadedImage: ImageType | undefined;

    // upload image if provided
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

    // --------------------------
    // UPDATE MAIN CATEGORY
    // --------------------------
    if (!targetChildName) {
      if (name) category.name = name;
      if (uploadedImage) category.image = uploadedImage;

      await category.save();
      return res.json({ success: true, category });
    }

    // --------------------------
    // UPDATE CHILD CATEGORY
    // --------------------------
    if (!targetChildType) {
      return res.status(400).json({
        message: "targetChildType is required when updating a child level.",
      });
    }

    const updated = updateNestedChildren(
      category.children,
      targetChildName,
      targetChildType,
      newChildName || targetChildName,
      uploadedImage
    );

    if (!updated) {
      return res.status(404).json({ message: "Child category not found" });
    }

    await category.save();

    return res.json({ success: true, category });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


// -------------------------------
// DELETE CATEGORY
// -------------------------------
// Recursively delete Cloudinary images for a level
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

const deleteNestedChild = async (
  children: Level[],
  targetName: string,
  targetType: string
): Promise<boolean> => {
  const index = children.findIndex(
    (c) => c.name === targetName && c.type === targetType
  );

  if (index !== -1) {
    const targetNode = children[index];

    if (targetNode) {
      await deleteImagesRecursively(targetNode);
    }

    children.splice(index, 1);

    return true;
  }

  // Search deeper
  for (const child of children) {
    if (child.children) {
      const deleted = await deleteNestedChild(
        child.children,
        targetName,
        targetType
      );
      if (deleted) return true;
    }
  }

  return false;
};



export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetChildName, targetChildType } = req.body;

    const category = await Category.findOne({ categoryId: id });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Delete entire parent category
    if (!targetChildName) {
      if (category.image?.public_id) {
        await deleteFile(category.image.public_id);
      }

      // Also delete all nested children images
      for (const child of category.children) {
        await deleteImagesRecursively(child);
      }

      await Category.findOneAndDelete({ categoryId: id });
      return res.json({ success: true, message: "Category deleted" });
    }

    // Delete nested child
    const deleted = await deleteNestedChild(
      category.children,
      targetChildName,
      targetChildType
    );

    if (!deleted) {
      return res.status(404).json({ message: "Child category not found" });
    }

    await category.save();

    return res.json({
      success: true,
      message: "Child category deleted",
      category,
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

