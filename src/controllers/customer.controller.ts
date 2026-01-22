import type { NextFunction, Request, Response } from "express";
import { Customer, type CustomerDoc } from "../models/Customer";
import { generateCustomId } from "../utils/generateCustomId";
import axios from "axios";
import {
  generateToken,
  type CustomerAuthRequest,
} from "../middlewares/auth.middleware";
import { Order } from "../models/Order";
export const otpStore: Record<string, { otp: string; expiresAt: number }> = {};
const formatMobile = (mobile: string) => {
  const raw = mobile.replace(/\D/g, "");
  return raw.startsWith("91") ? raw : "91" + raw;
};

export const sendOtp = async (req: Request, res: Response) => {
  // console.log("REQ HEADERS:", req.headers["content-type"]);
  // console.log("REQ BODY:", req.body);

  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile number required" });
    }

    const formattedMobile = formatMobile(mobile);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[formattedMobile] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    const payload = {
      "auth-key": process.env.WA_AUTH_KEY,
      "app-key": process.env.WA_APP_KEY,
      destination_number: formattedMobile,
      template_id: process.env.WA_TEMPLATE_ID,
      device_id: process.env.WA_DEVICE_ID,
      language: "en",
      variables: [otp, "+917044076603"],
    };
    // console.log("WA ENV CHECK:", {
    //   auth: process.env.WA_AUTH_KEY,
    //   app: process.env.WA_APP_KEY,
    //   template: process.env.WA_TEMPLATE_ID,
    //   device: process.env.WA_DEVICE_ID,
    // });

    const response = await axios.post(
      "https://web.wabridge.com/api/createmessage",
      payload,
    );

    // console.log("WA RESPONSE:", response.data);
    if (!response.data?.status) {
      return res.status(500).json({ message: "WhatsApp OTP failed" });
    }

    const customer = await Customer.findOne({ mobile: formattedMobile });

    res.json({
      success: true,
      message: customer ? "OTP sent for login" : "OTP sent for signup",
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "OTP send failed",
    });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ message: "Mobile & OTP required" });
    }

    const formattedMobile = formatMobile(mobile);

    const stored = otpStore[formattedMobile];

    if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    // console.log("STOREd:", stored.otp, "otp", otp);

    delete otpStore[formattedMobile];

    let customer = await Customer.findOne({ mobile: formattedMobile }).populate(
      "wishlist",
    );
    let isNewUser = false;

    if (!customer) {
      isNewUser = true;

      const customerId = await generateCustomId(Customer, "customerId", "CUS");

      customer = await Customer.create({
        customerId,
        mobile: formattedMobile,
        status: true,
        cart: [],
        wishlist: [],
        recentlyViewed: [],
      });
    }
    const token = generateToken(customer._id.toString(), "customer");
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 60 * 24 * 60 * 60 * 1000,
      })
      .json({
        success: true,
        isNewUser,
        message: isNewUser ? "Signup successful" : "Login successful",
        customer,
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "OTP verify failed",
    });
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const total = await Customer.countDocuments();

    const customer = await Customer.find()
      .populate("wishlist.product")
      .populate("cart.productId")
      .populate("cart.variantId")
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

    res.status(200).json({ message: "Success", customer });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
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
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

export const addCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.addresses.push(req.body);
    await customer.save();

const newAddress =
  customer.addresses[customer.addresses.length - 1];

    res.status(200).json({
      success: true,
      address: newAddress,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};


export const updateAddress = async (req: Request, res: Response) => {
  try {
    const { customerId, addressId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

      const address = customer.addresses.find(
      (a: any) => a._id.toString() === addressId
    );
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    Object.assign(address, req.body);
    await customer.save();

    res.status(200).json({
      message: "Address updated",
      address,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update address",
    });
  }
};


export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const { customerId, addressId } = req.params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.addresses = customer.addresses.filter(
      (a: any) => a._id.toString() !== addressId
    );

    await customer.save();

    res.status(200).json({
      message: "Address deleted",
      addressId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete address" });
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
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

export const getme = async (req: CustomerAuthRequest, res: Response) => {
  const customerId = req.user?.id;

  const customer = await Customer.findById(customerId)
    .populate("wishlist.product")
    .populate("cart.productId")
    .populate("cart.variantId");

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  let modified = false;

  /* ================= CART CLEANUP ================= */
  for (let i = customer.cart.length - 1; i >= 0; i--) {
    const item = customer.cart[i];
    if (!item || !item.productId) {
      customer.cart.splice(i, 1);
      modified = true;
    }
  }

  /* ================= WISHLIST CLEANUP ================= */
  for (let i = customer.wishlist.length - 1; i >= 0; i--) {
    const item = customer.wishlist[i];
    if (!item || !item.product) {
      customer.wishlist.splice(i, 1);
      modified = true;
    }
  }

  if (modified) {
    await customer.save();
  }

  res.json(customer);
};

export const logoutCustomer = (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/", // keep this
  });

  res.json({ success: true });
};

// ADD TO CART

export const addToCart = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { productId, variantId, quantity, priceAtTime } = req.body;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    // check if item already in cart
    const existing = customer.cart.find(
      (item) =>
        String(item.productId) === String(productId) &&
        String(item.variantId) === String(variantId),
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
    console.log(error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

// REMOVE FROM CART
export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const { productId, variantId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.cart = customer.cart.filter((item) => {
      // CASE 1: Variant product
      if (variantId && item.variantId) {
        return !(
          String(item.productId) === String(productId) &&
          String(item.variantId) === String(variantId)
        );
      }

      // CASE 2: Non-variant product
      if (!variantId && !item.variantId) {
        return String(item.productId) !== String(productId);
      }

      // Keep all other items
      return true;
    });

    await customer.save();

    return res.json({
      success: true,
      message: "Item removed from cart",
      data: customer.cart,
    });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

// WISHLIST TOGGLE
export const toggleWishlist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { productId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    const item = customer.wishlist.find(
      (w) => String(w.product) === String(productId),
    );

    if (item) {
      item.status = !item.status; // ❤️ toggle
    } else {
      customer.wishlist.push({
        product: productId,
        status: true,
      });
    }

    await customer.save();

    res.json({
      message: "Wishlist updated",
      wishlist: customer.wishlist, // homepage needs full list
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const { id, productId } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const initialLength = customer.wishlist.length;

    customer.wishlist = customer.wishlist.filter(
      (item) => String(item.product) !== String(productId),
    );

    if (customer.wishlist.length === initialLength) {
      return res.status(404).json({ message: "Product not found in wishlist" });
    }

    await customer.save();

    res.json({
      message: "Product removed from wishlist",
      wishlist: customer.wishlist,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

export const getMyWishlist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const customer = await Customer.findById(id);

    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    const activeWishlist = customer.wishlist.filter((w) => w.status === true);

    res.json({ wishlist: activeWishlist });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

// ADD RECENTLY VIEWED PRODUCT
export const addRecentlyViewed = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { productId } = req.body;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    // prevent duplicates
    customer.recentlyViewed = customer.recentlyViewed.filter(
      (p) => String(p) !== String(productId),
    );

    customer.recentlyViewed.unshift(productId);

    // keep only last 20
    customer.recentlyViewed = customer.recentlyViewed.slice(0, 20);

    await customer.save();
    res.json({ message: "Recently viewed updated" });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

// ADD NOTIFICATION
export const addNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { title, message } = req.body;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.notifications.push({
      title,
      message,
      createdAt: new Date(),
    });

    await customer.save();
    res.json({ message: "Notification added" });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
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
      { new: true },
    );

    if (!updated)
      return res.status(404).json({ message: "Customer not found" });

    res.json({ message: "Rewards updated", data: updated.rewards });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};

// ------------------------
// ADMIN: ADD GIFT CARD
// ------------------------
export const addGiftCard = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { code, balance, expiry } = req.body;

    const customer = await Customer.findById(id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.giftCards.push({ code, balance, expiry });

    await customer.save();
    res.json({ message: "Gift card added", data: customer.giftCards });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};
