import type { Request, Response } from "express";
import { Customer, type CustomerDoc } from "../models/Customer.js";
import { generateCustomId } from "../utils/generateCustomId.js";

export const createCustomer = async (req : Request, res: Response) => {
  try {
    const {
        name, email, mobile, password, avatar, addresses, role, status, 
        cart, wishlist, totalOrders, totalSpent, rewards, giftCards,
        recentlyViewed, notifications

    } = req.body;

    const exists = await Customer.findOne({
      $or: [{ email }, { mobile }],
    });

    if (exists) {
      return res.status(400).json({ message: "Customer already exists" });
    }
    const customerId = await generateCustomId(Customer, "customerId", "CUS");
    const newCustomer = await Customer.create(
        {
        customerId,
        name,
        email,
        mobile,
        password,
        avatar,
        addresses,
        role,
        status,
        cart,
        wishlist,
        totalOrders,
        totalSpent,
        rewards,
        giftCards,
        recentlyViewed,
        notifications
        }
    );
    if (!newCustomer) {
      return res.status(400).json({ message: "Failed to create customer" });
    }
    res.status(201).json({ message: "Customer created", customer: newCustomer });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
      const page = Number(req.query.page) || 1;
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        const total = await Customer.countDocuments();
    
        const customer = await Customer.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<CustomerDoc[]>();

    return res.json({
      success: true,
      page,
      total,
      pages: Math.ceil(total / limit),
      customer,
    });
  } catch (error) {
  res.status(500).json({
      message: "Something went wrong",
      success: false,
      page: 0,
      total: 0,
      pages: 0,
    });
  }
};

export const getCustomer = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({ message: "Success", customer});
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const updated = await Customer.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({ message: "Customer updated", data: updated });
  } catch (error) {
   res
     .status(500)
     .json({
       message:
         error instanceof Error ? error.message : "Internal Server Error",
     });
  }
};

// DELETE CUSTOMER
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const deleted = await Customer.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({ message: "Customer deleted" });
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
  }
};
// ADD TO CART

export const addToCart = async (req : Request, res : Response) => {
  try {
    const id = req.params.id;
    const { productId, variantId, quantity, priceAtTime } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // check if item already in cart
    const existing = customer.cart.find(
      (item) =>
        String(item.productId) === String(productId) &&
        String(item.variantId) === String(variantId)
    );

    if (existing) {
      existing.quantity += quantity || 1;
    } else {
      customer.cart.push({
        productId,
        variantId,
        quantity: quantity || 1,
        priceAtTime,
      });
    }

    await customer.save();
    res.json({ message: "Added to cart", data: customer.cart });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

// REMOVE FROM CART
export const removeFromCart = async (req : Request, res : Response) => {
  try {
    const id = req.params.id;
    const { productId, variantId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.cart = customer.cart.filter(
      (item) =>
        !(String(item.productId) === String(productId) &&
          String(item.variantId) === String(variantId))
    );

    await customer.save();
    res.json({ message: "Removed from cart", data: customer.cart });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

// WISHLIST TOGGLE
export const toggleWishlist = async (req : Request, res : Response) => {
  try {
    const id = req.params.id;
    const { productId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const exists = customer.wishlist.includes(productId);

    if (exists) {
      customer.wishlist = customer.wishlist.filter(
        (p) => String(p) !== String(productId)
      );
    } else {
      customer.wishlist.push(productId);
    }

    await customer.save();
    res.json({ message: "Wishlist updated", wishlist: customer.wishlist });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

// ADD RECENTLY VIEWED PRODUCT
export const addRecentlyViewed = async (req : Request, res : Response) => {
  try {
    const id = req.params.id;
    const { productId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // prevent duplicates
    customer.recentlyViewed = customer.recentlyViewed.filter(
      (p) => String(p) !== String(productId)
    );

    customer.recentlyViewed.unshift(productId);

    // keep only last 20
    customer.recentlyViewed = customer.recentlyViewed.slice(0, 20);

    await customer.save();
    res.json({ message: "Recently viewed updated" });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

// ADD NOTIFICATION
export const addNotification = async (req : Request, res: Response) => {
  try {
    const id = req.params.id;
    const { title, message } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.notifications.push({
      title,
      message,
      createdAt: new Date(),
    });

    await customer.save();
    res.json({ message: "Notification added" });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
  }
};

// ADMIN: UPDATE REWARDS
// ------------------------
export const updateRewards = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { points, tier } = req.body;

    const updated = await Customer.findByIdAndUpdate(
      id,
      { rewards: { points, tier } },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Customer not found" });

    res.json({ message: "Rewards updated", data: updated.rewards });
  } catch (error) {
   res
     .status(500)
     .json({
       message:
         error instanceof Error ? error.message : "Internal Server Error",
     });
  }
};

// ------------------------
// ADMIN: ADD GIFT CARD
// ------------------------
export const addGiftCard = async (req : Request, res : Response) => {
  try {
    const id = req.params.id;
    const { code, balance, expiry } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.giftCards.push({ code, balance, expiry });

    await customer.save();
    res.json({ message: "Gift card added", data: customer.giftCards });
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
  }
};

// ------------------------
// ADD / UPDATE ADDRESS
// ------------------------
export const addAddress = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.addresses.push(req.body);
    await customer.save();

    res.json({ message: "Address added", data: customer.addresses });
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const addressId = req.params.addressId;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.addresses = customer.addresses.filter(
      (addr) => String(addr._id) !== String(addressId)
    );

    await customer.save();
    res.json({ message: "Address deleted", data: customer.addresses });
  } catch (error) {
     res
       .status(500)
       .json({
         message:
           error instanceof Error ? error.message : "Internal Server Error",
       });
  }
};