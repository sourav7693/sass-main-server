import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import Media, { MediaType, MediaStatus } from "../models/Media";
import { uploadFile, deleteFile } from "../utils/cloudinaryService";


export const createMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, videoName, videoUrl, imageName } = req.body;

    if (type === MediaType.IMAGE) {
      if (!req.files?.file) {
        res.status(400).json({ success: false, message: "Image file is required." });
        return;
      }
      const file = req.files.file as UploadedFile;
      const uploaded = await uploadFile(file.tempFilePath, file.mimetype);
      if (uploaded instanceof Error) throw uploaded;

      const media = await Media.create({
        type: MediaType.IMAGE,
        status: status || MediaStatus.ACTIVE,
        image: {
          imageName: imageName||file.name,
          secureUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
        },
      });
      res.status(201).json({ success: true, data: media });
    } 
    
    else if (type === MediaType.VIDEO) {
      if (!req.files?.thumbnail || !videoUrl || !videoName) {
        res.status(400).json({ success: false, message: "Video name, URL, and thumbnail are required." });
        return;
      }
      const thumb = req.files.thumbnail as UploadedFile;
      const uploadedThumb = await uploadFile(thumb.tempFilePath, thumb.mimetype);
      if (uploadedThumb instanceof Error) throw uploadedThumb;

      const media = await Media.create({
        type: MediaType.VIDEO,
        status: status || MediaStatus.ACTIVE,
        video: {
          videoName,
          videoUrl,
          thumbnailName: thumb.name,
          thumbnailUrl: uploadedThumb.secure_url,
          thumbnailPublicId: uploadedThumb.public_id,
        },
      });
      res.status(201).json({ success: true, data: media });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, page = "1", limit = "10" } = req.query;

    const filter: Record<string, any> = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const pageNum  = Math.max(1, parseInt(page as string));
    const limitNum = Math.max(1, parseInt(limit as string));
    const skip     = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Media.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const updateMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, videoName, videoUrl, imageName } = req.body;
    const existing = await Media.findById(id);

    if (!existing) {
      res.status(404).json({ success: false, message: "Media not found." });
      return;
    }

    if (status) existing.status = status;

    if (existing.type === MediaType.IMAGE) {
      if (imageName && existing.image) {
        existing.image.imageName = imageName;
      }

      if (req.files?.file) {
        if (existing.image?.publicId) await deleteFile(existing.image.publicId);
        
        const file = req.files.file as UploadedFile;
        const uploaded = await uploadFile(file.tempFilePath, file.mimetype);
        if (uploaded instanceof Error) throw uploaded;

        existing.image = {
          imageName: imageName || file.name, 
          secureUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
        };
      }
    }

    if (existing.type === MediaType.VIDEO && existing.video) {
      existing.video.videoName = videoName || existing.video.videoName;
      existing.video.videoUrl = videoUrl || existing.video.videoUrl;

      if (req.files?.thumbnail) {
        if (existing.video.thumbnailPublicId) await deleteFile(existing.video.thumbnailPublicId);

        const thumb = req.files.thumbnail as UploadedFile;
        const uploadedThumb = await uploadFile(thumb.tempFilePath, thumb.mimetype);
        if (uploadedThumb instanceof Error) throw uploadedThumb;

        existing.video.thumbnailName = thumb.name;
        existing.video.thumbnailUrl = uploadedThumb.secure_url;
        existing.video.thumbnailPublicId = uploadedThumb.public_id;
      }
    }

    await existing.save();
    res.status(200).json({ success: true, data: existing });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      res.status(404).json({ success: false, message: "Media not found." });
      return;
    }

    if (media.type === MediaType.IMAGE && media.image?.publicId) {
      await deleteFile(media.image.publicId);
    } else if (media.type === MediaType.VIDEO && media.video?.thumbnailPublicId) {
      await deleteFile(media.video.thumbnailPublicId);
    }

    await Media.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Media deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};