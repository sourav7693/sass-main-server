import { Router } from "express";
import {
  createCommunicationProvider,
  updateCommunicationProvider,
  getCommunicationProviders,
  deleteCommunicationProvider,
} from "../controllers/communicationProvider.controller.ts";

const router = Router();


router.get("/", getCommunicationProviders);

router.post("/", createCommunicationProvider);


router.put("/:id", updateCommunicationProvider);
router.delete("/:id", deleteCommunicationProvider);


export default router;
