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
  removeFromWishlist,
  addCustomerAddress,
  deleteAddress,
  updateAddress,
  getFilteredCustomers,
} from "../controllers/customer.controller";
import { customerAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logoutCustomer);
router.post("/:id/address", customerAuth, addCustomerAddress);

router.get("/me", customerAuth, getme);

router.get("/", getCustomers);
router.get("/filter", getFilteredCustomers);

router.get("/:id", customerAuth, getCustomer);

router.put("/:customerId/address/:addressId", customerAuth, updateAddress);
router.put("/:id", customerAuth, updateCustomer);
router.delete("/:id", customerAuth, deleteCustomer);
router.delete("/:customerId/address/:addressId", customerAuth, deleteAddress);

// Cart
router.post("/:id/cart", customerAuth, addToCart);
router.delete("/:id/cart", customerAuth, removeFromCart);

// Wishlist

router.post("/:id/wishlist", customerAuth, toggleWishlist);
router.delete(
  "/remove-wishlist/:id/:productId",
  customerAuth,
  removeFromWishlist,
);

// Recently Viewed
router.post("/:id/recently-viewed", customerAuth, addRecentlyViewed);

// Notifications
router.post("/:id/notifications", addNotification);

// Rewards (Admin)
router.post("/:id/rewards/update", updateRewards);

// Gift Cards (Admin)
router.post("/:id/giftcards", addGiftCard);

// Get Customer

export default router;
