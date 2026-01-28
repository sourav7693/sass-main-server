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
  getProductWithVariants,
  getRelatedProducts,
} from "../controllers/product.controller";

const router = Router();

router.post("/", createProduct);
router.get("/", listProducts);
router.get(
  "/:slug/related",
  getRelatedProducts
);
router.get("/:productId", getProduct);
router.put("/:productId", updateProduct);
router.delete("/:id", deleteProduct);

router.post("/:parentId/variant", createVariant);
router.get("/variant/:variantId", getVariantById);
router.get("/variants/:slug", getProductWithVariants);
router.put("/variant/:productId", updateVariant);
router.delete("/variant/:variantId", deleteVariant);



export default router;
