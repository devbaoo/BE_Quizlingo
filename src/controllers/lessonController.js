import lessonService from "../services/lessonService.js";

const createLesson = async (req, res) => {
  try {
    const result = await lessonService.createLesson(req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      lesson: result.lesson,
    });
  } catch (error) {
    console.error("Create lesson error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getLessons = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const result = await lessonService.getLessons(userId, req.query);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      topics: result.topics,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get lessons error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getLessonById = async (req, res) => {
  try {
    const result = await lessonService.getLessonById(req.params.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      lesson: result.lesson,
    });
  } catch (error) {
    console.error("Get lesson by ID error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const completeLesson = async (req, res) => {
  try {
    const { lessonId, score, questionResults, isRetried } = req.body;
    const userId = req.user?.id || req.user?._id?.toString();

    console.log(`Controller: userId=${userId}, lessonId=${lessonId}`);

    if (!userId) {
      console.error("Controller: No userId found in req.user");
      return res.status(401).json({
        success: false,
        message: "Không thể xác thực người dùng, vui lòng đăng nhập lại",
      });
    }

    const result = await lessonService.completeLesson(
      userId,
      lessonId,
      score,
      questionResults,
      isRetried
    );
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      status: result.status,
      progress: result.progress,
      user: result.user,
    });
  } catch (error) {
    console.error("Complete lesson error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const retryLesson = async (req, res) => {
  try {
    const { lessonId } = req.body;
    const userId = req.user?.id || req.user?._id?.toString();

    if (!userId) {
      console.error("Controller: No userId found in req.user");
      return res.status(401).json({
        success: false,
        message: "Không thể xác thực người dùng, vui lòng đăng nhập lại",
      });
    }

    const result = await lessonService.retryLesson(userId, lessonId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      lives: result.lives,
    });
  } catch (error) {
    console.error("Retry lesson error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getTopics = async (req, res) => {
  try {
    const result = await lessonService.getTopics();
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      topics: result.topics,
    });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getSkills = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { topic, level } = req.query;
    const result = await lessonService.getSkills(userId, topic, level);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      skills: result.skills,
    });
  } catch (error) {
    console.error("Get skills error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAllLessons = async (req, res) => {
  try {
    const result = await lessonService.getAllLessonsForAdmin(req.query);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Get all lessons error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteLesson = async (req, res) => {
  try {
    const result = await lessonService.deleteLesson(req.params.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete lesson error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateLesson = async (req, res) => {
  try {
    const result = await lessonService.updateLesson(req.params.id, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      lesson: result.lesson,
    });
  } catch (error) {
    console.error("Update lesson error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export default {
  createLesson,
  getLessons,
  getLessonById,
  completeLesson,
  retryLesson,
  getTopics,
  getSkills,
  getAllLessons,
  deleteLesson,
  updateLesson,
};
