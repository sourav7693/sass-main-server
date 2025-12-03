import type { UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export interface UploadFileResult {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: string;
  [key: string]: unknown;
}

 
export const uploadFile = async (
  tempFilePath: string,
  fileType: string,
): Promise<UploadFileResult | Error> => {
  try {
    let folderName = "images";
    let format = "jpg";
    let resourceType: "image" | "video" | "raw" | "auto" = "image";

    if (fileType === "application/pdf") {
      folderName = "pdf";
      format = "pdf";
      resourceType = "raw";
    }


    const result: UploadFileResult = await cloudinary.uploader.upload(
      tempFilePath,
      {
        folder: `omconnecting/${folderName}`,
        resource_type: resourceType,
        format: format,
      }
    );

    await fs.unlink(tempFilePath);
    return result;
  } catch (error) {
    console.error("Error uploading file:", error);
    return new Error("File upload failed");
  }
};


export const deleteFile = async (
  publicId: string
): Promise<UploadApiResponse | Error> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting file:", error);
    return new Error("File deletion failed");
  }
};

export default cloudinary;