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
} from "../controllers/customer.controller.js";

const router = Router();

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