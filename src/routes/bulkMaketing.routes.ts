import { Router } from "express";
import {
  createCampaign,
  getAllTemplates,
} from "../controllers/bulkMarketing.controllers";

const router = Router();

router.get("/templates", getAllTemplates);

router.post("/create", createCampaign);

export default router;
