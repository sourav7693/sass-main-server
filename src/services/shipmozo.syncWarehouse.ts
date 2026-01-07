import { Pickup } from "../models/Pickup.ts";
import { createShipmozoWarehouse } from "./shipmozo.createWarehouse.ts";
import { getShipmozoWarehouses } from "./shipmozo.getWarehouses.ts";


export const getOrCreateWarehouseId = async (pickupId: string) => {
  const pickup = await Pickup.findById(pickupId);

  if (!pickup) {
    throw new Error("Pickup not found");
  }

  // ✅ Already synced
  if (pickup.shipmozoWarehouseId) {
    return pickup.shipmozoWarehouseId;
  }

  // 🔍 Check existing Shipmozo warehouses
  const warehouses = await getShipmozoWarehouses();

  const matched = warehouses.find(
    (w) => w.pin_code === pickup.pin
  );

  if (matched) {
    pickup.shipmozoWarehouseId = String(matched.id);
    await pickup.save();
    return pickup.shipmozoWarehouseId;
  }

  // ➕ Create new warehouse
  const newWarehouseId = await createShipmozoWarehouse(pickup);

  pickup.shipmozoWarehouseId = newWarehouseId;
  await pickup.save();

  return newWarehouseId;
};
