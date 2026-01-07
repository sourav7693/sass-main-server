import { Router } from "express";
import {
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
  verifyOtp,
  sendOtp,
  getme,
  logoutCustomer,  
} from "../controllers/customer.controller.ts";
import { customerAuth } from "../middlewares/auth.middleware.ts";

const router = Router();


router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logoutCustomer);

router.get("/me", customerAuth, getme);

router.get("/", getCustomers); 
router.get("/:id", customerAuth, getCustomer); 
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

export default router;