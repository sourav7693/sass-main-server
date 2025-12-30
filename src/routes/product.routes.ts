// server/routes/product.routes.ts
import { Router } from "express";
import {
  createProduct,
  createVariant,
  getProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  getVariantById,
  updateVariant,
  deleteVariant,
  getProductsByCategory,
} from "../controllers/product.controller.js";

const router = Router();

router.post("/", createProduct);
router.get("/", listProducts);
router.get("/:productId", getProduct);
router.put("/:productId", updateProduct);
router.delete("/:id", deleteProduct);

router.post("/:parentId/variant", createVariant);
router.get("/variant/:variantId", getVariantById);
router.put("/variant/:productId", updateVariant);
router.delete("/variant/:variantId", deleteVariant);


export default router;
