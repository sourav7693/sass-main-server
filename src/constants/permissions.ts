export const PERMISSIONS = {
  PRODUCTS: "products",
  CUSTOMERS: "customers",
  CATEGORY: "category",
  ORDERS: "orders",
  USERS: "users",
  COUPON: "coupon",
  BRAND: "brand",
  BULK_MARKETING: "bulk_marketing",
  PICKUP: "pickup",  
  ATTRIBUTES: "attributes",
  VARIABLES: "variables",
  SLIDER: "slider",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
