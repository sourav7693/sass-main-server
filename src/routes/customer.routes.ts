import { Router } from "express";
import {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  addToCart,
  removeFromCart,
  toggleWishlist,
  addRecentlyViewed,
  addNotification,
  updateRewards,
  addGiftCard,
  addAddress,
  deleteAddress,
  verifyOtp,
  sendOtp,
  getme,
  logoutCustomer,
} from "../controllers/customer.controller.js";
import { customerAuth } from "../middlewares/auth.middleware.js";

const router = Router();


router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logoutCustomer);

router.get("/me", customerAuth, getme);

router.post("/", createCustomer);
router.get("/", getCustomers); 
router.get("/:id", getCustomer); 
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);


// Cart
router.post("/:id/cart", addToCart);
router.delete("/:id/cart", removeFromCart);

// Wishlist
router.post("/:id/wishlist", toggleWishlist);

// Recently Viewed
router.post("/:id/recently-viewed", addRecentlyViewed);

// Notifications
router.post("/:id/notifications", addNotification);

// Rewards (Admin)
router.post("/:id/rewards/update", updateRewards);

// Gift Cards (Admin)
router.post("/:id/giftcards", addGiftCard);

// Address Management
router.post("/:id/address", addAddress);
router.delete("/:id/address/:addressId", deleteAddress);

export default router;