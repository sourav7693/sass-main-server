import type { OrderDoc } from "../models/Order.js";
import { shipmozoClient } from "./shipmozo.client.js";


export const schedulePickup = async (order: OrderDoc) => {
  const { data } = await shipmozoClient.post("/schedule-pickup", {
    order_id: order.orderId,
  });

//   console.log("sehedule Pickup", data)
//   console.log("sehedule Pickup order id", order.orderId)


  if (data.result !== "1") {
    throw new Error("Pickup scheduling failed");
  }

  return data.data; // { awb_number, courier }
};
