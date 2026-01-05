import axios from "axios";

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


const shipmozoClient = axios.create({
  baseURL: "https://shipping-api.com/app/api/v1",
  headers: {
    "Content-Type": "application/json",
    "public-key": process.env.SHIPMOZO_PUBLIC_KEY,
    "private-key": process.env.SHIPMOZO_PRIVATE_KEY,
  },
});

export const rateCalculator = async (
  payload: RateCalculatorPayload
): Promise<ShipmozoResponse> => {
  const { data } = await shipmozoClient.post("/rate-calculator", payload);
  return data;
};
