import express from "express";
import { getRandomSuggestions, globalSearch } from "../controllers/search.controller";


const router = express.Router();

router.get("/", globalSearch);
router.get("/suggestions", getRandomSuggestions);



export default router;
