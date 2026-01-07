import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./lib/db.ts";
import type { Request, Response } from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";

import categoryRoutes from "./routes/category.routes.ts";
import variableRoutes from "./routes/variable.routes.ts";
import brandRoutes from "./routes/brand.routes.ts";
import pickupRoutes from "./routes/pickup.routes.ts";
import attributeRoutes from "./routes/attribute.routes.ts";
import couponRoutes from "./routes/coupon.routes.ts";
import productRoutes from "./routes/product.routes.ts";
import customerRoutes from "./routes/customer.routes.ts";
import sliderRoutes from "./routes/slider.routes.ts";
import userRoutes from "./routes/user.routes.ts";
import communicationProviderRoute from "./routes/communicationProvider.routes.ts"
import orderRoutes from "./routes/order.routes.ts";
import searchRoute from "./routes/search.route.ts"
import shippingRoute from "./routes/shipping.routes.ts"
import shipmozoRoute from "./routes/shipmozo.route.ts"

import dashboardRoute from "./routes/dashboard.routes.ts"

const PORT = process.env.LOCAL_PORT || 5000;
dotenv.config();

connectDB();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
const tempDir = path.join(import.meta.dirname, "temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/temp/",
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/category", categoryRoutes);
app.use("/api/variable", variableRoutes);
app.use("/api/brand", brandRoutes);
app.use("/api/pickup", pickupRoutes);
app.use("/api/attribute", attributeRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/product", productRoutes);
app.use("/api/customer", customerRoutes)
app.use("/api/slider", sliderRoutes);
app.use("/api/user", userRoutes);
app.use("/api/communication-provider", communicationProviderRoute )
app.use("/api/order", orderRoutes);
app.use("/api/search", searchRoute);
app.use("/api/shipping", shippingRoute);
app.use("/api/webhooks", shipmozoRoute);

app.use("/api/dashboard", dashboardRoute)



app.get("/", (req: Request, res: Response) => {
  res.send("Server running with TypeScript + Express!");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// [
//   {
//     "name": "Mobiles",
//     "children": [{ "name": "Smartphones", "type": "SubSub" }, { "name": "Feature Phones", "type": "SubSub" }],
// "type": "Sub"
//   },
//   {
//     "name": "Laptops",
//     "children": [{ "name": "Gaming Laptops", "type": "SubSub" }, { "name": "Business Laptops", "type": "SubSub" }],
//     "type": "Sub"
//   },
// ];

