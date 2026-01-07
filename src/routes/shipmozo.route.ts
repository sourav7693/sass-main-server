import express from "express";
import { shipmozoWebhook } from "../controllers/shipmozo.controller.js";

const router = express.Router();

router.post("/shipmozo", shipmozoWebhook);

export default router;
