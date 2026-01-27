import { Router } from "express";
import { getAllTemplates } from "../controllers/bulkMarketing.controllers";

const router = Router();

router.get("/templates", getAllTemplates);

export default router;
