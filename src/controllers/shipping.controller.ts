import type { Request, Response } from "express";
import { Product } from "../models/Product.ts";
import { rateCalculator, type RateCalculatorPayload } from "../services/shipmozo.service.ts";


type RateCalculatorRequest = {
  productId: string;
  deliveryPincode: string;
  paymentType?: "PREPAID" | "COD";
};

export const calculateRate = async (
  req: Request<{}, {}, RateCalculatorRequest>,
  res: Response
): Promise<void> => {
  try {
    const { productId, deliveryPincode, paymentType = "PREPAID" } = req.body;

    if (!productId || !deliveryPincode) {
      res.status(400).json({
        result: "0",
        message: "productId and deliveryPincode required",
      });
      return;
    }

    const product = (await Product.findOne({
      productId,
    }).populate("pickup").lean()) as any;

    if (!product) {
      res.status(404).json({ result: "0", message: "Product not found" });
      return;
    }

    const payload: RateCalculatorPayload = {
      order_id: "",
      pickup_pincode: Number(product.pickup.pin),
      delivery_pincode: Number(deliveryPincode),
      payment_type: paymentType,
      shipment_type: "FORWARD",
      order_amount: product.price,
      type_of_package: "SPS",
      rov_type: "ROV_OWNER",
      cod_amount: paymentType === "COD" ? product.price : "",
      weight: 500,
      dimensions: [
        {
          no_of_box: "1",
           "length": "22", 
      "width": "10", 
      "height": "10" 
        },
      ],
    };



    const data = await rateCalculator(payload);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      result: "0",
      message: "Rate calculation failed",
    });
  }
};
