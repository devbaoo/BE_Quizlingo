import marxistPhilosophyService from "../services/marxistPhilosophyService.js";

/**
 * Tạo bài học triết học Mác-LêNin mới
 * POST /api/marxist-philosophy/generate-lesson
 */
const generateLesson = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const { topic, difficulty } = req.body;

    const result = await marxistPhilosophyService.generateMarxistLesson(
      userId,
      {
        topic,
        difficulty: difficulty ? parseInt(difficulty) : undefined,
      }
    );

    // Debug log để kiểm tra response
    console.log("📝 Controller result:", {
      success: result.success,
      statusCode: result.statusCode,
      message: result.message,
      hasLesson: !!result.lesson,
      hasLearningPath: !!result.learningPath,
    });

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Generate Marxist lesson error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Lỗi server khi tạo bài học",
      error: "CONTROLLER_ERROR",
      details: error.message,
    });
  }
};

/**
 * Lấy lộ trình học triết học Mác-LêNin
 * GET /api/marxist-philosophy/learning-path
 */
const getLearningPath = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const { page, limit } = req.query;

    const result = await marxistPhilosophyService.getMarxistLearningPath(
      userId,
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
      }
    );

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get Marxist learning path error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lộ trình học",
    });
  }
};

/**
 * Hoàn thành bài học triết học Mác-LêNin
 * POST /api/marxist-philosophy/complete-lesson
 */
const completeLesson = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const { lessonId, score, questionResults } = req.body;

    if (!lessonId || typeof score !== "number") {
      return res.status(400).json({
        success: false,
        message: "lessonId và score là bắt buộc",
      });
    }

    if (score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: "Điểm số phải từ 0 đến 100",
      });
    }

    // questionResults là optional, default = []
    const validQuestionResults = Array.isArray(questionResults)
      ? questionResults
      : [];

    const result = await marxistPhilosophyService.completeMarxistLesson(
      userId,
      lessonId,
      score,
      validQuestionResults
    );

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Complete Marxist lesson error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi hoàn thành bài học",
    });
  }
};

/**
 * Lấy thống kê học tập triết học Mác-LêNin
 * GET /api/marxist-philosophy/stats
 */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const result = await marxistPhilosophyService.getMarxistStats(userId);

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Get Marxist stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê",
    });
  }
};

/**
 * Lấy danh sách chủ đề triết học Mác-LêNin
 * GET /api/marxist-philosophy/topics
 */
const getTopics = async (req, res, next) => {
  try {
    const topics = await marxistPhilosophyService.getAllMarxistTopics();

    const formattedTopics = topics.map((topic) => ({
      id: topic._id,
      name: topic.name,
      title: topic.title,
      description: topic.description,
      keywords: topic.keywords,
      suggestedDifficulty: topic.suggestedDifficulty,
      suggestedQuestionCount: topic.suggestedQuestionCount,
      displayOrder: topic.displayOrder,
      totalLessonsGenerated: topic.totalLessonsGenerated,
      averageScore: topic.averageScore,
      createdAt: topic.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách chủ đề thành công",
      topics: formattedTopics,
    });
  } catch (error) {
    console.error("Get Marxist topics error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách chủ đề",
    });
  }
};

/**
 * Phân tích tiến độ học tập và đề xuất bài học tiếp theo
 * GET /api/marxist-philosophy/analyze-progress
 */
const analyzeProgress = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const analysis = await marxistPhilosophyService.analyzeUserProgress(userId);

    return res.status(200).json({
      success: true,
      message: "Phân tích tiến độ thành công",
      analysis,
    });
  } catch (error) {
    console.error("Analyze Marxist progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi phân tích tiến độ",
    });
  }
};

/**
 * Lấy lesson theo learning path của user
 * GET /api/marxist-philosophy/lessons/:pathId
 */
const getLessonByPath = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { pathId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    if (!pathId) {
      return res.status(400).json({
        success: false,
        message: "pathId là bắt buộc",
      });
    }

    // Import models
    const { default: MarxistLearningPath } = await import(
      "../models/marxistLearningPath.js"
    );
    const { default: Lesson } = await import("../models/lesson.js");

    // Tìm path của user
    const pathDoc = await MarxistLearningPath.findOne({
      _id: pathId,
      userId,
    })
      .populate("marxistTopic")
      .populate("lessonId");

    if (!pathDoc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy learning path",
      });
    }

    // Lấy chi tiết lesson với questions - OPTIMIZED for performance
    const lesson = await Lesson.findById(pathDoc.lessonId)
      .populate({
        path: "questions",
        select: "_id content options correctAnswer score timeLimit type", // Only select needed fields
      })
      .populate("topic", "_id name description") // Only select needed topic fields
      .populate("level", "_id name description minScoreRequired timeLimit") // Only select needed level fields
      .populate("skills", "_id name description") // Only select needed skill fields
      .lean(); // Use lean() for better performance - returns plain JS objects

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài học",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy lesson thành công",
      lesson: {
        id: lesson._id,
        title: lesson.title,
        topic: lesson.topic,
        level: lesson.level,
        skills: lesson.skills,
        maxScore: lesson.maxScore,
        questions: lesson.questions,
        createdAt: lesson.createdAt,
      },
      learningPath: {
        pathId: pathDoc._id,
        marxistTopic: {
          id: pathDoc.marxistTopic._id,
          name: pathDoc.marxistTopic.name,
          title: pathDoc.marxistTopic.title,
        },
        difficultyLevel: pathDoc.difficultyLevel,
        order: pathDoc.order,
        recommendedReason: pathDoc.recommendedReason,
      },
    });
  } catch (error) {
    console.error("Get lesson by path error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lesson",
    });
  }
};

/**
 * Test Gemini API connection
 * GET /api/marxist-philosophy/test-gemini
 */

/**
 * Làm lại bài học triết học Mác-LêNin
 * POST /api/marxist-philosophy/retry-lesson
 */
const retryMarxistLesson = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu đăng nhập",
      });
    }

    const { lessonId, pathId } = req.body;

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: "lessonId là bắt buộc",
      });
    }

    const result = await marxistPhilosophyService.retryMarxistLesson(
      userId,
      lessonId,
      pathId
    );

    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Retry Marxist lesson error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi làm lại bài học",
    });
  }
};

// Test Gemini connection with real Marxist question

export default {
  generateLesson,
  getLearningPath,
  getLessonByPath,
  completeLesson,
  retryMarxistLesson,
  getStats,
  getTopics,
  analyzeProgress,
};
