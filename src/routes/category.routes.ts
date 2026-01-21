import { Router } from "express";
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  addChildCategory,
} from "../controllers/category.controller";

const router = Router();

router.post("/", createCategory);
router.post("/add-child", addChildCategory);
router.get("/", getCategories);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
