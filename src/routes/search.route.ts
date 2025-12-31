import express from "express";
import { getRandomSuggestions, globalSearch } from "../controllers/search.controller.js";


const router = express.Router();

router.get("/", globalSearch);
router.get("/suggestions", getRandomSuggestions);



export default router;
