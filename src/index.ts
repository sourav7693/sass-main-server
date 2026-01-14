import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./lib/db";
import type { Request, Response } from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";

import categoryRoutes from "./routes/category.routes";
import variableRoutes from "./routes/variable.routes";
import brandRoutes from "./routes/brand.routes";
import pickupRoutes from "./routes/pickup.routes";
import attributeRoutes from "./routes/attribute.routes";
import couponRoutes from "./routes/coupon.routes";
import productRoutes from "./routes/product.routes";
import customerRoutes from "./routes/customer.routes";
import sliderRoutes from "./routes/slider.routes";
import userRoutes from "./routes/user.routes";
import communicationProviderRoute from "./routes/communicationProvider.routes"
import orderRoutes from "./routes/order.routes";
import searchRoute from "./routes/search.route"
import shippingRoute from "./routes/shipping.routes"
import shipmozoRoute from "./routes/shipmozo.route"

import dashboardRoute from "./routes/dashboard.routes"

const PORT = process.env.LOCAL_PORT || 5000;
dotenv.config();

connectDB();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "https://pripriyanursuryadminpanel.netlify.app", "https://pripriyanursery.com"],
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
    tempFileDir: "/tmp/",
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

