import { Router } from "express";
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  addChildCategory,
  getCategoriesWithProducts,
} from "../controllers/category.controller";

const router = Router();

router.post("/", createCategory);
router.post("/add-child", addChildCategory);
router.get("/", getCategories);
router.get("/with-products", getCategoriesWithProducts);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
