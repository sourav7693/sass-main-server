import { Router } from "express";
import {
  createPickup,
  deletePickup,
  getLocationDetailsWithPin,
  getPickups,
  updatePickup,
} from "../controllers/pickup.controller";

const router = Router();

router.post("/", createPickup);
router.get("/", getPickups);
router.get("/location/:pin", getLocationDetailsWithPin);
router.put("/:id", updatePickup);
router.delete("/:id", deletePickup);

export default router;
