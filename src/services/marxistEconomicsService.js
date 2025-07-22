import geminiService from './geminiService.js';
import Lesson from '../models/lesson.js';
import Question from '../models/question.js';
import MarxistLearningPath from '../models/marxistLearningPath.js';
import MarxistTopic from '../models/marxistTopic.js';
import User from '../models/user.js';
import Progress from '../models/progress.js';
import Level from '../models/level.js';
import Topic from '../models/topic.js';
import Skill from '../models/skill.js';
import NotificationService from './notificationService.js';

// Hàm lấy tất cả chủ đề Marxist từ database
const getAllMarxistTopics = async () => {
    try {
        const topics = await MarxistTopic.find({ isActive: true })
            .sort({ displayOrder: 1, createdAt: 1 });
        return topics;
    } catch (error) {
        console.error('Error getting Marxist topics:', error);
        return [];
    }
};

/**
 * Lấy thứ tự tiếp theo cho lộ trình học Marxist
 * @param {string} userId - User ID
 * @returns {number} Order number
 */
const getNextMarxistOrder = async (userId) => {
    const lastPath = await MarxistLearningPath
        .findOne({ userId })
        .sort({ order: -1 });
    return lastPath ? lastPath.order + 1 : 1;
};

/**
 * Phân tích kết quả học tập trước đó để xác định độ khó và chủ đề tiếp theo
 * @param {string} userId - User ID
 * @returns {Object} Analysis result
 */
const analyzeUserProgress = async (userId) => {
    try {
        // Lấy 3 lesson Marxist gần nhất
        const recentPaths = await MarxistLearningPath.find({ userId })
            .sort({ order: -1 })
            .limit(3)
            .populate('lessonId');

        if (recentPaths.length === 0) {
            // User mới, lấy chủ đề đầu tiên từ database
            const allTopics = await getAllMarxistTopics();
            const firstTopic = allTopics.length > 0 ? allTopics[0]._id : null;

            if (!firstTopic) {
                throw new Error('Không có chủ đề Marxist nào trong database');
            }

            return {
                recommendedTopic: firstTopic,
                difficultyLevel: allTopics[0].suggestedDifficulty || 1,
                reason: 'Người học mới bắt đầu với kinh tế chính trị Mác-Lê-Nin'
            };
        }

        // Tính điểm trung bình
        const completedPaths = recentPaths.filter(path => path.completed && path.achievedScore !== null);
        let averageScore = 0;

        if (completedPaths.length > 0) {
            averageScore = completedPaths.reduce((sum, path) => sum + path.achievedScore, 0) / completedPaths.length;
        }

        // Xác định độ khó tiếp theo
        let newDifficulty = 1;
        if (averageScore >= 90) newDifficulty = Math.min(5, recentPaths[0].difficultyLevel + 1);
        else if (averageScore >= 80) newDifficulty = recentPaths[0].difficultyLevel;
        else if (averageScore >= 70) newDifficulty = Math.max(1, recentPaths[0].difficultyLevel - 1);
        else newDifficulty = Math.max(1, recentPaths[0].difficultyLevel - 2);

        // Xác định chủ đề tiếp theo
        const studiedTopicIds = recentPaths.map(path => path.marxistTopic.toString());
        const allTopics = await getAllMarxistTopics();
        const unstudiedTopics = allTopics.filter(topic => !studiedTopicIds.includes(topic._id.toString()));

        let recommendedTopic;
        if (unstudiedTopics.length > 0) {
            // Chọn chủ đề chưa học
            recommendedTopic = unstudiedTopics[0]._id;
        } else {
            // Ôn lại chủ đề yếu nhất
            const weakestTopic = completedPaths.reduce((weakest, current) =>
                (!weakest || current.achievedScore < weakest.achievedScore) ? current : weakest
            );
            recommendedTopic = weakestTopic ? weakestTopic.marxistTopic : allTopics[0]._id;
        }

        return {
            recommendedTopic,
            difficultyLevel: newDifficulty,
            previousScore: Math.round(averageScore),
            reason: `Dựa trên kết quả ${completedPaths.length} bài học gần nhất (điểm TB: ${Math.round(averageScore)})`
        };

    } catch (error) {
        console.error('Error analyzing user progress:', error);
        const allTopics = await getAllMarxistTopics();
        const firstTopic = allTopics.length > 0 ? allTopics[0]._id : null;

        return {
            recommendedTopic: firstTopic,
            difficultyLevel: 1,
            reason: 'Lỗi phân tích, bắt đầu với chủ đề cơ bản'
        };
    }
};

/**
 * Generate câu hỏi về kinh tế chính trị Mác-Lê-Nin
 * @param {string} userId - User ID
 * @param {Object} options - Generation options
 * @returns {Object} Generated lesson
 */
const generateMarxistLesson = async (userId, options = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy người dùng'
            };
        }

        // Phân tích tiến độ học tập
        const analysis = await analyzeUserProgress(userId);
        let topicId = options.topic || analysis.recommendedTopic;
        const difficulty = options.difficulty || analysis.difficultyLevel;

        // Nếu topicId là string name, tìm topic trong database
        let topicInfo;
        if (typeof topicId === 'string' && !topicId.match(/^[0-9a-fA-F]{24}$/)) {
            topicInfo = await MarxistTopic.findOne({ name: topicId, isActive: true });
            if (!topicInfo) {
                return {
                    success: false,
                    statusCode: 400,
                    message: `Không tìm thấy chủ đề với name: ${topicId}`
                };
            }
            topicId = topicInfo._id;
        } else {
            topicInfo = await MarxistTopic.findById(topicId);
            if (!topicInfo || !topicInfo.isActive) {
                return {
                    success: false,
                    statusCode: 400,
                    message: 'Chủ đề không hợp lệ hoặc không hoạt động'
                };
            }
        }

        // Xây dựng prompt cho Gemini
        const prompt = `
Bạn là chuyên gia về kinh tế chính trị Mác-Lê-Nin. Hãy tạo 30 câu hỏi trắc nghiệm về chủ đề "${topicInfo.title}" với độ khó cấp độ ${difficulty}/5.

Chủ đề: ${topicInfo.title}
Mô tả: ${topicInfo.description}
Từ khóa quan trọng: ${topicInfo.keywords.join(', ')}

Yêu cầu:
- Đúng 30 câu hỏi trắc nghiệm (multiple choice)
- Mỗi câu có 4 đáp án (A, B, C, D)
- Nội dung chính xác theo lý thuyết Mác-Lê-Nin
- Độ khó phù hợp với cấp độ ${difficulty}
- Câu hỏi đa dạng: lý thuyết, ứng dụng, phân tích
- Thời gian làm mỗi câu: 45 giây

⚠️ CHỈ trả về kết quả ở định dạng JSON. KHÔNG thêm bất kỳ dòng chữ nào trước/sau.

{
  "title": "Bài tập ${topicInfo.title} - Cấp độ ${difficulty}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Nội dung câu hỏi...",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A",
      "score": 100,
      "timeLimit": 45
    }
  ]
}`;

        console.log('🔄 Generating Marxist lesson with Gemini...');
        const geminiResult = await geminiService.generateJsonContent(prompt);

        if (!geminiResult.success) {
            return {
                success: false,
                statusCode: 500,
                message: 'Lỗi khi tạo câu hỏi với Gemini: ' + geminiResult.message
            };
        }

        const lessonData = geminiResult.data;

        // Validate số lượng câu hỏi
        if (!lessonData.questions || lessonData.questions.length !== 30) {
            return {
                success: false,
                statusCode: 500,
                message: `Số lượng câu hỏi không đúng. Yêu cầu 30 câu, nhận được ${lessonData.questions?.length || 0} câu`
            };
        }

        // Tìm hoặc tạo Topic và Level
        let [topicDoc, levelDoc, skillDoc] = await Promise.all([
            Topic.findOne({ name: 'Marxist Economics' }) ||
            Topic.create({
                name: 'Marxist Economics',
                description: 'Kinh tế chính trị Mác-Lê-Nin',
                isActive: true
            }),

            Level.findOne({ name: 'marxist_intermediate' }) ||
            Level.create({
                name: 'marxist_intermediate',
                description: 'Trình độ trung cấp Marxist',
                minScoreRequired: 70,
                maxScore: 3000,
                timeLimit: 2250, // 45s * 50 câu
                isActive: true
            }),

            Skill.findOne({ name: 'marxist_theory' }) ||
            Skill.create({
                name: 'marxist_theory',
                description: 'Lý thuyết Mác-Lê-Nin',
                supportedTypes: ['multiple_choice'],
                isActive: true
            })
        ]);

        // Chuẩn hóa câu hỏi
        const processedQuestions = lessonData.questions.map(q => ({
            ...q,
            skill: skillDoc._id,
            type: 'multiple_choice',
            timeLimit: 45,
            score: 100
        }));

        // Tạo lesson
        const lesson = await Lesson.create({
            title: lessonData.title,
            topic: topicDoc._id,
            level: levelDoc._id,
            skills: [skillDoc._id],
            maxScore: 3000,
            questions: [],
            isActive: true
        });

        // Tạo questions
        const questionIds = [];
        for (const qData of processedQuestions) {
            const question = await Question.create({
                lessonId: lesson._id,
                skill: qData.skill,
                type: qData.type,
                content: qData.content,
                options: qData.options,
                correctAnswer: qData.correctAnswer,
                score: qData.score,
                timeLimit: qData.timeLimit
            });
            questionIds.push(question._id);
        }

        // Cập nhật lesson với question IDs
        lesson.questions = questionIds;
        await lesson.save();

        // Tạo MarxistLearningPath entry
        const pathOrder = await getNextMarxistOrder(userId);
        const learningPath = await MarxistLearningPath.create({
            userId: user._id,
            lessonId: lesson._id,
            source: 'ai_generated_marxist',
            marxistTopic: topicId,
            difficultyLevel: difficulty,
            previousScore: analysis.previousScore || 0,
            recommendedReason: analysis.reason,
            order: pathOrder
        });

        // Cập nhật thống kê cho topic
        await MarxistTopic.findByIdAndUpdate(topicId, {
            $inc: { totalLessonsGenerated: 1 }
        });

        // Gửi notification
        await NotificationService.createNotification(userId, {
            title: '📚 Bài học Mác-Lê-Nin mới đã sẵn sàng!',
            message: `AI đã tạo bài học về "${topicInfo.title}" với 30 câu hỏi. Hãy vào học ngay!`,
            type: 'marxist_generated',
            link: '/marxist-economics'
        });

        return {
            success: true,
            statusCode: 201,
            message: 'Tạo bài học kinh tế chính trị Mác-Lê-Nin thành công',
            lesson: {
                lessonId: lesson._id,
                title: lesson.title,
                topic: topicInfo.title,
                difficultyLevel: difficulty,
                questionCount: questionIds.length,
                maxScore: lesson.maxScore,
                createdAt: lesson.createdAt
            },
            learningPath: {
                pathId: learningPath._id,
                order: pathOrder,
                marxistTopic: {
                    id: topicInfo._id,
                    name: topicInfo.name,
                    title: topicInfo.title
                },
                recommendedReason: analysis.reason
            }
        };

    } catch (error) {
        console.error('Error generating Marxist lesson:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi tạo bài học: ' + error.message
        };
    }
};

/**
 * Lấy lộ trình học Marxist của user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Learning path
 */
const getMarxistLearningPath = async (userId, options = {}) => {
    try {
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;

        // Đếm tổng số bài trong lộ trình
        let total = await MarxistLearningPath.countDocuments({ userId });

        // Nếu chưa có bài học nào → tạo bài đầu tiên tự động
        if (total === 0) {
            console.log('🔄 User mới chưa có bài học Marxist, đang tạo bài đầu tiên...');

            // Kiểm tra xem có topic nào trong database không
            const availableTopics = await getAllMarxistTopics();
            if (availableTopics.length === 0) {
                return {
                    success: false,
                    statusCode: 500,
                    message: "Không có chủ đề Marxist nào trong database. Admin cần seed dữ liệu trước.",
                };
            }

            const genResult = await generateMarxistLesson(userId);
            if (!genResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    message: "Không thể tạo bài học đầu tiên: " + genResult.message,
                };
            }

            console.log('✅ Đã tạo bài học đầu tiên cho user:', userId);

            // Cập nhật lại total count
            total = await MarxistLearningPath.countDocuments({ userId });
        }

        // Lấy dữ liệu lộ trình
        const pathDocs = await MarxistLearningPath.find({ userId })
            .populate({
                path: 'lessonId',
                populate: ['topic', 'level']
            })
            .sort({ order: 1 })
            .skip(skip)
            .limit(limit);

        // Lấy danh sách lesson đã hoàn thành
        const completedLessonIds = (
            await Progress.distinct('lessonId', {
                userId,
                status: 'COMPLETE'
            })
        ).map(id => id.toString());

        // Xử lý dữ liệu trả về
        const learningPath = pathDocs.map(doc => {
            const lesson = doc.lessonId;
            const lessonIdStr = lesson?._id?.toString();
            const isCompleted = completedLessonIds.includes(lessonIdStr);
            const marxistTopic = doc.marxistTopic;

            return {
                pathId: doc._id,
                lessonId: lesson?._id,
                title: lesson?.title || 'Không có tiêu đề',
                marxistTopic: {
                    id: marxistTopic?._id,
                    name: marxistTopic?.name || 'unknown',
                    title: marxistTopic?.title || 'Không xác định',
                    description: marxistTopic?.description || ''
                },
                difficultyLevel: doc.difficultyLevel,
                recommendedReason: doc.recommendedReason,
                previousScore: doc.previousScore,
                order: doc.order,
                completed: isCompleted,
                achievedScore: doc.achievedScore,
                completedAt: doc.completedAt,
                status: isCompleted ? 'COMPLETE' : 'LOCKED',
                createdAt: doc.generatedAt
            };
        });

        return {
            success: true,
            statusCode: 200,
            message: 'Lấy lộ trình học Marxist thành công',
            learningPath,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                pageSize: limit
            }
        };

    } catch (error) {
        console.error('Error getting Marxist learning path:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi lấy lộ trình học: ' + error.message
        };
    }
};

/**
 * Hoàn thành bài học Marxist và tạo bài tiếp theo
 * @param {string} userId - User ID
 * @param {string} lessonId - Lesson ID
 * @param {number} score - Achieved score
 * @returns {Object} Result
 */
const completeMarxistLesson = async (userId, lessonId, score) => {
    try {
        // Cập nhật MarxistLearningPath
        const pathDoc = await MarxistLearningPath.findOneAndUpdate(
            { userId, lessonId },
            {
                completed: true,
                achievedScore: score,
                completedAt: new Date()
            },
            { new: true }
        );

        if (!pathDoc) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy bài học trong lộ trình Marxist'
            };
        }

        // Tự động tạo bài học tiếp theo nếu hoàn thành tốt
        if (score >= 70) {
            try {
                await generateMarxistLesson(userId);
                console.log('✅ Auto-generated next Marxist lesson for user:', userId);
            } catch (error) {
                console.warn('⚠️ Failed to auto-generate next Marxist lesson:', error.message);
            }
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Hoàn thành bài học Marxist thành công',
            pathUpdated: true,
            nextLessonGenerated: score >= 70
        };

    } catch (error) {
        console.error('Error completing Marxist lesson:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi hoàn thành bài học: ' + error.message
        };
    }
};

/**
 * Lấy thống kê học tập Marxist
 * @param {string} userId - User ID
 * @returns {Object} Statistics
 */
const getMarxistStats = async (userId) => {
    try {
        const totalLessons = await MarxistLearningPath.countDocuments({ userId });
        const completedLessons = await MarxistLearningPath.countDocuments({
            userId,
            completed: true
        });

        // Thống kê theo chủ đề
        const topicStats = await MarxistLearningPath.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: 'marxisttopics',
                    localField: 'marxistTopic',
                    foreignField: '_id',
                    as: 'topicInfo'
                }
            },
            {
                $group: {
                    _id: '$marxistTopic',
                    topicName: { $first: { $arrayElemAt: ['$topicInfo.name', 0] } },
                    topicTitle: { $first: { $arrayElemAt: ['$topicInfo.title', 0] } },
                    total: { $sum: 1 },
                    completed: {
                        $sum: { $cond: ['$completed', 1, 0] }
                    },
                    avgScore: {
                        $avg: { $cond: ['$completed', '$achievedScore', null] }
                    }
                }
            }
        ]);

        // Điểm trung bình tổng thể
        const avgScoreResult = await MarxistLearningPath.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    completed: true,
                    achievedScore: { $ne: null }
                }
            },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$achievedScore' }
                }
            }
        ]);

        const overallAvgScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;

        return {
            success: true,
            statusCode: 200,
            message: 'Lấy thống kê Marxist thành công',
            stats: {
                totalLessons,
                completedLessons,
                completionRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                overallAvgScore,
                topicBreakdown: topicStats.map(stat => ({
                    topicId: stat._id,
                    name: stat.topicName || 'unknown',
                    title: stat.topicTitle || 'Không xác định',
                    total: stat.total,
                    completed: stat.completed,
                    avgScore: stat.avgScore ? Math.round(stat.avgScore) : 0
                }))
            }
        };

    } catch (error) {
        console.error('Error getting Marxist stats:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi lấy thống kê: ' + error.message
        };
    }
};

export default {
    generateMarxistLesson,
    getMarxistLearningPath,
    completeMarxistLesson,
    getMarxistStats,
    analyzeUserProgress,
    getAllMarxistTopics
}; 