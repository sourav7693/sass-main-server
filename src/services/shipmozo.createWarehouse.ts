import type { PickupDoc } from "../models/Pickup";
import { shipmozoClient } from "./shipmozo.client";


export const createShipmozoWarehouse = async (pickup: PickupDoc) => {
  const payload = {
    address_title: pickup.name,
    name:"Pri Priya Nursury",
    address_line_one: pickup.address,
    address_line_two:pickup.address,
    pin_code: pickup.pin,
    city: "Kolkata",          // 🔧 later make dynamic
    state: "West Bengal",     // 🔧 later make dynamic
    phone: pickup.mobile,
    email:"pripriyanursury@gmail.com",

  };

  const { data } = await shipmozoClient.post("/create-warehouse", payload);
  console.log("warehouse id", data)

  if (data.result !== "1") {
    throw new Error(`Create warehouse failed: ${data.message}`);
  }

  return String(data.data.warehouse_id); // warehouse_id
};
