import type { CustomerDoc } from "../models/Customer.ts";
import type { OrderDoc } from "../models/Order.ts";
import { Pickup, type PickupDoc } from "../models/Pickup.ts";
import type { ProductDoc } from "../models/Product.ts";
import { shipmozoClient } from "./shipmozo.client.ts";

export interface OrderPopulatedDoc
  extends Omit<OrderDoc, "customer" | "address" | "items"> {
  customer: CustomerDoc;
  address: any;
  items: Array<{
    product: ProductDoc & {
      pickup: PickupDoc;
    };
    quantity: number;
  }>;
}


export const pushOrderToShipmozo = async (order: any,  address: {
    mobile: string;
    area: string;
    city: string;
    state: string;
    pin: string;
    landmark?: string;
  }) => {
      const firstItem: any = order.items[0];
  const product = firstItem.product;
  const pickupId = product.pickup;

 const pickup = await Pickup.findById(pickupId);

     if (!pickupId) {
    throw new Error("Pickup location missing in product");
  }




  const payload = {
    order_id: order.orderId,
    order_date: new Date().toISOString().split("T")[0],
    consignee_name: order.customer.name,
     consignee_phone: address.mobile,
    consignee_address_line_one: `${address.area}, ${address.landmark ?? ""}`,
    consignee_pin_code: Number(address.pin),
    consignee_city: address.city,
    consignee_state: address.state,

    product_detail: order.items.map((item: any) => ({
      name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
      product_category: "Other",
      discount:product.discount,
      hsn:product.productId

    })),

    payment_type: order.paymentMethod === "COD" ? "COD" : "PREPAID",
    cod_amount: order.paymentMethod === "COD" ? order.orderValue : "",
    weight: 500,
    length: 10,
    width: 10,
    height: 10,
    warehouse_id:pickup?.shipmozoWarehouseId,
  };

  const { data } = await shipmozoClient.post("/push-order", payload);


  if (data.result !== "1") {
    throw new Error("Shipmozo push-order failed");
  }

  return data.data; // { order_id, reference_id }
};
