import type { CustomerDoc } from "../models/Customer";
import type { OrderDoc } from "../models/Order";
import { Pickup, type PickupDoc } from "../models/Pickup";
import type { ProductDoc } from "../models/Product";
import { shipmozoClient } from "./shipmozo.client";

export interface OrderPopulatedDoc extends Omit<
  OrderDoc,
  "customer" | "address" | "items"
> {
  customer: CustomerDoc;
  address: any;
  items: Array<{
    product: ProductDoc & {
      pickup: PickupDoc;
    };
    quantity: number;
  }>;
}

export const pushOrderToShipmozo = async (
  order: any,
  address: {
    mobile: string;
    area: string;
    city: string;
    state: string;
    pin: string;
    landmark?: string;
    name?: string;
  },
) => {
  /* ✅ PRODUCT IS DIRECTLY ON ORDER */
  const product = order.product;

  if (!product) {
    throw new Error("Order product missing");
  }

  /* ✅ PICKUP FROM PRODUCT */
  const pickup = await Pickup.findById(product.pickup);

  if (!pickup?.shipmozoWarehouseId) {
    throw new Error("Shipmozo warehouse ID missing in pickup");
  }

  const payload = {
    order_id: order.orderId,
    order_date: new Date().toISOString().split("T")[0],

    consignee_name: address.name ?? order.customer.name,
    consignee_phone: address.mobile,
    consignee_address_line_one: `${address.area}${
      address.landmark ? ", " + address.landmark : ""
    }`,
    consignee_pin_code: Number(address.pin),
    consignee_city: address.city,
    consignee_state: address.state,

    /* ✅ SINGLE PRODUCT */
    product_detail: [
      {
        name: product.name,
        quantity: order.quantity,
        unit_price: product.price,
        product_category: "Other",
        discount: product.discount ?? 0,
        hsn: product.productId,
      },
    ],

    payment_type: order.paymentStatus === "Paid" ? "PREPAID" : "COD",
    cod_amount: order.paymentStatus === "Paid" ? "" : order.orderValue,

    weight: product.weight,
    length: product.dimensions[0].length,
    width: product.dimensions[0].width,
    height: product.dimensions[0].height,

    warehouse_id: pickup.shipmozoWarehouseId,
  };

  const { data } = await shipmozoClient.post("/push-order", payload);

  console.log("🚚 Shipmozo push-order:", data);

  if (data.result !== "1") {
    throw new Error(data.data.error);
  }

  return data.data;
};
