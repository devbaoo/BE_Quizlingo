import checkInService from "../services/checkInService.js";

/**
 * Handle daily check-in
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const dailyCheckIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await checkInService.processDailyCheckIn(userId);

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Daily check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý điểm danh",
    });
  }
};

/**
 * Get user check-in status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const getCheckInStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await checkInService.getCheckInStatus(userId);

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get check-in status error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin điểm danh",
    });
  }
};

export default {
  dailyCheckIn,
  getCheckInStatus,
};
