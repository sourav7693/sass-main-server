import { shipmozoClient } from "./shipmozo.client";


export const getShipmozoWarehouses = async () => {
  const { data } = await shipmozoClient.get("/get-warehouses");

  if (data.result !== "1") {
    throw new Error("Failed to fetch Shipmozo warehouses");
  }

  return data.data as Array<{
    id: number;
    address_title: string;
    pin_code: string;
  }>;
};
