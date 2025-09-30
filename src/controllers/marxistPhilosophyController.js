import marxistPhilosophyService from '../services/marxistPhilosophyService.js';
import generationRateLimiter from '../middleware/rateLimiter.js';
import cacheService from '../services/cacheService.js';
import multiAiService from '../services/multiAiService.js';

/**
 * Tạo bài học triết học Mác-Lê-Nin mới
 * POST /api/marxist-philosophy/generate-lesson
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

        const result = await marxistPhilosophyService.generateMarxistLesson(userId, {
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
 * Lấy lộ trình học triết học Mác-Lê-Nin
 * GET /api/marxist-philosophy/learning-path
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

        const result = await marxistPhilosophyService.getMarxistLearningPath(userId, {
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
 * Hoàn thành bài học triết học Mác-Lê-Nin
 * POST /api/marxist-philosophy/complete-lesson
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

        const { lessonId, score, questionResults } = req.body;

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

        // questionResults là optional, default = []
        const validQuestionResults = Array.isArray(questionResults) ? questionResults : [];

        const result = await marxistPhilosophyService.completeMarxistLesson(
            userId,
            lessonId,
            score,
            validQuestionResults
        );

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
 * Lấy thống kê học tập triết học Mác-Lê-Nin
 * GET /api/marxist-philosophy/stats
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

        const result = await marxistPhilosophyService.getMarxistStats(userId);

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
 * Lấy danh sách chủ đề triết học Mác-Lê-Nin
 * GET /api/marxist-philosophy/topics
 */
const getTopics = async (req, res, next) => {
    try {
        const topics = await marxistPhilosophyService.getAllMarxistTopics();

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
 * GET /api/marxist-philosophy/analyze-progress
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

        const analysis = await marxistPhilosophyService.analyzeUserProgress(userId);

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
 * GET /api/marxist-philosophy/lessons/:pathId
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

        // Lấy chi tiết lesson với questions - OPTIMIZED for performance
        const lesson = await Lesson.findById(pathDoc.lessonId)
            .populate({
                path: 'questions',
                select: '_id content options correctAnswer score timeLimit type' // Only select needed fields
            })
            .populate('topic', '_id name description') // Only select needed topic fields
            .populate('level', '_id name description minScoreRequired timeLimit') // Only select needed level fields
            .populate('skills', '_id name description') // Only select needed skill fields
            .lean(); // Use lean() for better performance - returns plain JS objects

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
 * GET /api/marxist-philosophy/test-gemini
 */
const testGeminiConnection = async (req, res, next) => {
    try {
        const geminiService = await import('../services/geminiService.js');
        const result = await geminiService.default.validateConnection();

        const statusCode = result.success ? 200 : 400;

        return res.status(statusCode).json({
            success: result.success,
            message: result.message,
            connected: result.connected,
            config: result.config,
            response: result.response,
            error: result.error
        });
    } catch (error) {
        console.error('Test Gemini connection error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi test kết nối Gemini',
            connected: false,
            error: error.message
        });
    }
};

/**
 * Làm lại bài học triết học Mác-Lê-Nin  
 * POST /api/marxist-philosophy/retry-lesson
 */
const retryMarxistLesson = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Yêu cầu đăng nhập'
            });
        }

        const { lessonId, pathId } = req.body;

        if (!lessonId) {
            return res.status(400).json({
                success: false,
                message: 'lessonId là bắt buộc'
            });
        }

        const result = await marxistPhilosophyService.retryMarxistLesson(userId, lessonId, pathId);

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Retry Marxist lesson error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi làm lại bài học'
        });
    }
};

// Test Gemini connection with real Marxist question
const testGemini = async (req, res) => {
    try {
        console.log('🧪 Testing Gemini connection...');

        // Test simple connection first
        const connectionTest = await geminiService.validateConnection();
        if (!connectionTest.success) {
            return res.status(500).json({
                success: false,
                message: 'Gemini API connection failed',
                error: connectionTest.message
            });
        }

        // Test generating actual Marxist question
        const testPrompt = `Tạo 1 câu hỏi trắc nghiệm về TRIẾT HỌC Mác-Lê-Nin:

⚠️ QUAN TRỌNG: CHỈ VỀ TRIẾT HỌC, KHÔNG PHẢI KINH TẺ!

Chủ đề: Duy vật biện chứng - Quy luật mâu thuận
Yêu cầu: 
- 1 câu hỏi multiple choice với 4 đáp án A,B,C,D
- Nội dung CHỈ VỀ triết học Mác-Lê-Nin (quy luật, phương pháp luận, nhận thức)
- KHÔNG hỏi về kinh tế, giá trị, tư bản, bóc lột
- Format JSON

Trả về JSON:
{
  "question": {
    "content": "Câu hỏi...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A. ...",
    "explanation": "Giải thích..."
  }
}`;

        const result = await geminiService.generateJsonContent(testPrompt);

        res.json({
            success: true,
            message: 'Gemini AI working correctly',
            connectionModel: connectionTest.model,
            testResult: result
        });

    } catch (error) {
        console.error('❌ Gemini test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Gemini test failed',
            error: error.message
        });
    }
};

/**
 * Lấy thống kê Rate Limiter (Admin only)
 * GET /api/marxist-philosophy/rate-limiter-stats
 */
const getRateLimiterStats = async (req, res, next) => {
    try {
        const rateLimiterStats = generationRateLimiter.getStats();
        const cacheStats = cacheService.getStats();

        return res.status(200).json({
            success: true,
            message: 'Thống kê hiệu năng hệ thống',
            data: {
                rateLimiter: {
                    ...rateLimiterStats,
                    description: 'AI Generation Rate Limiting Status'
                },
                cache: {
                    ...cacheStats,
                    description: 'In-memory Cache Status'
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get rate limiter stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê rate limiter',
            error: error.message
        });
    }
};

/**
 * Test tất cả AI connections (Admin only)
 * GET /api/marxist-philosophy/test-all-ai
 */
const testAllAiConnections = async (req, res, next) => {
    try {
        console.log('🔍 Testing all AI connections...');

        const result = await multiAiService.testAllConnections();

        return res.status(result.success ? 200 : 503).json({
            success: result.success,
            message: result.message,
            data: {
                ...result,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Test all AI connections error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi test AI connections',
            error: error.message
        });
    }
};

/**
 * Lấy thống kê Multi-AI Service (Admin only)
 * GET /api/marxist-philosophy/multi-ai-stats
 */
const getMultiAiStats = async (req, res, next) => {
    try {
        const multiAiStats = multiAiService.getStats();
        const rateLimiterStats = generationRateLimiter.getStats();
        const cacheStats = cacheService.getStats();

        return res.status(200).json({
            success: true,
            message: 'Thống kê Multi-AI Service',
            data: {
                multiAi: {
                    ...multiAiStats,
                    description: 'Load balancing between Gemini and DeepSeek'
                },
                rateLimiter: {
                    ...rateLimiterStats,
                    description: 'AI Generation Rate Limiting Status'
                },
                cache: {
                    ...cacheStats,
                    description: 'In-memory Cache Status'
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get multi-AI stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê multi-AI',
            error: error.message
        });
    }
};

/**
 * Test answer distribution concentration (Admin only)
 * GET /api/marxist-philosophy/test-answer-distribution?topic=duy_vat_bien_chung&difficulty=2
 */
const testAnswerDistribution = async (req, res, next) => {
    try {
        const { topic = "duy_vat_bien_chung", difficulty = 2 } = req.query;

        console.log(`🎯 Admin testing answer distribution for topic: ${topic}, difficulty: ${difficulty}`);

        const result = await marxistPhilosophyService.testAnswerDistribution(topic, parseInt(difficulty));

        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            message: result.success ? 'Answer distribution test completed' : result.message,
            data: result.success ? {
                ...result,
                timestamp: new Date().toISOString(),
                testParameters: { topic, difficulty: parseInt(difficulty) }
            } : null,
            error: result.success ? null : result.message
        });
    } catch (error) {
        console.error('Test answer distribution error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi test answer distribution',
            error: error.message
        });
    }
};
const testAiAccuracy = async (req, res, next) => {
    try {
        const { topic = "duy_vat_bien_chung", difficulty = 2 } = req.query;

        console.log(`🧪 Admin testing AI accuracy for topic: ${topic}, difficulty: ${difficulty}`);

        const result = await marxistPhilosophyService.testAiGenerationAccuracy(topic, parseInt(difficulty));

        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            message: result.success ? 'AI accuracy test completed' : result.message,
            data: result.success ? {
                ...result,
                timestamp: new Date().toISOString(),
                testParameters: { topic, difficulty: parseInt(difficulty) }
            } : null,
            error: result.success ? null : result.message
        });
    } catch (error) {
        console.error('Test AI accuracy error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi test AI accuracy',
            error: error.message
        });
    }
};
const getGenerationStats = async (req, res, next) => {
    try {
        const generationStats = await marxistPhilosophyService.getGenerationStats();

        return res.status(200).json({
            success: true,
            message: 'Thống kê performance AI generation',
            data: {
                ...generationStats,
                timestamp: new Date().toISOString(),
                description: 'AI Generation Queue Performance & Optimization Stats'
            }
        });
    } catch (error) {
        console.error('Get generation stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê generation',
            error: error.message
        });
    }
};

export default {
    generateLesson,
    getLearningPath,
    getLessonByPath,
    completeLesson,
    retryMarxistLesson,
    getStats,
    getTopics,
    analyzeProgress,
    testGeminiConnection,
    testGemini,
    getRateLimiterStats,
    testAllAiConnections,
    getMultiAiStats,
    getGenerationStats,
    testAnswerDistribution,
    testAiAccuracy
}; 