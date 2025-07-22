import marxistEconomicsService from '../services/marxistEconomicsService.js';

/**
 * Tạo bài học kinh tế chính trị Mác-Lê-Nin mới
 * POST /api/marxist-economics/generate-lesson
 */
const generateLesson = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const { topic, difficulty } = req.body;

        const result = await marxistEconomicsService.generateMarxistLesson(userId, {
            topic,
            difficulty: difficulty ? parseInt(difficulty) : undefined
        });

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Generate Marxist lesson error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo bài học'
        });
    }
};

/**
 * Lấy lộ trình học kinh tế chính trị Mác-Lê-Nin
 * GET /api/marxist-economics/learning-path
 */
const getLearningPath = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const { page, limit } = req.query;

        const result = await marxistEconomicsService.getMarxistLearningPath(userId, {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 10
        });

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Get Marxist learning path error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lộ trình học'
        });
    }
};

/**
 * Hoàn thành bài học kinh tế chính trị Mác-Lê-Nin
 * POST /api/marxist-economics/complete-lesson
 */
const completeLesson = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const { lessonId, score } = req.body;

        if (!lessonId || typeof score !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'lessonId và score là bắt buộc'
            });
        }

        if (score < 0 || score > 100) {
            return res.status(400).json({
                success: false,
                message: 'Điểm số phải từ 0 đến 100'
            });
        }

        const result = await marxistEconomicsService.completeMarxistLesson(userId, lessonId, score);

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Complete Marxist lesson error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi hoàn thành bài học'
        });
    }
};

/**
 * Lấy thống kê học tập kinh tế chính trị Mác-Lê-Nin
 * GET /api/marxist-economics/stats
 */
const getStats = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const result = await marxistEconomicsService.getMarxistStats(userId);

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Get Marxist stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê'
        });
    }
};

/**
 * Lấy danh sách chủ đề kinh tế chính trị Mác-Lê-Nin
 * GET /api/marxist-economics/topics
 */
const getTopics = async (req, res, next) => {
    try {
        const topics = await marxistEconomicsService.getAllMarxistTopics();

        const formattedTopics = topics.map(topic => ({
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
            createdAt: topic.createdAt
        }));

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách chủ đề thành công',
            topics: formattedTopics
        });
    } catch (error) {
        console.error('Get Marxist topics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách chủ đề'
        });
    }
};

/**
 * Phân tích tiến độ học tập và đề xuất bài học tiếp theo
 * GET /api/marxist-economics/analyze-progress
 */
const analyzeProgress = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const analysis = await marxistEconomicsService.analyzeUserProgress(userId);

        return res.status(200).json({
            success: true,
            message: 'Phân tích tiến độ thành công',
            analysis
        });
    } catch (error) {
        console.error('Analyze Marxist progress error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi phân tích tiến độ'
        });
    }
};

/**
 * Lấy lesson theo learning path của user
 * GET /api/marxist-economics/lessons/:pathId
 */
const getLessonByPath = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { pathId } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        if (!pathId) {
            return res.status(400).json({
                success: false,
                message: 'pathId là bắt buộc'
            });
        }

        // Import models
        const { default: MarxistLearningPath } = await import('../models/marxistLearningPath.js');
        const { default: Lesson } = await import('../models/lesson.js');

        // Tìm path của user
        const pathDoc = await MarxistLearningPath.findOne({
            _id: pathId,
            userId
        }).populate('marxistTopic').populate('lessonId');

        if (!pathDoc) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy learning path'
            });
        }

        // Lấy chi tiết lesson với questions
        const lesson = await Lesson.findById(pathDoc.lessonId)
            .populate('questions topic level skills');

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bài học'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Lấy lesson thành công',
            lesson: {
                id: lesson._id,
                title: lesson.title,
                topic: lesson.topic,
                level: lesson.level,
                skills: lesson.skills,
                maxScore: lesson.maxScore,
                questions: lesson.questions,
                createdAt: lesson.createdAt
            },
            learningPath: {
                pathId: pathDoc._id,
                marxistTopic: {
                    id: pathDoc.marxistTopic._id,
                    name: pathDoc.marxistTopic.name,
                    title: pathDoc.marxistTopic.title
                },
                difficultyLevel: pathDoc.difficultyLevel,
                order: pathDoc.order,
                recommendedReason: pathDoc.recommendedReason
            }
        });

    } catch (error) {
        console.error('Get lesson by path error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lesson'
        });
    }
};

/**
 * Test Gemini API connection
 * GET /api/marxist-economics/test-gemini
 */
const testGeminiConnection = async (req, res, next) => {
    try {
        const geminiService = await import('../services/geminiService.js');
        const result = await geminiService.default.validateConnection();

        return res.status(200).json({
            success: result.success,
            message: result.message,
            connected: result.connected
        });
    } catch (error) {
        console.error('Test Gemini connection error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi test kết nối Gemini',
            connected: false
        });
    }
};

export default {
    generateLesson,
    getLearningPath,
    getLessonByPath,
    completeLesson,
    getStats,
    getTopics,
    analyzeProgress,
    testGeminiConnection
}; 