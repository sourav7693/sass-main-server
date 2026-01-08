import { Router } from "express";
import {
  registerUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  logoutUser,
  me,
  sendOtpForUser,
  verifyOtpForUser,
} from "../controllers/user.controller";
import { authorizeRoles, protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/",  protect, authorizeRoles("admin"), registerUser);

router.post("/login", loginUser);
router.post("/login/otp/send", sendOtpForUser);
router.post("/login/otp/verify", verifyOtpForUser);
router.get("/logout", logoutUser);

router.get("/me", protect, me);
router.get("/", protect, authorizeRoles("admin"), getUsers);
router.get("/:id", protect, authorizeRoles("admin"), getUserById);
router.put("/:id", protect, authorizeRoles("admin"), updateUser);
router.delete("/:id", protect, authorizeRoles("admin"), deleteUser);


export default router;
