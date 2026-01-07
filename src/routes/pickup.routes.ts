import { Router } from "express";
import {
  createPickup,
  deletePickup,
  getPickups,
  updatePickup,
} from "../controllers/pickup.controller.ts";

const router = Router();

router.post("/", createPickup);
router.get("/", getPickups);
router.put("/:id", updatePickup);
router.delete("/:id", deletePickup);

export default router;
