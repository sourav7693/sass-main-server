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
router.put("/:id", customerAuth, updateCustomer);
router.delete("/:id", customerAuth, deleteCustomer);


// Cart
router.post("/:id/cart", customerAuth, addToCart);
router.delete("/:id/cart", customerAuth, removeFromCart);

// Wishlist
router.post("/:id/wishlist", customerAuth, toggleWishlist);

// Recently Viewed
router.post("/:id/recently-viewed", customerAuth, addRecentlyViewed);

// Notifications
router.post("/:id/notifications", addNotification);

// Rewards (Admin)
router.post("/:id/rewards/update", updateRewards);

// Gift Cards (Admin)
router.post("/:id/giftcards", addGiftCard);

// Address Management
router.post("/:id/address", customerAuth, addAddress);
router.delete("/:id/address/:addressId", customerAuth, deleteAddress);

export default router;