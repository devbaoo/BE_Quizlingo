import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number, // Số ngày sử dụng
      required: true,
      min: 1,
    },
    features: {
      doubleXP: {
        type: Boolean,
        default: false,
      },
      unlimitedLives: {
        type: Boolean,
        default: false,
      },
      noAds: {
        type: Boolean,
        default: false,
      },
      customAvatar: {
        type: Boolean,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100, // Phần trăm giảm giá
    },
    discountEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Package = mongoose.model("Package", packageSchema);

export default Package;
