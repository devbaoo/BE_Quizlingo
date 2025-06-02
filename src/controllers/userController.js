import userService from "../services/userService.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinaryService from "../services/cloudinaryService.js";
import { v2 as cloudinary } from "cloudinary";

// Cấu hình Cloudinary storage cho multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

// Cấu hình multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Middleware xử lý upload avatar
const handleAvatarUpload = (req, res, next) => {
  const avatarUpload = upload.single("avatar");

  console.log("Avatar route hit, applying multer with Cloudinary");
  avatarUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      console.error("Unknown error:", err);
      return res.status(500).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }
    console.log("Cloudinary upload processed successfully, file:", req.file);
    // No error, continue to controller
    next();
  });
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const result = await userService.getUserProfile(req.user.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const result = await userService.updateUserProfile(req.user.id, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Upload avatar
let uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please upload a file.",
      });
    }

    // Lấy thông tin file từ Cloudinary
    const file = req.file;
    console.log("File uploaded to Cloudinary:", file);

    // Thông tin file đã được upload lên Cloudinary
    const imageUrl = file.path || file.secure_url;
    const imageId = file.filename || file.public_id;

    // Cập nhật profile với URL từ Cloudinary
    const updateResult = await userService.updateUserProfile(req.user.id, {
      avatar: imageUrl,
    });
    console.log("Update result:", updateResult);

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      user: updateResult.user,
      imageDetails: {
        imageUrl: imageUrl,
        imageId: imageId,
      },
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await userService.getAllUsers();
    return res.status(result.statusCode).json({
      success: result.success,
      count: result.count,
      users: result.users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const result = await userService.softDeleteUser(req.params.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Chọn Knowledge Level
const chooseLevel = async (req, res) => {
  try {
    const { level } = req.body;
    const result = await userService.chooseLevel(req.user.id, level);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Choose level error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Chọn skill ưu tiên
const chooseSkill = async (req, res) => {
  try {
    const { skills } = req.body;
    const result = await userService.chooseSkill(req.user.id, skills);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Choose skill error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const chooseTopic = async (req, res) => {
  try {
    const { topics } = req.body;
    const result = await userService.chooseTopic(req.user.id, topics);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Choose topic error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getUserLivesStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userService.getUserLivesStatus(userId);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data || null,
    });
  } catch (error) {
    console.error("GetUserLivesStatus controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: "UserId và role là bắt buộc",
      });
    }

    const result = await userService.updateUserRole(userId, role);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Update user role error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

const paymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userService.paymentHistory(userId);
    return res.status(result.statusCode).json(result);
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export default {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  getAllUsers,
  deleteUser,
  chooseLevel,
  chooseSkill,
  chooseTopic,
  handleAvatarUpload,
  getUserLivesStatus,
  updateUserRole,
  paymentHistory,
};
