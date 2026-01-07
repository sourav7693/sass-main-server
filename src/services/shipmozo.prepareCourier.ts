import { assignCourier } from "./shipmozo.assignCourier";
import { rateCalculator } from "./shipmozo.service";

/* ===============================
   RATE CALCULATOR REQUEST PAYLOAD
================================= */
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

/* ===============================
   RATE CALCULATOR RESPONSE COURIER
================================= */
export type RateCourier = {
  id: number;
  name: string;
  image: string;
  estimated_delivery: string;
  shipping_charges: number;
  before_tax_total_charges: number;
  gst: number;
  total_charges: number;
  minimum_chargeable_weight: string;
  pickups_automatically_scheduled: "YES" | "NO";
};

/* ===============================
   SHIPMOZO GENERIC RESPONSE
================================= */
export type ShipmozoResponse<T = unknown> = {
  result: "1" | "0";
  message: string;
  data: T;
};

/* ===============================
   SELECT CHEAPEST COURIER
================================= */
export const selectCheapestCourier = (couriers: RateCourier[]): RateCourier => {
  if (!couriers || couriers.length === 0) {
    throw new Error("No couriers available from rate calculator");
  }

  return couriers.reduce((prev, curr) =>
    curr.total_charges < prev.total_charges ? curr : prev
  );
};

/* ===============================
   PREPARE COURIER FOR ORDER
================================= */
export const prepareCourierForOrder = async (
  order: any,
  address: { pin: string },
  pickupCode: string
) => {
  const payload: RateCalculatorPayload = {
    pickup_pincode: Number(pickupCode),
    delivery_pincode: Number(address.pin),
    payment_type: "PREPAID",
    shipment_type: "FORWARD",
    order_amount: order.orderValue,
    type_of_package: "SPS",
    rov_type: "ROV_OWNER",
    weight: 500,
    dimensions: [{ no_of_box: "1", length: "10", width: "10", height: "10" }],
  };

  const rateResponse = await rateCalculator(payload);

  if (rateResponse.result !== "1") {
    throw new Error(rateResponse.message);
  }

  // 🔽 LOW → HIGH price
  const couriers: RateCourier[] = rateResponse.data.sort(
    (a: RateCourier, b: RateCourier) => a.total_charges - b.total_charges
  );

//   console.log(
//     "🚚 Courier priority:",
//     couriers.map((c) => `${c.name} ₹${c.total_charges}`)
//   );

  for (const courier of couriers) {
    try {
      console.log(`🔄 Trying courier: ${courier.name}`);

      // Attach courier candidate
      order.shipping = {
        ...order.shipping,
        courierId: courier.id,
        courierName: courier.name,
        
      };

      const assignResponse = await assignCourier(order);

    //   console.log(`✅ Courier assigned: ${assignResponse.courier}`);

      return {
        courierId: courier.id,
        courierName: assignResponse.courier,
        referenceId: assignResponse.reference_id,
        estimatedDelivery: courier.estimated_delivery,
         awbNumber: assignResponse.awb_number,
        trackingUrl: `https://shipping-api.com/app/api/v1/track-order?awb_number=${assignResponse.awb_number}`,
      };
    } catch (err: any) {
      console.warn(`❌ Courier failed: ${courier.name} → ${err.message}`);
    }
  }

  throw new Error("No courier service available for this order");
};
