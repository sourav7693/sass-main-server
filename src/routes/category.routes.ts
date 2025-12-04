import { Router } from "express";
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  addChildCategory,
} from "../controllers/category.controller.js";

const router = Router();

router.post("/", createCategory);
router.post("/:id/add-child", addChildCategory);
router.get("/", getCategories);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
