import surveyService from "../services/surveyService.js";

/**
 * Update the main survey (admin/staff only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const updateMainSurvey = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await surveyService.updateMainSurvey(req.body, userId);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Update main survey controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật khảo sát",
    });
  }
};

/**
 * Get the active survey
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const getActiveSurvey = async (req, res) => {
  try {
    const result = await surveyService.getActiveSurvey();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get active survey controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin khảo sát",
    });
  }
};

/**
 * Get all survey versions (admin/staff only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const getAllSurveyVersions = async (req, res) => {
  try {
    const result = await surveyService.getAllSurveyVersions();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get all survey versions controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy tất cả phiên bản khảo sát",
    });
  }
};

/**
 * Check if user has completed the current survey
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const checkUserSurveyCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await surveyService.checkUserSurveyCompletion(userId);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Check user survey completion controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi kiểm tra hoàn thành khảo sát",
    });
  }
};

/**
 * Submit survey response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const submitSurveyResponse = async (req, res) => {
  try {
    const { answers } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Câu trả lời phải là một mảng",
      });
    }

    const result = await surveyService.submitSurveyResponse(answers, userId);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Submit survey response controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi câu trả lời khảo sát",
    });
  }
};

/**
 * Get survey statistics (admin/staff only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
const getSurveyStatistics = async (req, res) => {
  try {
    const { version } = req.query;
    const result = await surveyService.getSurveyStatistics(
      version ? parseInt(version) : null
    );
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get survey statistics controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê khảo sát",
    });
  }
};

export default {
  updateMainSurvey,
  getActiveSurvey,
  getAllSurveyVersions,
  checkUserSurveyCompletion,
  submitSurveyResponse,
  getSurveyStatistics,
};
