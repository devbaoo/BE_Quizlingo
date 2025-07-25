import mongoose from 'mongoose';
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
import UserPackage from '../models/userPackage.js';
import moment from 'moment-timezone';

// Import lives management từ lessonService
import { checkAndRegenerateLives } from './lessonService.js';

/**
 * Tính XP cần thiết để lên level
 * @param {number} level - Level hiện tại
 * @returns {number} Required XP
 */
const getRequiredXpForLevel = (level) => {
    // Giảm tốc độ tăng XP yêu cầu để user dễ lên cấp hơn
    return Math.floor(100 * Math.pow(1.3, level - 1));
};

// Mutex để tránh concurrent generation cho cùng 1 user
const generatingUsers = new Set();

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
            const weakestTopic = completedPaths.length > 0
                ? completedPaths.reduce((weakest, current) =>
                    (!weakest || current.achievedScore < weakest.achievedScore) ? current : weakest
                )
                : null;
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
    // Kiểm tra xem user đang generate lesson khác không
    if (generatingUsers.has(userId)) {
        console.warn(`⚠️ User ${userId} đang generate lesson khác, bỏ qua request này`);
        return {
            success: false,
            statusCode: 429,
            message: 'Đang tạo bài học khác, vui lòng chờ...',
            generating: true
        };
    }

    try {
        // Lock user để tránh concurrent generation
        generatingUsers.add(userId);
        console.log(`🔒 Locked user ${userId} for lesson generation`);

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

        // Khai báo lessonData variable
        let lessonData;

        // Kiểm tra development mode - skip Gemini nếu có biến môi trường
        if (process.env.SKIP_GEMINI === 'true') {
            console.warn('🚧 SKIP_GEMINI enabled - creating demo lesson...');

            // Tạo demo lesson với 30 câu hỏi để user có thể test đầy đủ
            const demoQuestions = [];
            for (let i = 1; i <= 30; i++) {
                demoQuestions.push({
                    type: "multiple_choice",
                    content: `Câu ${i}: Theo ${topicInfo.title}, điều nào sau đây đúng? (Demo khi Gemini API không khả dụng)`,
                    options: [
                        `A. Đáp án A của câu ${i}`,
                        `B. Đáp án B của câu ${i}`,
                        `C. Đáp án C của câu ${i}`,
                        `D. Đáp án D của câu ${i}`
                    ],
                    correctAnswer: `A. Đáp án A của câu ${i}`,
                    score: 100,
                    timeLimit: 45
                });
            }

            lessonData = {
                title: `[DEMO] ${topicInfo.title} - Cấp độ ${difficulty}`,
                questions: demoQuestions
            };

            console.log('📝 Creating demo lesson with 30 questions...');

        } else {
            console.log('🔄 Generating Marxist lesson with Gemini...');
            const geminiResult = await geminiService.generateJsonContent(prompt);

            if (!geminiResult.success) {
                // Nếu Gemini API thất bại, tạo demo lesson để không block user
                console.warn('⚠️ Gemini API failed, creating demo lesson...');

                // Tạo demo lesson với 30 câu hỏi để user có thể test đầy đủ
                const demoQuestions = [];
                for (let i = 1; i <= 30; i++) {
                    demoQuestions.push({
                        type: "multiple_choice",
                        content: `Câu ${i}: Theo ${topicInfo.title}, điều nào sau đây đúng? (Demo khi Gemini API không khả dụng)`,
                        options: [
                            `A. Đáp án A của câu ${i}`,
                            `B. Đáp án B của câu ${i}`,
                            `C. Đáp án C của câu ${i}`,
                            `D. Đáp án D của câu ${i}`
                        ],
                        correctAnswer: `A. Đáp án A của câu ${i}`,
                        score: 100,
                        timeLimit: 45
                    });
                }

                lessonData = {
                    title: `[DEMO] ${topicInfo.title} - Cấp độ ${difficulty}`,
                    questions: demoQuestions
                };

                console.log('📝 Creating demo lesson with generated questions...');
            } else {
                lessonData = geminiResult.data;
                console.log('✅ Using Gemini-generated lesson data');
            }
        }

        // Validate lesson data
        if (!lessonData || !lessonData.questions) {
            console.error('❌ Invalid lesson data:', lessonData);
            return {
                success: false,
                statusCode: 500,
                message: 'Lesson data không hợp lệ'
            };
        }

        console.log(`📊 Lesson data: ${lessonData.questions.length} questions`);

        // Validate số lượng câu hỏi (flexible cho demo)
        if (lessonData.questions.length === 0) {
            return {
                success: false,
                statusCode: 500,
                message: 'Không có câu hỏi nào trong bài học'
            };
        }

        // Warn nếu không phải 30 câu nhưng vẫn cho phép tạo
        if (lessonData.questions.length !== 30) {
            console.warn(`⚠️ Expected 30 questions, got ${lessonData.questions.length}`);
        }

        // Tìm hoặc tạo Topic, Level, Skill với error handling
        console.log('📋 Finding or creating Topic, Level, Skill...');

        let topicDoc = await Topic.findOne({ name: 'Marxist Economics' });
        if (!topicDoc) {
            console.log('🔧 Creating Marxist Economics topic...');
            topicDoc = await Topic.create({
                name: 'Marxist Economics',
                description: 'Kinh tế chính trị Mác-Lê-Nin',
                isActive: true
            });
        }

        let levelDoc = await Level.findOne({ name: 'marxist_intermediate' });
        if (!levelDoc) {
            console.log('🔧 Creating marxist_intermediate level...');

            // Tìm order cao nhất hiện tại và +1
            const lastLevel = await Level.findOne().sort({ order: -1 });
            const nextOrder = lastLevel ? lastLevel.order + 1 : 1;

            levelDoc = await Level.create({
                name: 'marxist_intermediate',
                description: 'Trình độ trung cấp Marxist',
                order: nextOrder,
                minScoreRequired: 70,
                minUserLevel: 1,
                minLessonPassed: 0,
                maxScore: 3000,
                timeLimit: 2250, // 45s * 50 câu
                isActive: true
            });

            console.log(`✅ Created level with order: ${nextOrder}`);
        }

        let skillDoc = await Skill.findOne({ name: 'marxist_theory' });
        if (!skillDoc) {
            console.log('🔧 Creating marxist_theory skill...');
            skillDoc = await Skill.create({
                name: 'marxist_theory',
                description: 'Lý thuyết Mác-Lê-Nin',
                supportedTypes: ['multiple_choice'],
                isActive: true
            });
        }

        // Validate tất cả đều tồn tại
        if (!topicDoc || !levelDoc || !skillDoc) {
            console.error('❌ Failed to create required models:', {
                topicDoc: !!topicDoc,
                levelDoc: !!levelDoc,
                skillDoc: !!skillDoc
            });
            return {
                success: false,
                statusCode: 500,
                message: 'Không thể tạo Topic, Level, hoặc Skill cần thiết'
            };
        }

        console.log('✅ Topic, Level, Skill ready:', {
            topic: topicDoc.name,
            level: levelDoc.name,
            skill: skillDoc.name
        });

        // Chuẩn hóa câu hỏi
        const processedQuestions = lessonData.questions.map(q => ({
            ...q,
            skill: skillDoc._id,
            type: 'multiple_choice',
            timeLimit: 45,
            score: 100
        }));

        // Tạo lesson
        console.log('📝 Creating lesson document...');
        const lesson = await Lesson.create({
            title: lessonData.title || `Bài học ${topicInfo.title}`,
            topic: topicDoc._id,
            level: levelDoc._id,
            skills: [skillDoc._id],
            maxScore: lessonData.questions.length * 100, // 100 điểm mỗi câu
            questions: [],
            isActive: true
        });

        console.log('✅ Lesson created:', lesson._id);

        // Tạo questions
        console.log(`🔄 Creating ${processedQuestions.length} questions...`);
        const questionIds = [];

        for (let i = 0; i < processedQuestions.length; i++) {
            const qData = processedQuestions[i];
            try {
                const question = await Question.create({
                    lessonId: lesson._id,
                    skill: qData.skill,
                    type: qData.type,
                    content: qData.content,
                    options: qData.options || [],
                    correctAnswer: qData.correctAnswer,
                    score: qData.score || 100,
                    timeLimit: qData.timeLimit || 45
                });
                questionIds.push(question._id);

                if ((i + 1) % 10 === 0) {
                    console.log(`✅ Created ${i + 1}/${processedQuestions.length} questions`);
                }
            } catch (error) {
                console.error(`❌ Failed to create question ${i + 1}:`, error.message);
                throw error;
            }
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
            type: 'ai_generated',
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
    } finally {
        // Luôn unlock user sau khi hoàn thành
        generatingUsers.delete(userId);
        console.log(`🔓 Unlocked user ${userId} after lesson generation`);
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

        // ❌ REMOVED: Auto-generation moved to client-side to prevent duplicate lessons
        // Client should explicitly call POST /marxist-economics/generate-lesson when needed
        if (total === 0) {
            console.log('📋 User mới chưa có bài học Marxist. Client cần gọi generate-lesson API.');

            // Kiểm tra xem có topic nào trong database không
            const availableTopics = await getAllMarxistTopics();
            if (availableTopics.length === 0) {
                return {
                    success: false,
                    statusCode: 500,
                    message: "Không có chủ đề Marxist nào trong database. Admin cần seed dữ liệu trước.",
                };
            }

            // Trả về empty learning path với thông báo để client gọi generate
            return {
                success: true,
                statusCode: 200,
                message: "Chưa có bài học nào. Hãy tạo bài học đầu tiên!",
                learningPath: [],
                total: 0,
                currentPage: parseInt(page),
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
                needsFirstLesson: true, // Flag để client biết cần tạo lesson đầu tiên
                availableTopics: availableTopics.length
            };
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

        // ❌ OLD: Using Progress table - WRONG for Marxist system
        // const completedLessonIds = (
        //     await Progress.distinct('lessonId', {
        //         userId,
        //         status: 'COMPLETE'
        //     })
        // ).map(id => id.toString());

        // Xử lý dữ liệu trả về
        const learningPath = pathDocs.map(doc => {
            const lesson = doc.lessonId;
            // ✅ NEW: Use MarxistLearningPath.completed field directly
            const isCompleted = doc.completed || false; // Use doc.completed from MarxistLearningPath
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
                completed: isCompleted, // ✅ Now uses MarxistLearningPath.completed
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
 * Hoàn thành bài học kinh tế chính trị Mác-Lê-Nin với lives system
 * @param {string} userId - User ID  
 * @param {string} lessonId - Lesson ID
 * @param {number} score - Điểm số (0-100)
 * @param {Array} questionResults - Kết quả từng câu hỏi (optional)
 * @returns {Object} Completion result
 */
const completeMarxistLesson = async (userId, lessonId, score, questionResults = []) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy người dùng'
            };
        }

        // Regenerate lives trước nếu cần
        await checkAndRegenerateLives(user);

        // Kiểm tra gói premium
        const now = moment().tz("Asia/Ho_Chi_Minh");
        const activePackage = await UserPackage.findOne({
            user: userId,
            isActive: true,
            endDate: { $gt: now.toDate() },
            paymentStatus: "completed",
        }).populate("package");

        const hasPremium = activePackage?.package?.features || {};
        const unlimitedLives = hasPremium.unlimitedLives || false;

        // Trừ lives nếu score < 70% và không phải premium
        let livesDeducted = false;
        if (score < 70 && !unlimitedLives) {
            if (user.lives <= 0) {
                return {
                    success: false,
                    statusCode: 403,
                    message: 'Không đủ lượt chơi. Hãy chờ lives hồi phục hoặc mua gói premium.',
                    needsLives: true,
                    currentLives: user.lives
                };
            }

            user.lives -= 1;
            user.lastLivesRegenerationTime = new Date();
            await user.save();
            livesDeducted = true;

            console.log(`💔 Deducted 1 life from user ${userId} (score: ${score}%, lives: ${user.lives})`);
        }

        // Cập nhật MarxistLearningPath với logic completed dựa vào score
        const pathDoc = await MarxistLearningPath.findOneAndUpdate(
            { userId, lessonId },
            {
                completed: score >= 70, // Chỉ completed = true khi score >= 70%
                achievedScore: score,
                completedAt: score >= 70 ? new Date() : null // Chỉ set completedAt khi thực sự completed
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

        // 📊 TẠO PROGRESS RECORD (giống lesson tiếng Anh)
        const lessonStatus = score >= 70 ? 'COMPLETE' : 'FAILED';
        const isRetried = false; // TODO: Implement retry tracking if needed

        // 🔍 VALIDATE và FILTER questionResults để đảm bảo schema compliance
        const validQuestionResults = Array.isArray(questionResults)
            ? questionResults.filter(result => {
                // Chỉ giữ lại results có questionId (answer có thể rỗng nếu user không chọn)
                return result && result.questionId;
            }).map(result => ({
                questionId: result.questionId,
                answer: result.answer || '', // Cho phép answer rỗng nếu user không chọn
                isCorrect: result.isCorrect || false, // Default false nếu không có
                score: typeof result.score === 'number' ? result.score : 0, // Default 0 nếu không có
                isTimeout: result.isTimeout || false,
                transcription: result.transcription || null,
                feedback: result.feedback || null
            }))
            : [];

        console.log(`📝 Creating Progress record: userId=${userId}, lessonId=${lessonId}, score=${score}, status=${lessonStatus}`);
        console.log(`📊 Valid questionResults: ${validQuestionResults.length}/${questionResults?.length || 0}`);

        const progress = await Progress.create({
            userId,
            lessonId,
            score,
            status: lessonStatus,
            isRetried,
            questionResults: validQuestionResults
        });

        console.log(`✅ Progress record created: ${progress._id}`);

        // 🎯 CỘNG XP VÀ KIỂM TRA LEVEL UP
        let earnedXP = 0;
        let leveledUp = false;
        let newLevel = user.userLevel;
        let livesFromLevelUp = 0;

        if (score >= 70) { // Chỉ cộng XP khi pass
            // Tính XP: điểm / 10 (giống logic English learning)
            earnedXP = Math.round(score / 10);
            user.xp += earnedXP;

            console.log(`⭐ User ${userId} earned ${earnedXP} XP (score: ${score}%, total XP: ${user.xp})`);

            // Kiểm tra level up
            const requiredXp = getRequiredXpForLevel(user.userLevel);
            if (user.xp >= requiredXp) {
                const oldLevel = user.userLevel;
                user.userLevel += 1;
                user.xp = 0; // Reset XP về 0
                user.lives = Math.min(user.lives + 1, 5); // +1 life (max 5)

                leveledUp = true;
                newLevel = user.userLevel;
                livesFromLevelUp = 1;

                console.log(`🎉 User ${userId} leveled up! ${oldLevel} → ${newLevel} (gained 1 life, total: ${user.lives})`);

                // Gửi notification level up
                try {
                    await NotificationService.createNotification(userId, {
                        title: '🎉 Chúc mừng lên cấp!',
                        message: `Bạn đã lên Level ${newLevel}! Nhận thêm 1 ❤️ lives và unlock tính năng mới.`,
                        type: 'level_up',
                        link: '/profile'
                    });
                } catch (error) {
                    console.error('Failed to create level up notification:', error);
                }
            }

            // Lưu user với XP và level mới
            await user.save();
        }

        // Tự động tạo bài học tiếp theo nếu hoàn thành tốt (score >= 70)
        // 🚫 REMOVED: Auto-generation moved to client-side to prevent API blocking
        let nextLessonGenerated = false;
        // if (score >= 70) {
        //     try {
        //         const nextLessonResult = await generateMarxistLesson(userId);
        //         if (nextLessonResult.success) {
        //             nextLessonGenerated = true;
        //             console.log('✅ Auto-generated next Marxist lesson for user:', userId);
        //         }
        //     } catch (error) {
        //         console.warn('⚠️ Failed to auto-generate next Marxist lesson:', error.message);
        //     }
        // }

        return {
            success: true,
            statusCode: 200,
            message: score >= 70
                ? (leveledUp
                    ? `🎉 Hoàn thành xuất sắc! Nhận ${earnedXP} XP và lên Level ${newLevel}!`
                    : `✅ Hoàn thành xuất sắc! Nhận ${earnedXP} XP. Bài học đã completed.`)
                : `Điểm số: ${score}%. Bài học chưa completed. ${livesDeducted ? 'Đã trừ 1 life.' : ''} Hãy cố gắng hơn!`,
            pathUpdated: true,
            completed: score >= 70,
            nextLessonGenerated,
            // Lives info
            livesDeducted,
            currentLives: user.lives,
            // Score info
            scoreAchieved: score,
            passed: score >= 70,
            // XP & Level info
            earnedXP,
            leveledUp,
            newLevel,
            livesFromLevelUp,
            currentXP: user.xp,
            nextLevelRequiredXP: leveledUp ? getRequiredXpForLevel(newLevel) : getRequiredXpForLevel(user.userLevel) - user.xp,
            // Progress info
            progressId: progress._id,
            progressStatus: lessonStatus
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
 * Làm lại bài học kinh tế chính trị Mác-Lê-Nin
 * @param {string} userId - User ID
 * @param {string} lessonId - Lesson ID  
 * @param {string} pathId - Learning Path ID (optional)
 * @returns {Object} Retry result
 */
const retryMarxistLesson = async (userId, lessonId, pathId = null) => {
    try {
        const user = await User.findById(userId);
        const lesson = await Lesson.findById(lessonId);

        if (!user || !lesson) {
            return {
                success: false,
                statusCode: 404,
                message: "Không tìm thấy người dùng hoặc bài học",
            };
        }

        // Regenerate lives trước nếu cần
        await checkAndRegenerateLives(user);

        // Kiểm tra gói premium
        const now = moment().tz("Asia/Ho_Chi_Minh");
        const activePackage = await UserPackage.findOne({
            user: userId,
            isActive: true,
            endDate: { $gt: now.toDate() },
            paymentStatus: "completed",
        }).populate("package");

        const hasPremium = activePackage?.package?.features || {};
        const unlimitedLives = hasPremium.unlimitedLives || false;

        // Nếu không có quyền lợi lives không giới hạn thì phải kiểm tra
        if (!unlimitedLives && user.lives <= 0) {
            return {
                success: false,
                statusCode: 403,
                message: "Không đủ lượt chơi để làm lại. Hãy chờ lives hồi phục hoặc mua gói premium.",
                needsLives: true,
                currentLives: user.lives
            };
        }

        // Reset learning path về chưa hoàn thành nếu có pathId
        if (pathId) {
            await MarxistLearningPath.findByIdAndUpdate(pathId, {
                completed: false,
                achievedScore: null,
                completedAt: null
            });
        } else {
            // Nếu không có pathId, tìm path theo lessonId
            await MarxistLearningPath.findOneAndUpdate(
                { userId, lessonId },
                {
                    completed: false,
                    achievedScore: null,
                    completedAt: null
                }
            );
        }

        // Trừ lives nếu không phải là premium
        if (!unlimitedLives) {
            user.lives -= 1;
            user.lastLivesRegenerationTime = new Date();
            await user.save();
            console.log(`💔 Deducted 1 life for retry from user ${userId} (lives: ${user.lives})`);
        }

        return {
            success: true,
            statusCode: 200,
            message: unlimitedLives
                ? "Có thể làm lại bài học (Premium)"
                : `Có thể làm lại bài học. Lives còn lại: ${user.lives}`,
            livesDeducted: !unlimitedLives,
            currentLives: user.lives,
            canRetry: true
        };

    } catch (error) {
        console.error('Error retrying Marxist lesson:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi làm lại bài học: ' + error.message
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
    analyzeUserProgress,
    getMarxistLearningPath,
    completeMarxistLesson,
    retryMarxistLesson,
    getMarxistStats,
    getAllMarxistTopics
}; 