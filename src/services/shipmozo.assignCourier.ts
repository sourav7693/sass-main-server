import type { OrderDoc } from "../models/Order";
import { shipmozoClient } from "./shipmozo.client";


export const assignCourier = async (order: OrderDoc) => {
  if (!order.shipping?.courierId) {
    throw new Error("Courier ID missing");
  }

  const { data } = await shipmozoClient.post("/assign-courier", {
    order_id: order.shipping.shipmozoOrderId,
    courier_id: order.shipping.courierId,
  });

//   console.log("assign courier Data", data)
//   console.log("orderid", order.shipping.shipmozoOrderId, order.shipping.courierId)

  if (data.result !== "1") {
    throw new Error("Assign courier failed");
  }

  return data.data; // { courier, reference_id }
};
