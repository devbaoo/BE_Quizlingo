import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
const path = await import("path");
const os = await import("os");

dotenv.config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload ảnh lên Cloudinary
 * @param {Object} file - File object từ multer
 * @returns {Promise<Object>} - Kết quả upload
 */
const uploadImage = async (file) => {
  try {
    console.log("Starting Cloudinary upload with file:", file.originalname);

    // Upload file lên Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        file.path,
        {
          resource_type: "image",
          folder: "avatars",
          use_filename: true,
          unique_filename: true,
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );
    });

    console.log("Cloudinary upload successful:", result.secure_url);

    return {
      success: true,
      statusCode: 200,
      message: "Tải ảnh lên thành công",
      imageUrl: result.secure_url,
      imageId: result.public_id,
      imageData: result,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tải ảnh lên Cloudinary",
      error: error.message,
    };
  }
};

const uploadAudioBuffer = async (buffer, filename = "speech.wav") => {
  try {
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
    await fs.promises.writeFile(tempPath, buffer);

    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video", // audio nằm trong "video" ở Cloudinary
      folder: "lesson_audio",
      use_filename: true,
    });

    // cleanup temp
    await fs.promises.unlink(tempPath);

    return {
      success: true,
      audioUrl: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Upload audio error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Xóa ảnh khỏi Cloudinary
 * @param {string} publicId - Public ID của ảnh
 * @returns {Promise<Object>} - Kết quả xóa
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok" || result.result === "not found") {
      return {
        success: true,
        message: "Xóa ảnh thành công",
        result,
      };
    } else {
      return {
        success: false,
        message: "Không thể xóa ảnh",
        result,
      };
    }
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      message: "Lỗi khi xóa ảnh",
      error: error.message,
    };
  }
};

export default {
  uploadImage,
  deleteImage,
  uploadAudioBuffer,
};
