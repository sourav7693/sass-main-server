import mongoose, { Document, Schema, Model } from "mongoose";

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
}

export enum MediaStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DRAFT = "draft",
  DELETED = "deleted",
}

export interface IImageData {
  imageName: string; 
  secureUrl: string;     
  publicId: string;         
}

export interface IVideoData {
  videoName: string;   
  thumbnailName: string;    
  thumbnailUrl: string; 
  thumbnailPublicId: string;    
  videoUrl: string;         
}


export interface IMedia extends Document {
  type: MediaType;
  status: MediaStatus;
  image?: IImageData;
  video?: IVideoData;
  createdAt: Date;
  updatedAt: Date;
}


const ImageDataSchema = new Schema<IImageData>(
  {
    imageName: {
      type: String,
      required: true,
      trim: true,
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const VideoDataSchema = new Schema<IVideoData>(
  {
    videoName: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailName: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailPublicId: { type: String, required: true, trim: true },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);


const MediaSchema = new Schema<IMedia>(
  {
    type: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(MediaStatus),
      default: MediaStatus.ACTIVE,
    },
    image: {
      type: ImageDataSchema,
      required: function (this: IMedia) {
        return this.type === MediaType.IMAGE;
      },
      default: undefined,
    },

    video: {
      type: VideoDataSchema,
      required: function (this: IMedia) {
        return this.type === MediaType.VIDEO;
      },
      default: undefined,
    },
  },
  {
    timestamps: true, 
    versionKey: false,
  }
);

MediaSchema.pre("save", async function () {
  if (this.type === MediaType.IMAGE) {
    if (!this.image) {
      throw new Error("Image data is required when media type is 'image'.");
    }
    this.video = undefined;
  }
 
  if (this.type === MediaType.VIDEO) {
    if (!this.video) {
      throw new Error("Video data is required when media type is 'video'.");
    }
    this.image = undefined;
  }
});

MediaSchema.index({ type: 1 });
MediaSchema.index({ status: 1 });
MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ "image.publicId": 1 }, { sparse: true });



const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);

export default Media;