import { Router } from "express";
import {
  createSlider,
  deleteSlider,
  getSliders,
  updateSlider,
} from "../controllers/slider.controller.ts";

const router = Router();

router.post("/", createSlider);
router.get("/", getSliders);
router.put("/:id", updateSlider);
router.delete("/:id", deleteSlider);

export default router;
