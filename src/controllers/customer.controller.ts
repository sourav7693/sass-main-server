import type { Request, Response } from "express";
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
      template_id: "1424507052378864",
      device_id: process.env.WA_DEVICE_ID,
      language: "en",
      variables: [otp],
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

    const newAddress = customer.addresses[customer.addresses.length - 1];

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
      (a: any) => a._id.toString() === addressId,
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
      (a: any) => a._id.toString() !== addressId,
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
      (item: { productId: string; variantId: string }) =>
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

    customer.cart = customer.cart.filter(
      (item: { productId: string; variantId: string }) => {
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
      },
    );

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

    const alreadyExists = customer.wishlist.some(
      (w: { product: string }) => String(w.product) === String(productId),
    );

    if (alreadyExists) {
      return res.status(200).json({
        message: "Product already in wishlist",
        wishlist: customer.wishlist,
      });
    }

    customer.wishlist.push({ product: productId });

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
      (item: { product: string }) => String(item.product) !== String(productId),
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

    const activeWishlist = customer.wishlist.filter(
      (w: { status: boolean }) => w.status === true,
    );

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
      (p: string) => String(p) !== String(productId),
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

export const getFilteredCustomers = async (req: Request, res: Response) => {
  try {
    const { filterType, page = 1, limit = 20, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build base query
    let query: any = {};

    // Add search functionality if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    // Apply filter based on filterType
    switch (filterType) {
      case "all":
        // Fetch all customers
        break;

      case "ordered":
        // Customers who have placed at least one order
        await applyOrderedFilter(query);
        break;

      case "registered":
        // Registered customers who haven't placed any order
        await applyRegisteredNoOrderFilter(query);
        break;

      case "cart":
        // Customers with items in cart
        query["cart.0"] = { $exists: true }; // At least one item in cart
        break;

      case "wishlist":
        // Customers with items in wishlist
        query["wishlist.0"] = { $exists: true }; // At least one item in wishlist
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid filter type. Valid types: all, ordered, registered, cart, wishlist",
        });
    }

    // Fetch customers with pagination
    const customers = await Customer.find(query)
      .select(
        "customerId name email mobile gender totalOrders totalSpent cart wishlist createdAt",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Get total count for pagination
    const total = await Customer.countDocuments(query);

    // Enrich customer data with additional information
    const enrichedCustomers = await enrichCustomerData(customers, filterType);

    res.status(200).json({
      success: true,
      customers: enrichedCustomers,
      pagination: {
        total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching filtered customers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message,
    });
  }
};

// Helper function to filter customers who have ordered
async function applyOrderedFilter(query: { [key: string]: any }) {
  try {
    // Find all customers who have placed orders
    const orderedCustomerIds = await Order.distinct("customerId", {
      customerId: { $exists: true, $ne: null },
    });

    // If using customerId reference, adjust based on your Order schema
    // This assumes Order has a customerId field referencing Customer
    query.customerId = { $in: orderedCustomerIds };

    // Alternative approach if you store totalOrders in Customer
    query.totalOrders = { $gt: 0 };
  } catch (error) {
    console.error("Error in applyOrderedFilter:", error);
    throw error;
  }
}

// Helper function to filter registered customers without orders
async function applyRegisteredNoOrderFilter(query: { [key: string]: any }) {
  try {
    // Get customers who have placed orders
    const orderedCustomerIds = await Order.distinct("customerId", {
      customerId: { $exists: true, $ne: null },
    });

    // Exclude customers who have placed orders
    // AND ensure they are registered (have mobile/email)
    query.$and = [
      {
        $or: [
          { mobile: { $exists: true, $ne: "" } },
          { email: { $exists: true, $ne: "" } },
        ],
      },
    ];

    // Exclude those who have orders
    if (orderedCustomerIds.length > 0) {
      query.customerId = { $nin: orderedCustomerIds };
    }

    // Alternative approach using totalOrders
    query.totalOrders = 0;
  } catch (error) {
    console.error("Error in applyRegisteredNoOrderFilter:", error);
    throw error;
  }
}

// Helper function to enrich customer data
async function enrichCustomerData(
  customers: { [key: string]: any },
  filterType: string,
) {
  return Promise.all(
    customers.map(async (customer: { [key: string]: any }) => {
      const enriched = { ...customer };

      // Add cart count
      enriched.cartCount = customer.cart?.length || 0;

      // Add wishlist count
      enriched.wishlistCount = customer.wishlist?.length || 0;

      // For cart filter, add cart summary
      if (filterType === "cart" && customer.cart?.length > 0) {
        enriched.cartSummary = {
          totalItems: customer.cart.reduce(
            (sum: number, item: { quantity: number }) => sum + item.quantity,
            0,
          ),
          uniqueProducts: customer.cart.length,
          estimatedValue: customer.cart.reduce(
            (sum: number, item: { priceAtTime: number; quantity: number }) =>
              sum + item.priceAtTime * item.quantity,
            0,
          ),
        };
      }

      // For wishlist filter, add wishlist summary
      if (filterType === "wishlist" && customer.wishlist?.length > 0) {
        enriched.wishlistCount = customer.wishlist.length;
      }

      // Add order information if available
      if (customer.totalOrders > 0) {
        enriched.lastOrderValue = await getLastOrderValue(customer.customerId);
      }

      // Calculate days since registration
      enriched.daysSinceRegistration = Math.floor(
        (new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24),
      );

      return enriched;
    }),
  );
}

// Helper to get last order value
async function getLastOrderValue(customerId: string) {
  try {
    const lastOrder = await Order.findOne({ customerId })
      .sort({ createdAt: -1 })
      .select("totalAmount")
      .lean();

    return lastOrder?.totalAmount || 0;
  } catch (error) {
    console.error("Error getting last order value:", error);
    return 0;
  }
}

// Alternative: Get customers with detailed statistics
export const getCustomersWithStats = async (req: Request, res: Response) => {
  try {
    const { filterType, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let matchStage = {};

    // Build match stage based on filter
    switch (filterType) {
      case "all":
        matchStage = {};
        break;

      case "ordered":
        matchStage = { totalOrders: { $gt: 0 } };
        break;

      case "registered":
        matchStage = {
          $and: [
            { totalOrders: 0 },
            {
              $or: [
                { mobile: { $exists: true, $ne: "" } },
                { email: { $exists: true, $ne: "" } },
              ],
            },
          ],
        };
        break;

      case "cart":
        matchStage = { "cart.0": { $exists: true } };
        break;

      case "wishlist":
        matchStage = { "wishlist.0": { $exists: true } };
        break;

      default:
        matchStage = {};
    }

    // Aggregate query for better performance with stats
    const aggregation = [
      { $match: matchStage },
      {
        $addFields: {
          cartCount: { $size: "$cart" },
          wishlistCount: { $size: "$wishlist" },
          hasCartItems: { $gt: [{ $size: "$cart" }, 0] },
          hasWishlistItems: { $gt: [{ $size: "$wishlist" }, 0] },
        },
      },
      {
        $project: {
          customerId: 1,
          name: 1,
          email: 1,
          mobile: 1,
          gender: 1,
          totalOrders: 1,
          totalSpent: 1,
          cartCount: 1,
          wishlistCount: 1,
          hasCartItems: 1,
          hasWishlistItems: 1,
          daysSinceRegistration: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), "$createdAt"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const customers = await Customer.aggregate(aggregation);

    // Get total count separately (more efficient for large datasets)
    const countAggregation = [{ $match: matchStage }, { $count: "total" }];

    const countResult = await Customer.aggregate(countAggregation);
    const total = countResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      customers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error in getCustomersWithStats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer statistics",
      error: error.message,
    });
  }
};

// Get customer counts by filter type (for dashboard)
export const getCustomerCounts = async (req: Request, res: Response) => {
  try {
    const counts = {
      all: 0,
      ordered: 0,
      registered: 0,
      cart: 0,
      wishlist: 0,
    };

    // Get all counts in parallel for efficiency
    const [allCount, orderedCount, registeredCount, cartCount, wishlistCount] =
      await Promise.all([
        // All customers
        Customer.countDocuments(),

        // Customers with orders
        Customer.countDocuments({ totalOrders: { $gt: 0 } }),

        // Registered but no orders
        Customer.countDocuments({
          $and: [
            { totalOrders: 0 },
            {
              $or: [
                { mobile: { $exists: true, $ne: "" } },
                { email: { $exists: true, $ne: "" } },
              ],
            },
          ],
        }),

        // Customers with cart items
        Customer.countDocuments({ "cart.0": { $exists: true } }),

        // Customers with wishlist items
        Customer.countDocuments({ "wishlist.0": { $exists: true } }),
      ]);

    counts.all = allCount;
    counts.ordered = orderedCount;
    counts.registered = registeredCount;
    counts.cart = cartCount;
    counts.wishlist = wishlistCount;

    res.status(200).json({
      success: true,
      counts,
    });
  } catch (error: any) {
    console.error("Error getting customer counts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer counts",
      error: error.message,
    });
  }
};

// Get mobile numbers for bulk messaging
export const getCustomerMobilesForMessaging = async (
  req: Request,
  res: Response,
) => {
  try {
    const { filterType, limit = 10000 } = req.query;

    let query: any = { mobile: { $exists: true, $ne: "" } };

    // Apply filter
    switch (filterType) {
      case "all":
        break;
      case "ordered":
        query.totalOrders = { $gt: 0 };
        break;
      case "registered":
        query.totalOrders = 0;
        break;
      case "cart":
        query["cart.0"] = { $exists: true };
        break;
      case "wishlist":
        query["wishlist.0"] = { $exists: true };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid filter type",
        });
    }

    const customers = await Customer.find(query)
      .select("customerId mobile name")
      .limit(Number(limit))
      .lean();

    // Extract just mobile numbers and customer info
    const mobileList = customers.map((customer) => ({
      customerId: customer.customerId,
      mobile: customer.mobile,
      name: customer.name || "Customer",
    }));

    res.status(200).json({
      success: true,
      count: mobileList.length,
      mobiles: mobileList,
    });
  } catch (error: any) {
    console.error("Error fetching mobile numbers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching mobile numbers",
      error: error.message,
    });
  }
};
