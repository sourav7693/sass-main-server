import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    mongoose.set("strictPopulate", false);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error instanceof Error ? error.message : "MongoDB connection failed:",
    );
    process.exit(1);
  }
};
