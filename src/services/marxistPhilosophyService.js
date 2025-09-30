import mongoose from "mongoose";
import geminiService from "./geminiService.js";
import multiAiService from "./multiAiService.js";
import aiGenerationQueue from "./aiGenerationQueue.js";
import Lesson from "../models/lesson.js";
import Question from "../models/question.js";
import MarxistLearningPath from "../models/marxistLearningPath.js";
import MarxistTopic from "../models/marxistTopic.js";
import User from "../models/user.js";
import Progress from "../models/progress.js";
import Level from "../models/level.js";
import Topic from "../models/topic.js";
import Skill from "../models/skill.js";
import NotificationService from "./notificationService.js";
import UserPackage from "../models/userPackage.js";
import moment from "moment-timezone";
import generationRateLimiter from "../middleware/rateLimiter.js";
import cacheService from "./cacheService.js";

// Import lives management từ lessonService
import { checkAndRegenerateLives } from "./lessonService.js";

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
// Flag để tránh tạo bài học khi đang trong background generation
const backgroundGeneratingUsers = new Set();

// ⚡ PERFORMANCE: In-memory cache for frequently accessed data
const memoryCache = {
  userProgress: new Map(), // Cache user progress analysis
  topicSelections: new Map(), // Cache recent topic selections

  // Cache with TTL
  set(key, value, ttlSeconds = 300) {
    this[key] = {
      data: value,
      expires: Date.now() + (ttlSeconds * 1000)
    };
  },

  get(key) {
    const cached = this[key];
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    delete this[key];
    return null;
  }
};

// Hàm lấy tất cả chủ đề Marxist từ database (với caching)
const getAllMarxistTopics = async () => {
  try {
    return await cacheService.getOrSetMarxistTopics(async () => {
      const topics = await MarxistTopic.find({ isActive: true }).sort({
        displayOrder: 1,
        createdAt: 1,
      });
      console.log(`📚 Loaded ${topics.length} Marxist topics from database`);
      return topics;
    });
  } catch (error) {
    console.error("Error getting Marxist topics:", error);
    return [];
  }
};

/**
 * Lấy thứ tự tiếp theo cho lộ trình học Marxist
 * @param {string} userId - User ID
 * @returns {number} Order number
 */
const getNextMarxistOrder = async (userId) => {
  const lastPath = await MarxistLearningPath.findOne({ userId }).sort({
    order: -1,
  });
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
      .populate("lessonId");

    if (recentPaths.length === 0) {
      // User mới, lấy chủ đề đầu tiên từ database
      const allTopics = await getAllMarxistTopics();
      const firstTopic = allTopics.length > 0 ? allTopics[0]._id : null;

      if (!firstTopic) {
        throw new Error("Không có chủ đề Marxist nào trong database");
      }

      return {
        recommendedTopic: firstTopic,
        difficultyLevel: allTopics[0].suggestedDifficulty || 1,
        reason: "Người học mới bắt đầu với triết học Mác-Lê-Nin",
      };
    }

    // Tính điểm trung bình
    const completedPaths = recentPaths.filter(
      (path) => path.completed && path.achievedScore !== null
    );
    let averageScore = 0;

    if (completedPaths.length > 0) {
      averageScore =
        completedPaths.reduce((sum, path) => sum + path.achievedScore, 0) /
        completedPaths.length;
    }

    // Xác định độ khó tiếp theo
    let newDifficulty = 1;
    if (averageScore >= 90)
      newDifficulty = Math.min(5, recentPaths[0].difficultyLevel + 1);
    else if (averageScore >= 80) newDifficulty = recentPaths[0].difficultyLevel;
    else if (averageScore >= 70)
      newDifficulty = Math.max(1, recentPaths[0].difficultyLevel - 1);
    else newDifficulty = Math.max(1, recentPaths[0].difficultyLevel - 2);

    // Xác định chủ đề tiếp theo
    const studiedTopicIds = recentPaths.map((path) =>
      path.marxistTopic.toString()
    );
    const allTopics = await getAllMarxistTopics();
    const unstudiedTopics = allTopics.filter(
      (topic) => !studiedTopicIds.includes(topic._id.toString())
    );

    let recommendedTopic;
    if (unstudiedTopics.length > 0) {
      // Chọn chủ đề chưa học
      recommendedTopic = unstudiedTopics[0]._id;
    } else {
      // Ôn lại chủ đề yếu nhất
      const weakestTopic =
        completedPaths.length > 0
          ? completedPaths.reduce((weakest, current) =>
            !weakest || current.achievedScore < weakest.achievedScore
              ? current
              : weakest
          )
          : null;
      recommendedTopic = weakestTopic
        ? weakestTopic.marxistTopic
        : allTopics[0]._id;
    }

    return {
      recommendedTopic,
      difficultyLevel: newDifficulty,
      previousScore: Math.round(averageScore),
      reason: `Dựa trên kết quả ${completedPaths.length
        } bài học gần nhất (điểm TB: ${Math.round(averageScore)})`,
    };
  } catch (error) {
    console.error("Error analyzing user progress:", error);
    const allTopics = await getAllMarxistTopics();
    const firstTopic = allTopics.length > 0 ? allTopics[0]._id : null;

    return {
      recommendedTopic: firstTopic,
      difficultyLevel: 1,
      reason: "Lỗi phân tích, bắt đầu với chủ đề cơ bản",
    };
  }
};

/**
 * Generate câu hỏi về triết học Mác-Lê-Nin với Rate Limiting
 * @param {string} userId - User ID
 * @param {Object} options - Generation options
 * @returns {Object} Generated lesson
 */
const generateMarxistLesson = async (userId, options = {}) => {
  console.log(`🚀 Request to generate Marxist lesson for user ${userId}`);

  // Kiểm tra xem có đang trong background generation không
  if (backgroundGeneratingUsers.has(userId)) {
    console.log(`⏳ User ${userId} is in background generation, skipping manual generation...`);
    return {
      success: false,
      statusCode: 429,
      message: "Hệ thống đang tạo bài học tự động, vui lòng chờ...",
    };
  }

  // ⚡ PERFORMANCE: Use queue system to manage concurrent AI generations
  try {
    return await aiGenerationQueue.add(async () => {
      return await generationRateLimiter.requestGeneration(userId, async () => {
        return await _generateMarxistLessonInternal(userId, options);
      });
    }, userId);
  } catch (rateLimitError) {
    console.warn(
      `⚠️ Rate limit error for user ${userId}:`,
      rateLimitError.message
    );
    return rateLimitError;
  }
};

/**
 * Internal function để generate lesson (được gọi bởi rate limiter)
 * @param {string} userId - User ID
 * @param {Object} options - Generation options
 * @returns {Object} Generated lesson
 */
const _generateMarxistLessonInternal = async (userId, options = {}) => {
  try {
    console.log(`🔄 Generating lesson for user ${userId} (within rate limit)`);

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // ⚡ PERFORMANCE: Cache user progress analysis với caching thông minh
    const progressCacheKey = `user_progress_${userId}`;
    let analysis = memoryCache.get(progressCacheKey);

    if (!analysis) {
      analysis = await cacheService.getOrSetUserProgress(
        userId,
        async (userId) => {
          return await analyzeUserProgress(userId);
        }
      );
      // Cache trong memory cho 2 phút để tránh re-calculate quá nhiều
      memoryCache.set(progressCacheKey, analysis, 120);
    } else {
      console.log(`⚡ Using cached progress analysis for user ${userId}`);
    }

    let topicId = options.topic;
    let difficulty = options.difficulty;

    // Luôn random topic thay vì dùng recommended (trừ khi có topic cụ thể)
    if (!topicId) {
      const allTopics = await getAllMarxistTopics();
      if (allTopics.length > 0) {
        const randomTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
        topicId = randomTopic._id;
        console.log(`🎲 Random selected topic: ${randomTopic.title || randomTopic.name}`);
      } else {
        topicId = analysis.recommendedTopic; // Fallback
      }
    }

    // Nếu không có difficulty, dùng từ analysis
    if (!difficulty) {
      difficulty = analysis.difficultyLevel;
    }

    // Nếu topicId là string name, tìm topic trong database
    let topicInfo;
    if (typeof topicId === "string" && !topicId.match(/^[0-9a-fA-F]{24}$/)) {
      topicInfo = await MarxistTopic.findOne({ name: topicId, isActive: true });
      if (!topicInfo) {
        return {
          success: false,
          statusCode: 400,
          message: `Không tìm thấy chủ đề với name: ${topicId}`,
        };
      }
      topicId = topicInfo._id;
    } else {
      topicInfo = await MarxistTopic.findById(topicId);
      if (!topicInfo || !topicInfo.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Chủ đề không hợp lệ hoặc không hoạt động",
        };
      }
    }

    // Xây dựng prompt cho Multi-AI
    const contentHints = options.contentHints || null;
    const hintsText = contentHints
      ? `\n\nCơ sở tạo câu hỏi (tóm tắt trước khi ôn):\n- Tiêu đề: ${contentHints.title || topicInfo.title}\n- Tóm tắt: ${contentHints.summary || ""}\n- Key points: ${(contentHints.keyPoints || []).join(", ")}`
      : "";

    // Sử dụng contentHints title nếu có, nếu không thì dùng topicInfo.title
    const finalTitle = contentHints?.title || topicInfo.title;
    const finalDescription = contentHints?.summary || topicInfo.description;

    const prompt = `
Bạn là chuyên gia về TRIẾT HỌC Mác-Lê-Nin. Hãy tạo 10 câu hỏi trắc nghiệm về chủ đề "${finalTitle}" với độ khó cấp độ ${difficulty}/5.${hintsText}

⚠️ QUAN TRỌNG: CHỈ TẬP TRUNG VÀO TRIẾT HỌC MÁC-LÊ-NIN, KHÔNG PHẢI KINH TẾ CHÍNH TRỊ!
🎯 TITLE PHẢI LÀ: "${finalTitle}" - KHÔNG ĐƯỢC THAY ĐỔI!

Chủ đề: ${finalTitle}
Mô tả: ${finalDescription}
Từ khóa quan trọng: ${topicInfo.keywords.join(", ")}

Yêu cầu:
- Đúng 10 câu hỏi trắc nghiệm (multiple choice)
- Mỗi câu có 4 đáp án (A, B, C, D)
- Nội dung CHỈ VỀ TRIẾT HỌC Mác-Lê-Nin (duy vật biện chứng, nhận thức luận, quy luật triết học)
- KHÔNG hỏi về kinh tế, giá trị thặng dư, tư bản, bóc lột
- Độ khó phù hợp với cấp độ ${difficulty}
- Câu hỏi về: quy luật, phương pháp luận, nhận thức, thực tiễn, ý thức
- Thời gian làm mỗi câu: 30 giây

🚨 YÊU CẦU CỰC KỲ QUAN TRỌNG VỀ PHÂN BỐ ĐÁP ÁN:
❌ TUYỆT ĐỐI KHÔNG được tạo tất cả câu hỏi có cùng đáp án đúng (ví dụ: tất cả đều A)
❌ KHÔNG được có hơn 4 câu cùng đáp án đúng
✅ BẮT BUỘC: Phân bố đáp án đúng đều giữa A, B, C, D
✅ Ví dụ phân bố ĐÚNG: A:3 câu, B:2 câu, C:3 câu, D:2 câu
✅ Hoặc: A:2 câu, B:3 câu, C:2 câu, D:3 câu
✅ Đáp án dựa trên KIẾN THỨC CHÍNH XÁC của triết học Mác-Lê-Nin

🔍 KIỂM TRA TRƯỚC KHI TRẢ VỀ:
1. Đếm số câu có đáp án A, B, C, D
2. Đảm bảo không có đáp án nào quá 4 câu
3. Đảm bảo phân bố tương đối đều (sai lệch không quá 2 câu)

⚠️ CHỈ trả về kết quả ở định dạng JSON. KHÔNG thêm bất kỳ dòng chữ nào trước/sau.

{
  "title": "${finalTitle}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Nội dung câu hỏi...",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A",
      "score": 10,
      "timeLimit": 30
    }
  ]
}`;

    // Khai báo lessonData variable
    let lessonData;

    console.log(
      "🔄 Generating Marxist lesson with Multi-AI (optimized for speed)..."
    );
    const aiResult = await multiAiService.generateJsonContent(prompt, {
      strategy: "weighted", // Load balance between providers
      maxRetries: 2, // ⚡ Reduce retries for speed
      maxProviderRetries: 2, // ⚡ Reduce provider retries
      timeout: 45000, // ⚡ 45s timeout instead of default
    });

    if (!aiResult.success) {
      // Nếu tất cả AI APIs thất bại, return error để FE có thể retry
      console.error("❌ All AI APIs failed!");
      console.log("AI failure details:", aiResult.loadBalancer);

      return {
        success: false,
        statusCode: 503,
        message: "Tất cả AI APIs đều thất bại. Vui lòng thử lại sau hoặc nhấn nút tạo bài học mới.",
        error: "AI_GENERATION_FAILED",
        retryable: true
      };
    }

    lessonData = aiResult.data;
    console.log(
      `✅ Using AI-generated lesson data from ${aiResult.provider}`
    );

    // Log load balancer stats
    if (aiResult.loadBalancer) {
      console.log("📊 Load balancer stats:", {
        provider: aiResult.provider,
        strategy: aiResult.loadBalancer.strategy,
        totalProviders: aiResult.loadBalancer.totalProviders,
      });
    }

    // Validate lesson data
    if (!lessonData || !lessonData.questions) {
      console.error("❌ Invalid lesson data:", lessonData);
      return {
        success: false,
        statusCode: 500,
        message: "Lesson data không hợp lệ",
      };
    }

    console.log(`📊 Lesson data: ${lessonData.questions.length} questions`);

    // Validate số lượng câu hỏi (flexible cho demo)
    if (lessonData.questions.length === 0) {
      return {
        success: false,
        statusCode: 500,
        message: "Không có câu hỏi nào trong bài học",
      };
    }

    // Warn nếu không phải 10 câu nhưng vẫn cho phép tạo
    if (lessonData.questions.length !== 10) {
      console.warn(
        `⚠️ Expected 10 questions, got ${lessonData.questions.length}`
      );
    }

    // ⚡ PERFORMANCE: Parallel find/create Topic, Level, Skill with caching
    console.log("📋 Finding or creating Topic, Level, Skill (parallel)...");

    const [topicDoc, levelDoc, skillDoc] = await Promise.all([
      // Topic - cache this
      cacheService.getOrSet('marxist_topic_doc', async () => {
        let doc = await Topic.findOne({ name: "Marxist Philosophy" });
        if (!doc) {
          console.log("🔧 Creating Marxist Philosophy topic...");
          doc = await Topic.create({
            name: "Marxist Philosophy",
            description: "Triết học Mác-Lê-Nin: duy vật biện chứng, nhận thức luận, quy luật triết học",
            isActive: true,
          });
        }
        return doc;
      }, 300), // Cache 5 minutes

      // Level - cache this  
      cacheService.getOrSet('marxist_level_doc', async () => {
        let doc = await Level.findOne({ name: "marxist_intermediate" });
        if (!doc) {
          console.log("🔧 Creating marxist_intermediate level...");
          const lastLevel = await Level.findOne().sort({ order: -1 });
          const nextOrder = lastLevel ? lastLevel.order + 1 : 1;

          doc = await Level.create({
            name: "marxist_intermediate",
            description: "Trình độ trung cấp Marxist",
            order: nextOrder,
            minScoreRequired: 70,
            minUserLevel: 1,
            minLessonPassed: 0,
            maxScore: 100,
            timeLimit: 300,
            isActive: true,
          });
          console.log(`✅ Created level with order: ${nextOrder}`);
        }
        return doc;
      }, 300), // Cache 5 minutes

      // Skill - cache this
      cacheService.getOrSet('marxist_skill_doc', async () => {
        let doc = await Skill.findOne({ name: "marxist_philosophy" });
        if (!doc) {
          console.log("🔧 Creating marxist_philosophy skill...");
          doc = await Skill.create({
            name: "marxist_philosophy",
            description: "Triết học Mác-Lê-Nin: phương pháp luận, nhận thức luận, quy luật biện chứng",
            supportedTypes: ["multiple_choice"],
            isActive: true,
          });
        }
        return doc;
      }, 300) // Cache 5 minutes
    ]);

    // Validate tất cả đều tồn tại
    if (!topicDoc || !levelDoc || !skillDoc) {
      console.error("❌ Failed to create required models:", {
        topicDoc: !!topicDoc,
        levelDoc: !!levelDoc,
        skillDoc: !!skillDoc,
      });
      return {
        success: false,
        statusCode: 500,
        message: "Không thể tạo Topic, Level, hoặc Skill cần thiết",
      };
    }

    console.log("✅ Topic, Level, Skill ready:", {
      topic: topicDoc.name,
      level: levelDoc.name,
      skill: skillDoc.name,
    });

    // ✅ IMPROVED: Better validation for correct answers
    const normalizeCorrectAnswer = (question, questionIndex) => {
      try {
        const options = Array.isArray(question.options) ? question.options : [];
        let answer = question.correctAnswer;

        console.log(`🔍 Question ${questionIndex + 1}: "${question.content?.substring(0, 50)}..."`);
        console.log(`🎯 AI provided answer: "${answer}"`);
        console.log(`📝 Available options:`, options);

        if (!options.length) {
          console.warn(`⚠️ Question ${questionIndex + 1}: No options available!`);
          return question.correctAnswer;
        }

        // Nếu answer là số (1-4)
        if (typeof answer === "number") {
          const idx = Math.max(0, Math.min(options.length - 1, answer - 1));
          const normalizedAnswer = options[idx];
          console.log(`🔢 Normalized from number ${answer} to: "${normalizedAnswer}"`);
          return normalizedAnswer;
        }

        if (typeof answer === "string") {
          const trimmed = answer.trim();

          // ✅ PRIORITY 1: Exact match first (most reliable)
          const exactMatch = options.find((opt) => opt === trimmed);
          if (exactMatch) {
            console.log(`✅ Exact match found: "${exactMatch}"`);
            return exactMatch;
          }

          // ✅ PRIORITY 2: Letter match (A, B, C, D)
          const letterMatch = trimmed.match(/^[A-Da-d]$/);
          if (letterMatch) {
            const idx = trimmed.toUpperCase().charCodeAt(0) - 65; // A->0
            if (idx >= 0 && idx < options.length) {
              const normalizedAnswer = options[idx];
              console.log(`🔤 Letter match ${trimmed.toUpperCase()} -> "${normalizedAnswer}"`);
              return normalizedAnswer;
            }
          }

          // ✅ PRIORITY 3: Prefix match (A., A), etc.)
          const letterPrefix = trimmed.match(/^([A-Da-d])[\.)\-\s]/);
          if (letterPrefix) {
            const idx = letterPrefix[1].toUpperCase().charCodeAt(0) - 65;
            if (idx >= 0 && idx < options.length) {
              const normalizedAnswer = options[idx];
              console.log(`🏷️ Prefix match ${letterPrefix[1]} -> "${normalizedAnswer}"`);
              return normalizedAnswer;
            }
          }

          // ✅ PRIORITY 4: Content matching (remove prefix and compare)
          const normalizeText = (s) => String(s).replace(/^\s*[A-Da-d][\.)\-]\s*/, "").trim().toLowerCase();
          const normalizedAnswerText = normalizeText(trimmed);

          const contentMatch = options.find((opt) => {
            const normalizedOpt = normalizeText(opt);
            return normalizedOpt === normalizedAnswerText;
          });

          if (contentMatch) {
            console.log(`📄 Content match found: "${contentMatch}"`);
            return contentMatch;
          }

          // ⚠️ WARNING: No match found
          console.warn(`⚠️ Question ${questionIndex + 1}: No match found for answer "${trimmed}"`);
          console.warn(`🤔 Available options:`, options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`));
        }

        // ❌ FALLBACK: Return first option but log warning
        console.warn(`❌ Question ${questionIndex + 1}: Using fallback (first option)`);
        return options[0];
      } catch (e) {
        console.error(`💥 Error normalizing answer for question ${questionIndex + 1}:`, e.message);
        return question.correctAnswer;
      }
    };

    const processedQuestions = lessonData.questions.map((q, index) => {
      const normalized = {
        ...q,
        type: "multiple_choice",
        timeLimit: 30,
        score: 100,
      };

      const normalizedAnswer = normalizeCorrectAnswer(normalized, index);

      return {
        ...normalized,
        skill: skillDoc._id,
        correctAnswer: normalizedAnswer,
      };
    });

    console.log("🔍 VALIDATION: Checking all processed questions for correctness...");

    // ✅ ADD: Detailed validation for each question
    const questionValidationIssues = [];
    processedQuestions.forEach((q, index) => {
      const options = q.options || [];
      const correctAnswer = q.correctAnswer;

      // Check if correctAnswer exists in options
      const answerExists = options.includes(correctAnswer);

      if (!answerExists) {
        questionValidationIssues.push({
          questionIndex: index + 1,
          content: q.content?.substring(0, 50) + "...",
          correctAnswer,
          options,
          issue: "Correct answer not found in options"
        });
      }

      console.log(`Question ${index + 1}: ✅ Answer "${correctAnswer}" ${answerExists ? 'EXISTS' : '❌ NOT FOUND'} in options`);
    });

    // ⚠️ Log validation issues
    if (questionValidationIssues.length > 0) {
      console.warn(`⚠️ FOUND ${questionValidationIssues.length} VALIDATION ISSUES:`);
      questionValidationIssues.forEach(issue => {
        console.warn(`❌ Question ${issue.questionIndex}: ${issue.issue}`);
        console.warn(`   Content: ${issue.content}`);
        console.warn(`   Correct Answer: "${issue.correctAnswer}"`);
        console.warn(`   Options:`, issue.options);
      });

      // ❌ STRICT MODE: Return error if any validation fails
      return {
        success: false,
        statusCode: 400,
        message: `AI generated invalid questions: ${questionValidationIssues.length} questions have incorrect answer mapping`,
        validationIssues: questionValidationIssues,
        retryable: true
      };
    }

    // 🔥 NEW: Check for answer distribution concentration (main fix)
    console.log("🎯 CHECKING ANSWER DISTRIBUTION for concentration...");

    const validateAnswerConcentration = (questions) => {
      const distribution = { A: 0, B: 0, C: 0, D: 0, Unknown: 0 };

      questions.forEach(q => {
        const answer = q.correctAnswer || "";
        const match = answer.match(/^([A-Da-d])/);
        const letter = match ? match[1].toUpperCase() : "Unknown";

        if (distribution[letter] !== undefined) {
          distribution[letter]++;
        } else {
          distribution.Unknown++;
        }
      });

      console.log(`📊 Answer Distribution: A=${distribution.A}, B=${distribution.B}, C=${distribution.C}, D=${distribution.D}, Unknown=${distribution.Unknown}`);

      // 🚨 CRITICAL: Check for concentration issues
      const totalQuestions = questions.length;
      const maxCount = Math.max(distribution.A, distribution.B, distribution.C, distribution.D);
      const minCount = Math.min(distribution.A, distribution.B, distribution.C, distribution.D);

      // Issues to check:
      const issues = [];

      // 1. Too concentrated on one answer (e.g., all 10 questions are A)
      if (maxCount >= 7) {
        const dominantLetter = Object.keys(distribution).find(key => distribution[key] === maxCount);
        issues.push(`Too concentrated: ${maxCount}/${totalQuestions} questions have answer ${dominantLetter}`);
      }

      // 2. All answers are the same (worst case)
      if (maxCount === totalQuestions) {
        const dominantLetter = Object.keys(distribution).find(key => distribution[key] === maxCount);
        issues.push(`CRITICAL: All ${totalQuestions} questions have the same answer ${dominantLetter}!`);
      }

      // 3. Too uneven distribution
      if (maxCount - minCount > 5) {
        issues.push(`Too uneven: difference between max (${maxCount}) and min (${minCount}) is ${maxCount - minCount}`);
      }

      // 4. Unknown/invalid answers
      if (distribution.Unknown > 0) {
        issues.push(`${distribution.Unknown} questions have invalid answer format`);
      }

      const isValid = issues.length === 0;

      return {
        isValid,
        distribution,
        issues,
        maxCount,
        minCount,
        totalQuestions
      };
    };

    // Run concentration validation
    const concentrationCheck = validateAnswerConcentration(processedQuestions);

    if (!concentrationCheck.isValid) {
      console.error(`🚨 ANSWER CONCENTRATION ISSUES DETECTED:`);
      concentrationCheck.issues.forEach(issue => {
        console.error(`   ❌ ${issue}`);
      });

      // 🔄 CRITICAL: Return error for concentration issues (AI needs retry)
      return {
        success: false,
        statusCode: 400,
        message: `AI generated poor answer distribution: ${concentrationCheck.issues.join(', ')}`,
        concentrationIssues: {
          distribution: concentrationCheck.distribution,
          issues: concentrationCheck.issues,
          severity: concentrationCheck.maxCount === concentrationCheck.totalQuestions ? 'CRITICAL' : 'HIGH'
        },
        retryable: true,
        error: "ANSWER_CONCENTRATION_FAILED"
      };
    }

    console.log("✅ Answer concentration validation passed!");
    console.log("✅ All validations passed - proceeding with lesson creation");

    // ✅ IMPROVED: Validate answer distribution and retry if needed
    console.log("🔍 Validating AI-generated answer distribution...");

    // Function to check if answer distribution is balanced
    const validateAnswerDistribution = (questions) => {
      const distribution = { A: 0, B: 0, C: 0, D: 0, Unknown: 0 };

      questions.forEach(q => {
        const answer = q.correctAnswer || "";
        const match = answer.match(/^([A-Da-d])/);
        const letter = match ? match[1].toUpperCase() : "Unknown";

        if (distribution[letter] !== undefined) {
          distribution[letter]++;
        } else {
          distribution.Unknown++;
        }
      });

      // Check validation criteria
      const maxCount = Math.max(distribution.A, distribution.B, distribution.C, distribution.D);
      const minCount = Math.min(distribution.A, distribution.B, distribution.C, distribution.D);
      const hasUnknown = distribution.Unknown > 0;
      const tooConcentrated = maxCount > 4; // Không được quá 4 câu cùng đáp án
      const tooUneven = maxCount - minCount > 3; // Chênh lệch không quá 3

      console.log(`📊 Distribution: A=${distribution.A}, B=${distribution.B}, C=${distribution.C}, D=${distribution.D}, Unknown=${distribution.Unknown}`);

      const isValid = !hasUnknown && !tooConcentrated && !tooUneven;

      return {
        isValid,
        distribution,
        issues: [
          hasUnknown && "Some answers have invalid format",
          tooConcentrated && `Too concentrated: ${maxCount} questions have same answer`,
          tooUneven && `Too uneven: max-min difference is ${maxCount - minCount}`
        ].filter(Boolean)
      };
    };

    // Validate and log distribution
    const validation = validateAnswerDistribution(processedQuestions);

    if (validation.isValid) {
      console.log("✅ Answer distribution is well-balanced");
    } else {
      console.log("⚠️ Answer distribution issues:", validation.issues);
      console.log("📝 Proceeding anyway - may improve with more AI training");
    }

    // Tạo lesson
    console.log("📝 Creating lesson document...");
    const lesson = await Lesson.create({
      title: lessonData.title || `Bài học ${topicInfo.title}`,
      topic: topicDoc._id,
      level: levelDoc._id,
      skills: [skillDoc._id],
      maxScore: lessonData.questions.length * 100, // 100 điểm mỗi câu
      questions: [],
      isActive: true,
    });

    console.log("✅ Lesson created:", lesson._id);

    // ⚡ PERFORMANCE: Batch create questions instead of one-by-one
    console.log(`🔄 Batch creating ${processedQuestions.length} questions...`);

    // Prepare all question data for batch insert
    const questionsToInsert = processedQuestions.map(qData => ({
      lessonId: lesson._id,
      skill: qData.skill,
      type: qData.type,
      content: qData.content,
      options: qData.options || [],
      correctAnswer: qData.correctAnswer,
      score: qData.score || 100,
      timeLimit: qData.timeLimit || 30,
    }));

    try {
      // ⚡ Batch insert all questions at once
      const questions = await Question.insertMany(questionsToInsert, {
        ordered: true // Stop on first error
      });

      const questionIds = questions.map(q => q._id);
      console.log(`✅ Batch created ${questions.length} questions`);

      // ⚡ Update lesson with question IDs (single operation)
      lesson.questions = questionIds;
      await lesson.save();

    } catch (error) {
      console.error(`❌ Failed to batch create questions:`, error.message);
      // Rollback: delete the lesson if questions failed
      await Lesson.findByIdAndDelete(lesson._id);
      throw new Error(`Question creation failed: ${error.message}`);
    }

    // ⚡ PERFORMANCE: Parallel create learning path + update topic stats + send notification
    const pathOrder = await getNextMarxistOrder(userId);
    const questionIds = lesson.questions; // From batch creation above

    const [learningPath] = await Promise.all([
      // Create learning path
      MarxistLearningPath.create({
        userId: user._id,
        lessonId: lesson._id,
        source: "ai_generated_marxist",
        marxistTopic: topicId,
        difficultyLevel: difficulty,
        previousScore: analysis.previousScore || 0,
        recommendedReason: analysis.reason,
        order: pathOrder,
      }),

      // Update topic stats (don't wait for this)
      MarxistTopic.findByIdAndUpdate(topicId, {
        $inc: { totalLessonsGenerated: 1 },
      }).catch(err => console.warn('Topic stats update failed:', err.message)),

      // Send notification (don't wait for this)
      NotificationService.createNotification(userId, {
        title: "📚 Bài học Mác-Lê-Nin mới đã sẵn sàng!",
        message: `AI đã tạo bài học về "${topicInfo.title}" với ${questionIds.length} câu hỏi. Hãy vào học ngay!`,
        type: "ai_generated",
        link: "/philosophy",
      }).catch(err => console.warn('Notification failed:', err.message))
    ]);

    return {
      success: true,
      statusCode: 201,
      message: "Tạo bài học triết học Mác-Lê-Nin thành công",
      lesson: {
        lessonId: lesson._id,
        title: lesson.title,
        topic: topicInfo.title,
        difficultyLevel: difficulty,
        questionCount: questionIds.length,
        maxScore: lesson.maxScore,
        createdAt: lesson.createdAt,
      },
      learningPath: {
        pathId: learningPath._id,
        order: pathOrder,
        marxistTopic: {
          id: topicInfo._id,
          name: topicInfo.name,
          title: topicInfo.title,
        },
        recommendedReason: analysis.reason,
      },
    };
  } catch (error) {
    console.error("Error in _generateMarxistLessonInternal:", error);
    throw error; // Re-throw để rate limiter xử lý
  }
};

/**
 * Test answer distribution concentration specifically
 * @param {string} topicName - Topic name to test
 * @param {number} difficulty - Difficulty level (1-5)
 * @returns {Object} Test results focusing on answer distribution
 */
const testAnswerDistribution = async (topicName = "duy_vat_bien_chung", difficulty = 2) => {
  try {
    console.log(`🎯 Testing answer distribution for topic: ${topicName}, difficulty: ${difficulty}`);

    // Find topic
    const topicInfo = await MarxistTopic.findOne({ name: topicName, isActive: true });
    if (!topicInfo) {
      return {
        success: false,
        message: `Topic "${topicName}" not found`
      };
    }

    // Test multiple runs to check consistency
    const testRuns = [];
    const providers = ['gemini', 'grok4'];

    for (const provider of providers) {
      console.log(`🤖 Testing ${provider} for answer distribution...`);

      try {
        // Create stricter prompt focused on distribution
        const prompt = `
Bạn là chuyên gia về TRIẾT HỌC Mác-Lê-Nin. Tạo 5 câu hỏi trắc nghiệm về "${topicInfo.title}".

🚨 YÊU CẦU CỰC KỲ QUAN TRỌNG:
❌ TUYỆT ĐỐI KHÔNG được tạo tất cả câu có cùng đáp án đúng
✅ BẮT BUỘC: Phân bố đáp án A, B, C, D đều nhau
✅ Ví dụ: Câu 1: A đúng, Câu 2: B đúng, Câu 3: C đúng, Câu 4: D đúng, Câu 5: A đúng

{
  "title": "${topicInfo.title}",
  "questions": [
    {
      "content": "Câu hỏi...",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A"
    }
  ]
}`;

        const result = await multiAiService.generateJsonContent(prompt, {
          preferredProvider: provider,
          maxRetries: 1
        });

        if (result.success && result.data?.questions) {
          // Analyze distribution
          const distribution = { A: 0, B: 0, C: 0, D: 0, Unknown: 0 };

          result.data.questions.forEach(q => {
            const answer = q.correctAnswer || "";
            const match = answer.match(/^([A-Da-d])/);
            const letter = match ? match[1].toUpperCase() : "Unknown";

            if (distribution[letter] !== undefined) {
              distribution[letter]++;
            } else {
              distribution.Unknown++;
            }
          });

          const totalQuestions = result.data.questions.length;
          const maxCount = Math.max(distribution.A, distribution.B, distribution.C, distribution.D);
          const isConcentrated = maxCount >= Math.ceil(totalQuestions * 0.7); // 70% threshold
          const isAllSame = maxCount === totalQuestions;

          testRuns.push({
            provider,
            success: true,
            questionCount: totalQuestions,
            distribution,
            maxCount,
            isConcentrated,
            isAllSame,
            concentrationPercentage: Math.round((maxCount / totalQuestions) * 100),
            issues: [
              isAllSame && `ALL ${totalQuestions} questions have same answer`,
              isConcentrated && `${maxCount}/${totalQuestions} (${Math.round((maxCount / totalQuestions) * 100)}%) questions have same answer`,
              distribution.Unknown > 0 && `${distribution.Unknown} questions have invalid answers`
            ].filter(Boolean)
          });

          console.log(`${provider} result:`, {
            distribution,
            concentrated: isConcentrated,
            allSame: isAllSame
          });

        } else {
          testRuns.push({
            provider,
            success: false,
            error: result.error || 'Generation failed'
          });
        }

      } catch (error) {
        testRuns.push({
          provider,
          success: false,
          error: error.message
        });
      }
    }

    // Analyze results
    const analysis = {
      totalRuns: testRuns.length,
      successfulRuns: testRuns.filter(r => r.success).length,
      concentrationIssues: testRuns.filter(r => r.success && r.isConcentrated).length,
      criticalIssues: testRuns.filter(r => r.success && r.isAllSame).length,
      bestProvider: null,
      worstProvider: null
    };

    // Find best and worst providers
    const successfulRuns = testRuns.filter(r => r.success);
    if (successfulRuns.length > 0) {
      analysis.bestProvider = successfulRuns.reduce((best, current) =>
        !best || current.maxCount < best.maxCount ? current : best
      ).provider;

      analysis.worstProvider = successfulRuns.reduce((worst, current) =>
        !worst || current.maxCount > worst.maxCount ? current : worst
      ).provider;
    }

    return {
      success: true,
      topic: {
        name: topicInfo.name,
        title: topicInfo.title
      },
      testRuns,
      analysis,
      recommendations: {
        preferredProvider: analysis.bestProvider,
        issues: analysis.concentrationIssues > 0 ?
          `${analysis.concentrationIssues}/${analysis.totalRuns} runs had concentration issues` :
          'No concentration issues detected',
        criticalIssues: analysis.criticalIssues > 0 ?
          `${analysis.criticalIssues}/${analysis.totalRuns} runs had ALL SAME ANSWER issue` :
          'No critical issues detected'
      }
    };

  } catch (error) {
    console.error("Error testing answer distribution:", error);
    return {
      success: false,
      message: "Test failed: " + error.message
    };
  }
};

/**
 * Test AI generation accuracy and validate answers
 * @param {string} topicName - Topic name to test
 * @param {number} difficulty - Difficulty level (1-5)
 * @returns {Object} Test results
 */
const testAiGenerationAccuracy = async (topicName = "duy_vat_bien_chung", difficulty = 2) => {
  try {
    console.log(`🧪 Testing AI generation accuracy for topic: ${topicName}, difficulty: ${difficulty}`);

    // Find topic
    const topicInfo = await MarxistTopic.findOne({ name: topicName, isActive: true });
    if (!topicInfo) {
      return {
        success: false,
        message: `Topic "${topicName}" not found`
      };
    }

    // Create test prompt
    const prompt = `
Bạn là chuyên gia về TRIẾT HỌC Mác-Lê-Nin. Hãy tạo 3 câu hỏi trắc nghiệm về chủ đề "${topicInfo.title}" với độ khó cấp độ ${difficulty}/5.

⚠️ QUAN TRỌNG: CHỈ TẬP TRUNG VÀO TRIẾT HỌC MÁC-LÊ-NIN, KHÔNG PHẢI KINH TẾ CHÍNH TRỊ!

Chủ đề: ${topicInfo.title}
Mô tả: ${topicInfo.description}
Từ khóa quan trọng: ${topicInfo.keywords.join(", ")}

Yêu cầu:
- Đúng 3 câu hỏi trắc nghiệm (multiple choice) 
- Mỗi câu có 4 đáp án (A, B, C, D)
- Nội dung CHỈ VỀ TRIẾT HỌC Mác-Lê-Nin (duy vật biện chứng, nhận thức luận, quy luật triết học)
- KHÔNG hỏi về kinh tế, giá trị thặng dư, tư bản, bóc lột
- Độ khó phù hợp với cấp độ ${difficulty}
- Đáp án đúng phải DỰA VÀO KIẾN THỨC CHÍNH XÁC của triết học Mác-Lê-Nin

⚠️ CHỈ trả về kết quả ở định dạng JSON. KHÔNG thêm bất kỳ dòng chữ nào trước/sau.

{
  "title": "${topicInfo.title}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Nội dung câu hỏi...", 
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A",
      "explanation": "Giải thích chi tiết tại sao đáp án này đúng..."
    }
  ]
}`;

    // Test with multiple AI providers
    const results = {};

    // Test Gemini
    try {
      console.log("🤖 Testing with Gemini...");
      const geminiResult = await multiAiService.generateJsonContent(prompt, {
        preferredProvider: "gemini"
      });
      results.gemini = geminiResult;
    } catch (error) {
      results.gemini = { success: false, error: error.message };
    }

    // Test Grok4 
    try {
      console.log("🤖 Testing with Grok4...");
      const grokResult = await multiAiService.generateJsonContent(prompt, {
        preferredProvider: "grok4"
      });
      results.grok4 = grokResult;
    } catch (error) {
      results.grok4 = { success: false, error: error.message };
    }

    // Analyze results
    const analysis = {
      totalProviders: Object.keys(results).length,
      successfulProviders: 0,
      questionAnalysis: {},
      validationIssues: []
    };

    Object.entries(results).forEach(([provider, result]) => {
      if (result.success && result.data?.questions) {
        analysis.successfulProviders++;

        console.log(`\n🔍 Analyzing ${provider} results:`);

        result.data.questions.forEach((q, index) => {
          const questionKey = `question_${index + 1}`;
          if (!analysis.questionAnalysis[questionKey]) {
            analysis.questionAnalysis[questionKey] = {
              content: q.content?.substring(0, 100) + "...",
              providerAnswers: {},
              options: q.options
            };
          }

          // Store this provider's answer
          analysis.questionAnalysis[questionKey].providerAnswers[provider] = {
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          };

          // Validate answer exists in options
          const answerExists = q.options?.includes(q.correctAnswer);
          if (!answerExists) {
            analysis.validationIssues.push({
              provider,
              questionIndex: index + 1,
              issue: "Correct answer not found in options",
              correctAnswer: q.correctAnswer,
              options: q.options
            });
          }

          console.log(`  Question ${index + 1}: "${q.content?.substring(0, 50)}..."`);
          console.log(`  Correct Answer: "${q.correctAnswer}" ${answerExists ? '✅' : '❌'}`);
          console.log(`  Options:`, q.options);
          if (q.explanation) {
            console.log(`  Explanation: ${q.explanation.substring(0, 100)}...`);
          }
        });
      }
    });

    return {
      success: true,
      topic: {
        name: topicInfo.name,
        title: topicInfo.title
      },
      difficulty,
      results,
      analysis,
      summary: {
        totalProviders: analysis.totalProviders,
        successfulProviders: analysis.successfulProviders,
        totalValidationIssues: analysis.validationIssues.length,
        recommendedProvider: analysis.successfulProviders > 0 ?
          Object.keys(results).find(p => results[p].success && analysis.validationIssues.filter(v => v.provider === p).length === 0) ||
          Object.keys(results).find(p => results[p].success) : null
      }
    };

  } catch (error) {
    console.error("Error testing AI generation accuracy:", error);
    return {
      success: false,
      message: "Test failed: " + error.message
    };
  }
};

/**
 * Get generation performance statistics
 * @returns {Object} Performance stats
 */
const getGenerationStats = async () => {
  try {
    // Get queue stats
    const queueStats = aiGenerationQueue.getStats();

    // Get multi-AI stats
    const multiAiStats = multiAiService.getStats();

    // Get cache stats
    const cacheStats = cacheService.getStats();

    // Get recent generation performance from database
    const recentLessons = await Lesson.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).select('createdAt title').sort({ createdAt: -1 }).limit(50);

    const recentPaths = await MarxistLearningPath.find({
      generatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours  
    }).select('generatedAt userId difficultyLevel').sort({ generatedAt: -1 }).limit(100);

    return {
      success: true,
      queue: {
        ...queueStats,
        description: "AI Generation Queue Performance"
      },
      multiAi: {
        ...multiAiStats,
        description: "Multi-AI Load Balancer Stats"
      },
      cache: {
        ...cacheStats,
        description: "Cache Performance Stats"
      },
      database: {
        recentLessons: recentLessons.length,
        recentPaths: recentPaths.length,
        description: "Database Activity (24h)"
      },
      performance: {
        averageGeneration: queueStats.averageProcessingTime || 0,
        queueWaitTime: queueStats.averageWaitTime || 0,
        cacheHitRate: cacheStats.hitRate || 0,
        description: "Overall Performance Metrics"
      }
    };
  } catch (error) {
    console.error("Error getting generation stats:", error);
    return {
      success: false,
      error: error.message
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

    // ❌ REMOVED: Auto-generation moved to client-side to prevent duplicate lessons
    // Client should explicitly call POST /marxist-philosophy/generate-lesson when needed
    if (total === 0) {
      console.log(
        "📋 User mới chưa có bài học Marxist. Client cần gọi generate-lesson API."
      );

      // Kiểm tra xem có topic nào trong database không
      const availableTopics = await getAllMarxistTopics();
      if (availableTopics.length === 0) {
        return {
          success: false,
          statusCode: 500,
          message:
            "Không có chủ đề Marxist nào trong database. Admin cần seed dữ liệu trước.",
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
        availableTopics: availableTopics.length,
      };
    }

    // Lấy dữ liệu lộ trình
    const pathDocs = await MarxistLearningPath.find({ userId })
      .populate({
        path: "lessonId",
        populate: ["topic", "level"],
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
    const learningPath = pathDocs.map((doc) => {
      const lesson = doc.lessonId;
      // ✅ NEW: Use MarxistLearningPath.completed field directly
      const isCompleted = doc.completed || false; // Use doc.completed from MarxistLearningPath
      const marxistTopic = doc.marxistTopic;

      return {
        pathId: doc._id,
        lessonId: lesson?._id,
        title: lesson?.title || "Không có tiêu đề",
        marxistTopic: {
          id: marxistTopic?._id,
          name: marxistTopic?.name || "unknown",
          title: marxistTopic?.title || "Không xác định",
          description: marxistTopic?.description || "",
        },
        difficultyLevel: doc.difficultyLevel,
        recommendedReason: doc.recommendedReason,
        previousScore: doc.previousScore,
        order: doc.order,
        completed: isCompleted, // ✅ Now uses MarxistLearningPath.completed
        achievedScore: doc.achievedScore,
        completedAt: doc.completedAt,
        status: isCompleted ? "COMPLETE" : "LOCKED",
        createdAt: doc.generatedAt,
      };
    });

    return {
      success: true,
      statusCode: 200,
      message: "Lấy lộ trình học Marxist thành công",
      learningPath,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        pageSize: limit,
      },
    };
  } catch (error) {
    console.error("Error getting Marxist learning path:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy lộ trình học: " + error.message,
    };
  }
};

/**
 * Hoàn thành bài học triết học Mác-Lê-Nin với lives system
 * @param {string} userId - User ID  
 * @param {string} lessonId - Lesson ID
 * @param {number} score - Điểm số (0-100)
 * @param {Array} questionResults - Kết quả từng câu hỏi (optional)
 * @returns {Object} Completion result
 */
const completeMarxistLesson = async (
  userId,
  lessonId,
  score,
  questionResults = []
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
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
          message:
            "Không đủ lượt chơi. Hãy chờ lives hồi phục hoặc mua gói premium.",
          needsLives: true,
          currentLives: user.lives,
        };
      }

      user.lives -= 1;
      user.lastLivesRegenerationTime = new Date();
      await user.save();
      livesDeducted = true;

      console.log(
        `💔 Deducted 1 life from user ${userId} (score: ${score}%, lives: ${user.lives})`
      );
    }

    // Cập nhật MarxistLearningPath với logic completed dựa vào score
    const pathDoc = await MarxistLearningPath.findOneAndUpdate(
      { userId, lessonId },
      {
        completed: score >= 70, // Chỉ completed = true khi score >= 70%
        achievedScore: score,
        completedAt: score >= 70 ? new Date() : null, // Chỉ set completedAt khi thực sự completed
      },
      { new: true }
    );

    if (!pathDoc) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học trong lộ trình Marxist",
      };
    }

    // 📊 TẠO PROGRESS RECORD (giống lesson tiếng Anh)
    const lessonStatus = score >= 70 ? "COMPLETE" : "FAILED";
    const isRetried = false; // TODO: Implement retry tracking if needed

    // 🔍 VALIDATE và FILTER questionResults để đảm bảo schema compliance
    const validQuestionResults = Array.isArray(questionResults)
      ? questionResults
        .filter((result) => {
          // Chỉ giữ lại results có questionId (answer có thể rỗng nếu user không chọn)
          return result && result.questionId;
        })
        .map((result) => ({
          questionId: result.questionId,
          answer: result.answer || "", // Cho phép answer rỗng nếu user không chọn
          isCorrect: result.isCorrect || false, // Default false nếu không có
          score: typeof result.score === "number" ? result.score : 0, // Default 0 nếu không có
          isTimeout: result.isTimeout || false,
          transcription: result.transcription || null,
          feedback: result.feedback || null,
        }))
      : [];

    console.log(
      `📝 Creating Progress record: userId=${userId}, lessonId=${lessonId}, score=${score}, status=${lessonStatus}`
    );
    console.log(
      `📊 Valid questionResults: ${validQuestionResults.length}/${questionResults?.length || 0
      }`
    );

    const progress = await Progress.create({
      userId,
      lessonId,
      score,
      status: lessonStatus,
      isRetried,
      questionResults: validQuestionResults,
    });

    console.log(`✅ Progress record created: ${progress._id}`);

    // 🎯 CỘNG XP VÀ KIỂM TRA LEVEL UP
    let earnedXP = 0;
    let leveledUp = false;
    let newLevel = user.userLevel;
    let livesFromLevelUp = 0;

    if (score >= 70) {
      // Chỉ cộng XP khi pass
      // Tính XP: điểm / 10 (giống logic English learning)
      earnedXP = Math.round(score / 10);
      user.xp += earnedXP;

      console.log(
        `⭐ User ${userId} earned ${earnedXP} XP (score: ${score}%, total XP: ${user.xp})`
      );

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

        console.log(
          `🎉 User ${userId} leveled up! ${oldLevel} → ${newLevel} (gained 1 life, total: ${user.lives})`
        );

        // Gửi notification level up
        try {
          await NotificationService.createNotification(userId, {
            title: "🎉 Chúc mừng lên cấp!",
            message: `Bạn đã lên Level ${newLevel}! Nhận thêm 1 ❤️ lives và unlock tính năng mới.`,
            type: "level_up",
            link: "/profile",
          });
        } catch (error) {
          console.error("Failed to create level up notification:", error);
        }
      }

      // Lưu user với XP và level mới
      await user.save();
    }

    // Sau khi PASS: chỉ log (bỏ logic tạo contentPack)
    if (score >= 70) {
      console.log(`🎯 User ${userId} passed lesson (${score}%). No background generation needed.`);
    }

    return {
      success: true,
      statusCode: 200,
      message:
        score >= 70
          ? leveledUp
            ? `🎉 Hoàn thành xuất sắc! Nhận ${earnedXP} XP và lên Level ${newLevel}!`
            : `✅ Hoàn thành xuất sắc! Nhận ${earnedXP} XP. Bài học đã completed.`
          : `Điểm số: ${score}%. Bài học chưa completed. ${livesDeducted ? "Đã trừ 1 life." : ""
          } Hãy cố gắng hơn!`,
      pathUpdated: true,
      completed: score >= 70,
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
      nextLevelRequiredXP: leveledUp
        ? getRequiredXpForLevel(newLevel)
        : getRequiredXpForLevel(user.userLevel) - user.xp,
      // Progress info
      progressId: progress._id,
      progressStatus: lessonStatus,
    };
  } catch (error) {
    console.error("Error completing Marxist lesson:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi hoàn thành bài học: " + error.message,
    };
  }
};

/**
 * Làm lại bài học triết học Mác-Lê-Nin
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
        message:
          "Không đủ lượt chơi để làm lại. Hãy chờ lives hồi phục hoặc mua gói premium.",
        needsLives: true,
        currentLives: user.lives,
      };
    }

    // Reset learning path về chưa hoàn thành nếu có pathId
    if (pathId) {
      await MarxistLearningPath.findByIdAndUpdate(pathId, {
        completed: false,
        achievedScore: null,
        completedAt: null,
      });
    } else {
      // Nếu không có pathId, tìm path theo lessonId
      await MarxistLearningPath.findOneAndUpdate(
        { userId, lessonId },
        {
          completed: false,
          achievedScore: null,
          completedAt: null,
        }
      );
    }

    // Trừ lives nếu không phải là premium
    if (!unlimitedLives) {
      user.lives -= 1;
      user.lastLivesRegenerationTime = new Date();
      await user.save();
      console.log(
        `💔 Deducted 1 life for retry from user ${userId} (lives: ${user.lives})`
      );
    }

    return {
      success: true,
      statusCode: 200,
      message: unlimitedLives
        ? "Có thể làm lại bài học (Premium)"
        : `Có thể làm lại bài học. Lives còn lại: ${user.lives}`,
      livesDeducted: !unlimitedLives,
      currentLives: user.lives,
      canRetry: true,
    };
  } catch (error) {
    console.error("Error retrying Marxist lesson:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi làm lại bài học: " + error.message,
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
      completed: true,
    });

    // Thống kê theo chủ đề
    const topicStats = await MarxistLearningPath.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "marxisttopics",
          localField: "marxistTopic",
          foreignField: "_id",
          as: "topicInfo",
        },
      },
      {
        $group: {
          _id: "$marxistTopic",
          topicName: { $first: { $arrayElemAt: ["$topicInfo.name", 0] } },
          topicTitle: { $first: { $arrayElemAt: ["$topicInfo.title", 0] } },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: ["$completed", 1, 0] },
          },
          avgScore: {
            $avg: { $cond: ["$completed", "$achievedScore", null] },
          },
        },
      },
    ]);

    // Điểm trung bình tổng thể
    const avgScoreResult = await MarxistLearningPath.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          completed: true,
          achievedScore: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$achievedScore" },
        },
      },
    ]);

    const overallAvgScore =
      avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thống kê Marxist thành công",
      stats: {
        totalLessons,
        completedLessons,
        completionRate:
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0,
        overallAvgScore,
        topicBreakdown: topicStats.map((stat) => ({
          topicId: stat._id,
          name: stat.topicName || "unknown",
          title: stat.topicTitle || "Không xác định",
          total: stat.total,
          completed: stat.completed,
          avgScore: stat.avgScore ? Math.round(stat.avgScore) : 0,
        })),
      },
    };
  } catch (error) {
    console.error("Error getting Marxist stats:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thống kê: " + error.message,
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
  getAllMarxistTopics,
  getGenerationStats, // ⚡ Performance monitoring endpoint
  testAnswerDistribution, // 🎯 Test answer concentration
  testAiGenerationAccuracy, // 🧪 Test AI accuracy endpoint
}; 
