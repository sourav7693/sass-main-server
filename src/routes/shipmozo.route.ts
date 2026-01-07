import express from "express";
import { shipmozoWebhook } from "../controllers/shipmozo.controller.ts";

const router = express.Router();

router.post("/shipmozo", shipmozoWebhook);

export default router;
