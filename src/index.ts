import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./lib/db.js";
import type { Request, Response } from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import cors from "cors";

import categoryRoutes from "./routes/category.routes.js";
import variableRoutes from "./routes/variable.routes.js";
import brandRoutes from "./routes/brand.routes.js";
import pickupRoutes from "./routes/pickup.routes.js";
import attributeRoutes from "./routes/attribute.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import productRoutes from "./routes/product.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import sliderRoutes from "./routes/slider.routes.js";

const PORT = process.env.LOCAL_PORT || 5000;
dotenv.config();

connectDB();

const app = express();
app.use(cors())

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

