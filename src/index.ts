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
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/category", categoryRoutes);
app.use("/api/variable", variableRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Server running with TypeScript + Express!");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// [
//   {
//     name: "Mobiles",
//     children: [{ name: "Smartphones" }, { name: "Feature Phones" }],
//   },
//   {
//     name: "Laptops",
//     children: [{ name: "Gaming Laptops" }, { name: "Business Laptops" }],
//   },
// ];

