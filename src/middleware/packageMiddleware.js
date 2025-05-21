import UserPackage from "../models/userPackage.js";
import moment from "moment-timezone";

// Kiểm tra package đang active của user
const checkActivePackage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = moment().tz("Asia/Ho_Chi_Minh");

    // Tìm package đang active và chưa hết hạn
    const activePackage = await UserPackage.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: now.toDate() },
      paymentStatus: "completed",
    }).populate("package");

    // Thêm thông tin package vào request để sử dụng ở các middleware/controller tiếp theo
    req.userPackage = activePackage
      ? {
          ...activePackage.package.toObject(),
          startDate: activePackage.startDate,
          endDate: activePackage.endDate,
          daysRemaining: moment(activePackage.endDate).diff(now, "days"),
        }
      : null;

    next();
  } catch (error) {
    console.error("Check active package error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra gói của người dùng",
      error: error.message,
    });
  }
};

// Kiểm tra quyền truy cập tính năng premium
const checkPremiumFeature = (feature) => {
  return (req, res, next) => {
    try {
      if (!req.userPackage) {
        return res.status(403).json({
          success: false,
          message: "Bạn cần nâng cấp gói để sử dụng tính năng này",
        });
      }

      // Kiểm tra tính năng cụ thể
      if (!req.userPackage.features[feature]) {
        return res.status(403).json({
          success: false,
          message: "Gói của bạn không bao gồm tính năng này",
        });
      }

      next();
    } catch (error) {
      console.error("Check premium feature error:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi kiểm tra quyền truy cập",
        error: error.message,
      });
    }
  };
};

// Middleware để tính toán XP dựa trên package
const calculateXP = (baseXP) => {
  return (req, res, next) => {
    try {
      let finalXP = baseXP;

      // Nếu user có package và có tính năng doubleXP
      if (req.userPackage?.features.doubleXP) {
        finalXP *= 2;
      }

      // Thêm XP vào request để sử dụng ở controller
      req.calculatedXP = finalXP;
      next();
    } catch (error) {
      console.error("Calculate XP error:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi tính toán XP",
        error: error.message,
      });
    }
  };
};

// Middleware để xử lý lives dựa trên package
const handleLives = (req, res, next) => {
  try {
    // Nếu user có package và có tính năng unlimitedLives
    if (req.userPackage?.features.unlimitedLives) {
      // Không trừ lives khi retry
      req.skipLivesDeduction = true;
    }

    next();
  } catch (error) {
    console.error("Handle lives error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xử lý lives",
      error: error.message,
    });
  }
};

export default {
  checkActivePackage,
  checkPremiumFeature,
  calculateXP,
  handleLives,
};
