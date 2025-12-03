import express from "express";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import categoryRoutes from "./routes/category.routes.js";
import { connectDB } from "./lib/db.js";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
const PORT = process.env.PORT || 8000;
dotenv.config();

connectDB();

const app = express();

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

