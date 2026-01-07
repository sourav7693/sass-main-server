import express from "express";
import { calculateRate } from "../controllers/shipping.controller.ts";


const router = express.Router();

router.post("/rate-calculator", calculateRate);



export default router;
