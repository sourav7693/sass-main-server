import { Router } from "express";
import {
  createVariable,
  deleteVariable,
  getVariables,
  updateVariable,
} from "../controllers/variable.controller.js";

const router = Router();

router.post("/", createVariable);
router.get("/", getVariables);
router.put("/:id", updateVariable);
router.delete("/:id", deleteVariable);

export default router;
