import axios from "axios";
import { shipmozoClient } from "./shipmozo.client.js";
import type { RateCourier } from "./shipmozo.prepareCourier.js";

export type RateCalculatorPayload = {
  order_id?: string;
  pickup_pincode: number;
  delivery_pincode: number;
  payment_type: "PREPAID" | "COD";
  shipment_type: "FORWARD" | "RETURN";
  order_amount: number;
  type_of_package: "SPS";
  rov_type: "ROV_OWNER";
  cod_amount?: number | "";
  weight: number; // grams
  dimensions: {
    no_of_box: string;
    length: string;
    width: string;
    height: string;
  }[];
};

export type ShipmozoResponse<T = unknown> = {
  result: "1" | "0";
  message: string;
  data: T;
};




export const rateCalculator = async (
  payload: RateCalculatorPayload
): Promise<ShipmozoResponse<RateCourier[]>> => {
  const { data } = await shipmozoClient.post("/rate-calculator", payload);
  return data;
};