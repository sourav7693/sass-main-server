import { Router } from "express";
import {
  createAttribute,
  deleteAttribute,
  getAttributes,
  updateAttribute,
} from "../controllers/attribute.controller";

const router = Router();

router.post("/", createAttribute);
router.get("/", getAttributes);
router.put("/:id", updateAttribute);
router.delete("/:id", deleteAttribute);

export default router;
