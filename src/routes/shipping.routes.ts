import express from "express";
import { calculateRate } from "../controllers/shipping.controller.js";


const router = express.Router();

router.post("/rate-calculator", calculateRate);



export default router;
