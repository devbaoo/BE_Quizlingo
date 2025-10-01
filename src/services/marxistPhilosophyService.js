import mongoose from "mongoose";
import geminiService from "./geminiService.js";
import multiAiService from "./multiAiService.js";
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
import contentService from "./contentService.js";
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
      reason: `Dựa trên kết quả ${
        completedPaths.length
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
    console.log(
      `⏳ User ${userId} is in background generation, skipping manual generation...`
    );
    return {
      success: false,
      statusCode: 429,
      message: "Hệ thống đang tạo bài học tự động, vui lòng chờ...",
    };
  }

  // Sử dụng Rate Limiter thay vì simple mutex
  try {
    return await generationRateLimiter.requestGeneration(userId, async () => {
      return await _generateMarxistLessonInternal(userId, options);
    });
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

    // Phân tích tiến độ học tập (với caching)
    const analysis = await cacheService.getOrSetUserProgress(
      userId,
      async (userId) => {
        return await analyzeUserProgress(userId);
      }
    );

    let topicId = options.topic;
    let difficulty = options.difficulty;

    // Luôn random topic thay vì dùng recommended (trừ khi có topic cụ thể)
    if (!topicId) {
      const allTopics = await getAllMarxistTopics();
      if (allTopics.length > 0) {
        const randomTopic =
          allTopics[Math.floor(Math.random() * allTopics.length)];
        topicId = randomTopic._id;
        console.log(
          `🎲 Random selected topic: ${randomTopic.title || randomTopic.name}`
        );
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

    // Xây dựng prompt cho Multi-AI, có thể thêm gợi ý từ ContentPack (summary, keyPoints)
    const contentHints = options.contentHints || null;
    const hintsText = contentHints
      ? `\n\nCơ sở tạo câu hỏi (tóm tắt trước khi ôn):\n- Tiêu đề: ${
          contentHints.title || topicInfo.title
        }\n- Tóm tắt: ${contentHints.summary || ""}\n- Key points: ${(
          contentHints.keyPoints || []
        ).join(", ")}`
      : "";

    // Sử dụng contentHints title nếu có, nếu không thì dùng topicInfo.title
    const finalTitle = contentHints?.title || topicInfo.title;
    const finalDescription = contentHints?.summary || topicInfo.description;

    const prompt = `
Bạn là chuyên gia cao cấp về TRIẾT HỌC Mác-Lê-Nin với nhiều năm kinh nghiệm giảng dạy. Hãy tạo 10 câu hỏi trắc nghiệm chất lượng cao về chủ đề "${finalTitle}" với độ khó cấp độ ${difficulty}/5.${hintsText}

🎯 THÔNG TIN CHỦ ĐỀ:
- Tiêu đề: ${finalTitle}
- Mô tả: ${finalDescription}
- Từ khóa quan trọng: ${topicInfo.keywords.join(", ")}
- Độ khó: ${difficulty}/5

⚠️ YÊU CẦU TUYỆT ĐỐI:
1. CHỈ VỀ TRIẾT HỌC MÁC-LÊ-NIN (duy vật biện chứng, nhận thức luận, quy luật triết học)
2. KHÔNG hỏi về kinh tế chính trị, giá trị thặng dư, tư bản, bóc lột
3. ĐÚNG 10 câu hỏi trắc nghiệm (multiple choice)
4. Mỗi câu có đúng 4 đáp án (A, B, C, D)

🚨 PHÂN BỐ ĐÁP ÁN - QUAN TRỌNG NHẤT:
- Đáp án đúng PHẢI được phân bố đều: A (2-3 câu), B (2-3 câu), C (2-3 câu), D (2-3 câu)
- TUYỆT ĐỐI KHÔNG được tất cả câu cùng đáp án
- Ví dụ tốt: Câu 1→A, Câu 2→C, Câu 3→B, Câu 4→D, Câu 5→A, v.v.
- KIỂM TRA KỸ từng câu trước khi trả về

📝 TIÊU CHUẨN CHẤT LƯỢNG:
- Câu hỏi rõ ràng, không mơ hồ
- Đáp án sai hợp lý nhưng không đúng
- Độ khó phù hợp với cấp độ ${difficulty}
- Thời gian làm mỗi câu: 30 giây
- Nội dung chính xác theo lý thuyết Mác-Lê-Nin

🔍 KIỂM TRA CUỐI:
Trước khi trả về, hãy đếm số câu có đáp án A, B, C, D để đảm bảo phân bố đều!

⚠️ CHỈ trả về kết quả ở định dạng JSON CHÍNH XÁC. KHÔNG thêm text giải thích.

{
  "title": "${finalTitle}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Nội dung câu hỏi về triết học Mác-Lê-Nin...",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A",
      "score": 100,
      "timeLimit": 30
    }
  ]
}`;

    // Enhanced answer distribution validation với scoring system
    const validateAnswerDistribution = (questions) => {
      if (!Array.isArray(questions) || questions.length === 0) {
        return {
          isValid: false,
          errors: ["Không có câu hỏi nào"],
          distribution: {},
          severity: "CRITICAL",
          score: 0,
        };
      }

      const distribution = { A: 0, B: 0, C: 0, D: 0, Unknown: 0 };
      const issues = [];
      let score = 100; // Start with perfect score

      questions.forEach((q, index) => {
        const answer = q.correctAnswer || "";
        const match = answer.match(/^([A-Da-d])/);
        const letter = match ? match[1].toUpperCase() : "Unknown";
        distribution[letter]++;

        // Validate question structure
        if (!q.content || !Array.isArray(q.options) || q.options.length !== 4) {
          issues.push(`Question ${index + 1}: Invalid structure`);
          score -= 15;
        }
      });

      const totalQuestions = questions.length;
      const validAnswers = Object.entries(distribution).filter(
        ([key]) => key !== "Unknown"
      );
      const counts = validAnswers.map(([, count]) => count);
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts.filter((c) => c > 0));

      // Critical: Tất cả câu cùng đáp án
      const dominantAnswer = validAnswers.find(
        ([letter, count]) => count === totalQuestions
      );
      if (dominantAnswer) {
        issues.push(
          `CRITICAL: All ${totalQuestions} questions have answer ${dominantAnswer[0]}!`
        );
        score = 0; // Fail completely
      }

      // High: Quá tập trung (>60%)
      const concentrationThreshold = Math.ceil(totalQuestions * 0.6);
      validAnswers.forEach(([letter, count]) => {
        if (count >= concentrationThreshold && !dominantAnswer) {
          issues.push(
            `Too concentrated: ${count}/${totalQuestions} questions have answer ${letter}`
          );
          score -= 30;
        }
      });

      // Medium: Phân bố không đều
      if (
        counts.length > 1 &&
        maxCount - minCount > Math.ceil(totalQuestions / 2)
      ) {
        issues.push(
          `Uneven distribution: max(${maxCount}) - min(${minCount}) = ${
            maxCount - minCount
          }`
        );
        score -= 20;
      }

      // Low: Unknown answers
      if (distribution.Unknown > 0) {
        issues.push(
          `Invalid format: ${distribution.Unknown} unrecognizable correct answers`
        );
        score -= 10 * distribution.Unknown;
      }

      const severity =
        score === 0
          ? "CRITICAL"
          : score < 50
          ? "HIGH"
          : score < 80
          ? "MEDIUM"
          : "LOW";

      return {
        isValid: score >= 70, // Accept if score >= 70
        errors: issues,
        distribution,
        severity,
        score: Math.max(0, score),
        shouldRetry: score < 70,
      };
    };

    // Robust AI generation với multiple strategies
    console.log(
      "🔄 Starting ROBUST AI-only lesson generation (NO DEMO FALLBACK)..."
    );

    let lessonData = null;
    const maxRetries = 5; // Tăng số lần retry
    const strategies = ["weighted", "failover", "round_robin", "least_loaded"];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const strategy = strategies[attempt % strategies.length];

      // Create enhanced prompt inline để tránh scope issues
      let enhancedPrompt = prompt;
      if (attempt > 0) {
        enhancedPrompt += `\n\n🚨 CRITICAL REQUIREMENTS (Retry ${attempt}) - PLEASE READ CAREFULLY:
1. Đáp án đúng PHẢI được phân bố đều giữa A, B, C, D
2. TUYỆT ĐỐI KHÔNG được có tất cả câu cùng đáp án (ví dụ: tất cả đều B)
3. Phân bố lý tưởng: 2-3 câu A, 2-3 câu B, 2-3 câu C, 2-3 câu D
4. KIỂM TRA KỸ từng câu trước khi trả về
5. Đảm bảo mỗi câu hỏi có format đúng: "A. nội dung", "B. nội dung", etc.

📝 EXAMPLE GOOD DISTRIBUTION:
Câu 1: correctAnswer: "A. Quy luật thống nhất và đấu tranh của các mặt đối lập"
Câu 2: correctAnswer: "B. Quy luật lượng chất"  
Câu 3: correctAnswer: "C. Quy luật phủ định của phủ định"
Câu 4: correctAnswer: "D. Thực tiễn là tiêu chuẩn chân lý"
... (tiếp tục xen kẽ A,B,C,D)`;
      }

      console.log(
        `🚀 AI Generation Attempt ${
          attempt + 1
        }/${maxRetries} (Strategy: ${strategy})`
      );

      try {
        const aiResult = await multiAiService.generateJsonContent(
          enhancedPrompt,
          {
            strategy: strategy,
            maxRetries: 4, // Retry trong mỗi provider
            maxProviderRetries: 3,
            baseDelay: 1000 + attempt * 500, // Tăng delay mỗi attempt
          }
        );

        if (!aiResult.success) {
          console.warn(
            `⚠️ AI Strategy '${strategy}' failed:`,
            aiResult.message
          );

          // Exponential backoff trước khi thử strategy tiếp theo
          const backoffDelay = Math.min(5000, 1000 * Math.pow(2, attempt));
          console.log(`⏳ Waiting ${backoffDelay}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        // Validate data structure trước khi check distribution
        if (
          !aiResult.data ||
          !aiResult.data.questions ||
          !Array.isArray(aiResult.data.questions)
        ) {
          console.warn(
            `❌ Invalid data structure from ${aiResult.provider}:`,
            aiResult.data
          );
          continue;
        }

        if (aiResult.data.questions.length !== 10) {
          console.warn(
            `❌ Wrong question count: ${aiResult.data.questions.length}/10 from ${aiResult.provider}`
          );
          continue;
        }

        // Validate answer distribution
        const validation = validateAnswerDistribution(aiResult.data.questions);

        if (validation.isValid) {
          lessonData = aiResult.data;
          console.log(
            `✅ SUCCESS! Generated valid lesson from ${
              aiResult.provider
            } on attempt ${attempt + 1}`
          );
          console.log("📊 Final answer distribution:", validation.distribution);
          break;
        } else {
          console.warn(
            `❌ Poor answer distribution from ${aiResult.provider} (attempt ${
              attempt + 1
            }):`,
            {
              distribution: validation.distribution,
              issues: validation.errors,
              severity: validation.severity,
            }
          );

          // Nếu chỉ là LOW severity và đã thử nhiều lần, có thể chấp nhận
          if (validation.severity === "LOW" && attempt >= 3) {
            console.log(
              "⚠️ Accepting LOW severity distribution due to multiple retries..."
            );
            lessonData = aiResult.data;
            break;
          }
        }
      } catch (error) {
        console.error(
          `❌ AI Generation attempt ${attempt + 1} error:`,
          error.message
        );
      }

      // Short delay giữa các attempts
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    // STRICT: Không có fallback, phải có lesson từ AI
    if (!lessonData) {
      console.error(
        "❌ CRITICAL: All AI generation attempts failed - NO DEMO FALLBACK"
      );
      return {
        success: false,
        statusCode: 503,
        message:
          "Hệ thống AI tạm thời không khả dụng. Vui lòng thử lại sau ít phút.",
        error: "AI_GENERATION_FAILED",
        details: "All AI providers failed after multiple retry strategies",
        retryable: true,
        suggestedDelay: 300000, // 5 phút
      };
    }

    // Validate lesson data từ AI
    if (!lessonData || !lessonData.questions) {
      console.error("❌ Invalid lesson data:", lessonData);
      return {
        success: false,
        statusCode: 500,
        message: "Dữ liệu bài học từ AI không hợp lệ",
        error: "INVALID_AI_DATA",
      };
    }

    console.log(`� AI Lesson data: ${lessonData.questions.length} questions`);

    // Strict validation cho AI-generated lessons
    if (lessonData.questions.length !== 10) {
      console.error(
        `❌ Wrong question count: ${lessonData.questions.length}/10`
      );
      return {
        success: false,
        statusCode: 500,
        message: `AI tạo ${lessonData.questions.length} câu hỏi thay vì 10 câu yêu cầu`,
        error: "INVALID_QUESTION_COUNT",
      };
    }

    // Tìm hoặc tạo Topic, Level, Skill với error handling
    console.log("📋 Finding or creating Topic, Level, Skill...");

    let topicDoc = await Topic.findOne({ name: "Marxist Philosophy" });
    if (!topicDoc) {
      console.log("🔧 Creating Marxist Philosophy topic...");
      topicDoc = await Topic.create({
        name: "Marxist Philosophy",
        description:
          "Triết học Mác-Lê-Nin: duy vật biện chứng, nhận thức luận, quy luật triết học",
        isActive: true,
      });
    }

    let levelDoc = await Level.findOne({ name: "marxist_intermediate" });
    if (!levelDoc) {
      console.log("🔧 Creating marxist_intermediate level...");

      // Tìm order cao nhất hiện tại và +1
      const lastLevel = await Level.findOne().sort({ order: -1 });
      const nextOrder = lastLevel ? lastLevel.order + 1 : 1;

      levelDoc = await Level.create({
        name: "marxist_intermediate",
        description: "Trình độ trung cấp Marxist",
        order: nextOrder,
        minScoreRequired: 70,
        minUserLevel: 1,
        minLessonPassed: 0,
        maxScore: 3000,
        timeLimit: 300, // 30s * 10 câu
        isActive: true,
      });

      console.log(`✅ Created level with order: ${nextOrder}`);
    }

    let skillDoc = await Skill.findOne({ name: "marxist_philosophy" });
    if (!skillDoc) {
      console.log("🔧 Creating marxist_philosophy skill...");
      skillDoc = await Skill.create({
        name: "marxist_philosophy",
        description:
          "Triết học Mác-Lê-Nin: phương pháp luận, nhận thức luận, quy luật biện chứng",
        supportedTypes: ["multiple_choice"],
        isActive: true,
      });
    }

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

    // Chuẩn hóa câu hỏi và correctAnswer do một số AI có thể trả về chỉ "A"/1 thay vì toàn bộ option
    const normalizeCorrectAnswer = (question) => {
      try {
        const options = Array.isArray(question.options) ? question.options : [];
        let answer = question.correctAnswer;

        if (!options.length) return question.correctAnswer;

        // Nếu answer là số (1-4)
        if (typeof answer === "number") {
          const idx = Math.max(0, Math.min(options.length - 1, answer - 1));
          return options[idx];
        }

        if (typeof answer === "string") {
          const trimmed = answer.trim();

          // Nếu là chữ cái A-D
          const letterMatch = trimmed.match(/^[A-Da-d]$/);
          if (letterMatch) {
            const idx = trimmed.toUpperCase().charCodeAt(0) - 65; // A->0
            return options[idx] || options[0];
          }

          // Nếu là tiền tố "A." hoặc "A)"
          const letterPrefix = trimmed.match(/^([A-Da-d])[\.)\-\s]?/);
          if (letterPrefix) {
            const idx = letterPrefix[1].toUpperCase().charCodeAt(0) - 65;
            return options[idx] || options[0];
          }

          // Khớp gần đúng: loại bỏ tiền tố "A. " khi so sánh
          const normalizeText = (s) =>
            String(s)
              .replace(/^\s*[A-Da-d][\.)\-]\s*/, "")
              .trim();
          const normalizedAnswer = normalizeText(trimmed);
          const found = options.find(
            (opt) => normalizeText(opt) === normalizedAnswer
          );
          if (found) return found;

          // Nếu đã khớp chính xác với một option
          const exact = options.find((opt) => opt === trimmed);
          if (exact) return exact;
        }

        // Fallback: chọn option đầu tiên để không chặn tạo bài
        return options[0];
      } catch (e) {
        return question.correctAnswer;
      }
    };

    // Force chia đều đáp án đúng giữa A, B, C, D
    const balanceCorrectAnswers = (questions) => {
      const answers = ["A", "B", "C", "D"];
      const balancedAnswers = [];

      // Chia đều: 10 câu = 2-3 câu mỗi đáp án
      const questionsPerAnswer = Math.floor(questions.length / 4); // 2 câu mỗi đáp án
      const remainder = questions.length % 4; // 2 câu dư

      // Thêm câu hỏi cho mỗi đáp án
      for (let i = 0; i < 4; i++) {
        const count = questionsPerAnswer + (i < remainder ? 1 : 0);
        for (let j = 0; j < count; j++) {
          balancedAnswers.push(answers[i]);
        }
      }

      // Shuffle để random vị trí
      for (let i = balancedAnswers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [balancedAnswers[i], balancedAnswers[j]] = [
          balancedAnswers[j],
          balancedAnswers[i],
        ];
      }

      console.log(
        `🎯 Generated balanced answers: ${balancedAnswers.join(", ")}`
      );
      return balancedAnswers;
    };

    // Kiểm tra và cảnh báo nếu tất cả đáp án đúng đều là A
    const checkAnswerDistribution = (questions) => {
      const correctAnswers = questions.map((q) => {
        const answer = q.correctAnswer || "";
        const match = answer.match(/^([A-Da-d])/);
        return match ? match[1].toUpperCase() : "A";
      });

      const aCount = correctAnswers.filter((a) => a === "A").length;
      if (aCount >= 8) {
        // Nếu 8/10 câu đều là A
        console.warn(
          `⚠️ Warning: ${aCount}/10 questions have answer A. Balancing answers...`
        );
        return true; // Cần balance
      }

      return false; // Không cần balance
    };

    const processedQuestions = lessonData.questions.map((q) => {
      const normalized = {
        ...q,
        type: "multiple_choice",
        timeLimit: 30,
        score: 100,
      };
      return {
        ...normalized,
        skill: skillDoc._id,
        correctAnswer: normalizeCorrectAnswer(normalized),
      };
    });

    // LUÔN balance đáp án đúng để đảm bảo random đều
    console.log("🔄 Balancing correct answers distribution...");
    const balancedAnswers = balanceCorrectAnswers(processedQuestions);

    // Cập nhật đáp án đúng cho từng câu hỏi
    processedQuestions.forEach((question, index) => {
      const balancedAnswer = balancedAnswers[index];
      const options = question.options || [];

      if (options.length >= 4) {
        // Tìm option tương ứng với balanced answer
        const targetOption = options.find((opt) =>
          opt.trim().toUpperCase().startsWith(balancedAnswer)
        );

        if (targetOption) {
          question.correctAnswer = targetOption;
          console.log(
            `✅ Question ${index + 1}: Set correct answer to ${balancedAnswer}`
          );
        } else {
          // Fallback: tạo đáp án đúng theo format chuẩn
          question.correctAnswer = `${balancedAnswer}. ${
            question.options[balancedAnswer.charCodeAt(0) - 65]?.replace(
              /^[A-D]\.\s*/,
              ""
            ) || "Đáp án đúng"
          }`;
          console.log(
            `⚠️ Question ${
              index + 1
            }: Created fallback answer ${balancedAnswer}`
          );
        }
      }
    });

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
          timeLimit: qData.timeLimit || 30,
        });
        questionIds.push(question._id);

        if ((i + 1) % 10 === 0) {
          console.log(
            `✅ Created ${i + 1}/${processedQuestions.length} questions`
          );
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
      source: "ai_generated_marxist",
      marxistTopic: topicId,
      difficultyLevel: difficulty,
      previousScore: analysis.previousScore || 0,
      recommendedReason: analysis.reason,
      order: pathOrder,
    });

    // Cập nhật thống kê cho topic
    await MarxistTopic.findByIdAndUpdate(topicId, {
      $inc: { totalLessonsGenerated: 1 },
    });

    // Gửi notification
    await NotificationService.createNotification(userId, {
      title: "📚 Bài học Mác-Lê-Nin mới đã sẵn sàng!",
      message: `AI đã tạo bài học về "${topicInfo.title}" với 10 câu hỏi. Hãy vào học ngay!`,
      type: "ai_generated",
      link: "/philosophy",
    });

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
      `📊 Valid questionResults: ${validQuestionResults.length}/${
        questionResults?.length || 0
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

    // Sau khi PASS: tạo học liệu ngắn gọn + bài ôn tập 10 câu dựa trên học liệu (background, không chặn response)
    let nextLessonGenerated = false;
    if (score >= 70) {
      console.log(
        `🎯 User ${userId} passed lesson (${score}%), starting background generation...`
      );

      // Đánh dấu user đang trong background generation để tránh tạo bài học thủ công
      backgroundGeneratingUsers.add(userId);

      Promise.resolve().then(async () => {
        try {
          // Random topic mới cho ContentPack và bài ôn tập
          const allTopics = await getAllMarxistTopics();
          let randomTopic = null;
          if (allTopics.length > 0) {
            randomTopic =
              allTopics[Math.floor(Math.random() * allTopics.length)];
            console.log(
              `🎲 Random NEW topic for review: ${
                randomTopic.title || randomTopic.name
              }`
            );
          }

          const newTopicTitle = randomTopic
            ? `Bài tập ${randomTopic.title || randomTopic.name} - Cấp độ ${
                pathDoc.difficultyLevel || 3
              }`
            : `Bài tập Marxist Philosophy - Cấp độ ${
                pathDoc.difficultyLevel || 3
              }`;

          console.log(
            `📚 Creating ContentPack for user ${userId}, with NEW random topic: ${newTopicTitle}`
          );
          const contentPack = await contentService.getOrGenerateContentPack(
            userId,
            {
              topicId: randomTopic?._id || pathDoc.marxistTopic, // Random topic mới
              topicName: newTopicTitle, // Title với topic mới
              level: "intermediate",
              goal: `Ôn tập chủ đề mới: ${
                randomTopic?.title || randomTopic?.name || "Marxist Philosophy"
              }`,
              include: {
                summary: true,
                keyPoints: true,
                mindmap: true,
                slideOutline: true,
                flashcards: true,
              },
              forceNew: true, // Force tạo mới ContentPack sau khi pass lesson
            }
          );
          console.log(`✅ ContentPack created: ${contentPack.title}`);

          try {
            await NotificationService.createNotification(userId, {
              title: "📘 Học liệu ôn tập đã sẵn sàng",
              message: `Đã tạo gói học liệu ngắn gọn cho chủ đề "${contentPack.title}". Vào xem nhanh trước khi ôn tập!`,
              type: "study_pack",
              link: "/philosophy",
            });
          } catch (e) {
            console.warn("Notify study pack failed:", e.message);
          }

          // 2) Tạo bài ôn tập 10 câu dựa trên học liệu (contentHints) - gọi trực tiếp internal function
          console.log(
            `📝 Creating review lesson for user ${userId} based on ContentPack`
          );

          // Tạm thời xóa user khỏi background generation để tạo bài ôn tập
          backgroundGeneratingUsers.delete(userId);

          const reviewRes = await _generateMarxistLessonInternal(userId, {
            questionCount: 10,
            // Không random topic, sử dụng contentHints để match với ContentPack
            contentHints: {
              title: contentPack.title,
              summary: contentPack.summary,
              keyPoints: (contentPack.keyPoints || []).slice(0, 8),
            },
          });

          // Thêm lại user vào background generation
          backgroundGeneratingUsers.add(userId);

          console.log(
            `✅ Review lesson created: ${
              reviewRes?.success ? "SUCCESS" : "FAILED"
            }`
          );

          if (reviewRes?.success) {
            nextLessonGenerated = true;
            try {
              await NotificationService.createNotification(userId, {
                title: "📝 Bài ôn tập 10 câu đã tạo",
                message: `AI đã tạo bài ôn tập dựa trên học liệu "${contentPack.title}". Vào làm ngay để củng cố kiến thức!`,
                type: "ai_generated",
                link: "/philosophy",
              });
            } catch (e) {
              console.warn("Notify review quiz failed:", e.message);
            }
          }
        } catch (err) {
          console.error(
            "❌ Post-pass content/review generation failed:",
            err.message
          );
          console.error("Error details:", err);
        } finally {
          // Xóa flag background generation
          backgroundGeneratingUsers.delete(userId);
          console.log(`🏁 Background generation completed for user ${userId}`);
        }
      });
    }

    return {
      success: true,
      statusCode: 200,
      message:
        score >= 70
          ? leveledUp
            ? `🎉 Hoàn thành xuất sắc! Nhận ${earnedXP} XP và lên Level ${newLevel}!`
            : `✅ Hoàn thành xuất sắc! Nhận ${earnedXP} XP. Bài học đã completed.`
          : `Điểm số: ${score}%. Bài học chưa completed. ${
              livesDeducted ? "Đã trừ 1 life." : ""
            } Hãy cố gắng hơn!`,
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

/**
 * Generate custom Marxist lesson với chủ đề do user chọn
 * @param {string} userId - User ID
 * @param {Object} options - Generation options
 * @returns {Object} Generated lesson
 */
const generateCustomMarxistLesson = async (userId, options = {}) => {
  console.log(`🚀 Request to generate custom Marxist lesson for user ${userId}`);
  console.log(`📋 Custom topic: "${options.customTopic}"`);

  // Kiểm tra xem có đang trong background generation không
  if (backgroundGeneratingUsers.has(userId)) {
    console.log(`⏳ User ${userId} is in background generation, skipping manual generation...`);
    return {
      success: false,
      statusCode: 429,
      message: "Hệ thống đang tạo bài học tự động, vui lòng chờ...",
    };
  }

  // Sử dụng Rate Limiter thay vì simple mutex
  try {
    return await generationRateLimiter.requestGeneration(userId, async () => {
      return await _generateCustomMarxistLessonInternal(userId, options);
    });
  } catch (rateLimitError) {
    console.warn(
      `⚠️ Rate limit error for user ${userId}:`,
      rateLimitError.message
    );
    return rateLimitError;
  }
};

/**
 * Internal function để generate custom lesson (được gọi bởi rate limiter)
 * @param {string} userId - User ID
 * @param {Object} options - Generation options with customTopic
 * @returns {Object} Generated lesson
 */
const _generateCustomMarxistLessonInternal = async (userId, options = {}) => {
  try {
    console.log(`🔄 Generating custom lesson for user ${userId} (within rate limit)`);

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    const { customTopic, topicKey, difficulty = 2 } = options;

    // Validate custom topic
    if (!customTopic || typeof customTopic !== 'string') {
      return {
        success: false,
        statusCode: 400,
        message: "Chủ đề tùy chọn là bắt buộc",
      };
    }

    // Sanitize và validate topic content để đảm bảo liên quan đến triết học
    const sanitizedTopic = customTopic.trim();
    const philosophyKeywords = [
      'triết', 'triết học', 'mác', 'lê-nin', 'marx', 'lenin', 'duy vật', 'biện chứng', 
      'nhận thức', 'thực tiễn', 'ý thức', 'quy luật', 'mâu thuẫn', 'phủ định', 
      'lượng chất', 'bản chất', 'hiện tượng', 'nguyên nhân', 'kết quả', 'cần thiết',
      'ngẫu nhiên', 'khả năng', 'hiện thực', 'nội dung', 'hình thức', 'chân lý'
    ];

    const topicLower = sanitizedTopic.toLowerCase();
    const hasPhilosophyKeyword = philosophyKeywords.some(keyword => 
      topicLower.includes(keyword.toLowerCase())
    );

    // Nếu không có keyword triết học, thêm context
    const finalTopic = hasPhilosophyKeyword ? sanitizedTopic : 
      `Triết học Mác-Lê-Nin về ${sanitizedTopic}`;

    console.log(`🎯 Final topic: "${finalTopic}"`);

    // Enhanced prompt với custom topic
    const prompt = `
Bạn là chuyên gia cao cấp về TRIẾT HỌC Mác-Lê-Nin với nhiều năm kinh nghiệm giảng dạy. Hãy tạo 10 câu hỏi trắc nghiệm chất lượng cao về chủ đề "${finalTopic}" với độ khó cấp độ ${difficulty}/5.

🎯 CHỦ ĐỀ TÙY CHỌN: ${finalTopic}
📊 ĐỘ KHÓ: ${difficulty}/5

⚠️ YÊU CẦU TUYỆT ĐỐI:
1. CHỈ VỀ TRIẾT HỌC MÁC-LÊ-NIN (duy vật biện chứng, nhận thức luận, quy luật triết học)
2. TÁCH BIỆT với kinh tế chính trị - KHÔNG hỏi về giá trị thặng dư, tư bản, bóc lột
3. ĐÚNG 10 câu hỏi trắc nghiệm (multiple choice)
4. Mỗi câu có đúng 4 đáp án (A, B, C, D)
5. Liên quan TRỰC TIẾP đến chủ đề: "${finalTopic}"

🚨 PHÂN BỐ ĐÁP ÁN - QUAN TRỌNG NHẤT:
- Đáp án đúng PHẢI được phân bố đều: A (2-3 câu), B (2-3 câu), C (2-3 câu), D (2-3 câu)
- TUYỆT ĐỐI KHÔNG được tất cả câu cùng đáp án
- Ví dụ tốt: Câu 1→A, Câu 2→C, Câu 3→B, Câu 4→D, Câu 5→A, v.v.
- KIỂM TRA KỸ từng câu trước khi trả về

📝 TIÊU CHUẨN CHẤT LƯỢNG:
- Câu hỏi liên quan chặt chẽ với "${finalTopic}"
- Nội dung chính xác theo lý thuyết Mác-Lê-Nin
- Đáp án sai hợp lý nhưng không đúng
- Độ khó phù hợp với cấp độ ${difficulty}
- Thời gian làm mỗi câu: 30 giây

🔍 KIỂM TRA CUỐI:
Trước khi trả về, hãy đếm số câu có đáp án A, B, C, D để đảm bảo phân bố đều!

⚠️ CHỈ trả về kết quả ở định dạng JSON CHÍNH XÁC. KHÔNG thêm text giải thích.

{
  "title": "${finalTopic}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Nội dung câu hỏi về '${finalTopic}' trong triết học Mác-Lê-Nin...",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correctAnswer": "A. Đáp án A",
      "score": 100,
      "timeLimit": 30
    }
  ]
}`;

    // Enhanced answer distribution validation với scoring system
    const validateAnswerDistribution = (questions) => {
      if (!Array.isArray(questions) || questions.length === 0) {
        return {
          isValid: false,
          errors: ["Không có câu hỏi nào"],
          distribution: {},
          severity: "CRITICAL",
          score: 0
        };
      }

      const distribution = { A: 0, B: 0, C: 0, D: 0, Unknown: 0 };
      const issues = [];
      let score = 100; // Start with perfect score

      questions.forEach((q, index) => {
        const answer = q.correctAnswer || "";
        const match = answer.match(/^([A-Da-d])/);
        const letter = match ? match[1].toUpperCase() : "Unknown";
        distribution[letter]++;
        
        // Validate question structure
        if (!q.content || !Array.isArray(q.options) || q.options.length !== 4) {
          issues.push(`Question ${index + 1}: Invalid structure`);
          score -= 15;
        }
      });

      const totalQuestions = questions.length;
      const validAnswers = Object.entries(distribution).filter(([key]) => key !== 'Unknown');
      const counts = validAnswers.map(([, count]) => count);
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts.filter(c => c > 0));

      // Critical: Tất cả câu cùng đáp án
      const dominantAnswer = validAnswers.find(([letter, count]) => count === totalQuestions);
      if (dominantAnswer) {
        issues.push(`CRITICAL: All ${totalQuestions} questions have answer ${dominantAnswer[0]}!`);
        score = 0; // Fail completely
      }

      // High: Quá tập trung (>60%)
      const concentrationThreshold = Math.ceil(totalQuestions * 0.6);
      validAnswers.forEach(([letter, count]) => {
        if (count >= concentrationThreshold && !dominantAnswer) {
          issues.push(`Too concentrated: ${count}/${totalQuestions} questions have answer ${letter}`);
          score -= 30;
        }
      });

      // Medium: Phân bố không đều
      if (counts.length > 1 && (maxCount - minCount) > Math.ceil(totalQuestions / 2)) {
        issues.push(`Uneven distribution: max(${maxCount}) - min(${minCount}) = ${maxCount - minCount}`);
        score -= 20;
      }

      // Low: Unknown answers
      if (distribution.Unknown > 0) {
        issues.push(`Invalid format: ${distribution.Unknown} unrecognizable correct answers`);
        score -= 10 * distribution.Unknown;
      }

      const severity = score === 0 ? 'CRITICAL' :
                      score < 50 ? 'HIGH' :
                      score < 80 ? 'MEDIUM' : 'LOW';

      return {
        isValid: score >= 70, // Accept if score >= 70
        errors: issues,
        distribution,
        severity,
        score: Math.max(0, score),
        shouldRetry: score < 70
      };
    };

    // Robust AI generation với multiple strategies cho custom topic
    console.log("🔄 Starting ROBUST AI-only custom lesson generation (NO DEMO FALLBACK)...");
    
    let lessonData = null;
    const maxRetries = 5; // Tăng số lần retry
    const strategies = ["weighted", "failover", "round_robin", "least_loaded"];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const strategy = strategies[attempt % strategies.length];
      
      // Create enhanced prompt inline để tránh scope issues
      let enhancedPrompt = prompt;
      if (attempt > 0) {
        enhancedPrompt += `\n\n🚨 CRITICAL REQUIREMENTS (Retry ${attempt}) - PLEASE READ CAREFULLY:
1. Đáp án đúng PHẢI được phân bố đều giữa A, B, C, D
2. TUYỆT ĐỐI KHÔNG được có tất cả câu cùng đáp án (ví dụ: tất cả đều B)
3. Phân bố lý tưởng: 2-3 câu A, 2-3 câu B, 2-3 câu C, 2-3 câu D
4. KIỂM TRA KỸ từng câu trước khi trả về
5. Đảm bảo mỗi câu hỏi có format đúng: "A. nội dung", "B. nội dung", etc.
6. Tất cả câu hỏi phải liên quan đến "${finalTopic}"

📝 EXAMPLE GOOD DISTRIBUTION:
Câu 1: correctAnswer: "A. [Nội dung liên quan ${finalTopic}]"
Câu 2: correctAnswer: "B. [Nội dung liên quan ${finalTopic}]"  
Câu 3: correctAnswer: "C. [Nội dung liên quan ${finalTopic}]"
Câu 4: correctAnswer: "D. [Nội dung liên quan ${finalTopic}]"
... (tiếp tục xen kẽ A,B,C,D)`;
      }
      
      console.log(`🚀 AI Generation Attempt ${attempt + 1}/${maxRetries} (Strategy: ${strategy})`);
      
      try {
        const aiResult = await multiAiService.generateJsonContent(enhancedPrompt, {
          strategy: strategy,
          maxRetries: 4, // Retry trong mỗi provider
          maxProviderRetries: 3,
          baseDelay: 1000 + (attempt * 500), // Tăng delay mỗi attempt
        });

        if (!aiResult.success) {
          console.warn(`⚠️ AI Strategy '${strategy}' failed:`, aiResult.message);
          
          // Exponential backoff trước khi thử strategy tiếp theo
          const backoffDelay = Math.min(5000, 1000 * Math.pow(2, attempt));
          console.log(`⏳ Waiting ${backoffDelay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }

        // Validate data structure trước khi check distribution
        if (!aiResult.data || !aiResult.data.questions || !Array.isArray(aiResult.data.questions)) {
          console.warn(`❌ Invalid data structure from ${aiResult.provider}:`, aiResult.data);
          continue;
        }

        if (aiResult.data.questions.length !== 10) {
          console.warn(`❌ Wrong question count: ${aiResult.data.questions.length}/10 from ${aiResult.provider}`);
          continue;
        }

        // Validate answer distribution
        const validation = validateAnswerDistribution(aiResult.data.questions);
        
        if (validation.isValid) {
          lessonData = aiResult.data;
          console.log(`✅ SUCCESS! Generated valid custom lesson from ${aiResult.provider} on attempt ${attempt + 1}`);
          console.log("📊 Final answer distribution:", validation.distribution);
          console.log(`🎯 Custom topic: "${finalTopic}"`);
          break;
        } else {
          console.warn(`❌ Poor answer distribution from ${aiResult.provider} (attempt ${attempt + 1}):`, {
            distribution: validation.distribution,
            issues: validation.errors,
            severity: validation.severity
          });
          
          // Nếu chỉ là LOW severity và đã thử nhiều lần, có thể chấp nhận
          if (validation.severity === 'LOW' && attempt >= 3) {
            console.log("⚠️ Accepting LOW severity distribution due to multiple retries...");
            lessonData = aiResult.data;
            break;
          }
        }
        
      } catch (error) {
        console.error(`❌ AI Generation attempt ${attempt + 1} error:`, error.message);
      }
      
      // Short delay giữa các attempts
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // STRICT: Không có fallback, phải có lesson từ AI
    if (!lessonData) {
      console.error("❌ CRITICAL: All AI generation attempts failed for custom topic - NO DEMO FALLBACK");
      return {
        success: false,
        statusCode: 503,
        message: "Hệ thống AI tạm thời không khả dụng. Vui lòng thử lại sau ít phút.",
        error: "AI_GENERATION_FAILED",
        details: "All AI providers failed after multiple retry strategies",
        retryable: true,
        customTopic: finalTopic,
        suggestedDelay: 300000 // 5 phút
      };
    }

    // Validate lesson data từ AI
    if (!lessonData || !lessonData.questions) {
      console.error("❌ Invalid lesson data:", lessonData);
      return {
        success: false,
        statusCode: 500,
        message: "Dữ liệu bài học từ AI không hợp lệ",
        error: "INVALID_AI_DATA"
      };
    }

    console.log(`📊 AI Custom Lesson data: ${lessonData.questions.length} questions`);

    // Strict validation cho AI-generated lessons
    if (lessonData.questions.length !== 10) {
      console.error(`❌ Wrong question count: ${lessonData.questions.length}/10`);
      return {
        success: false,
        statusCode: 500,
        message: `AI tạo ${lessonData.questions.length} câu hỏi thay vì 10 câu yêu cầu`,
        error: "INVALID_QUESTION_COUNT"
      };
    }

    // Tìm hoặc tạo Topic, Level, Skill với error handling cho custom topic
    console.log("📋 Finding or creating Topic, Level, Skill for custom topic...");

    let topicDoc = await Topic.findOne({ name: "Custom Marxist Philosophy" });
    if (!topicDoc) {
      console.log("🔧 Creating Custom Marxist Philosophy topic...");
      topicDoc = await Topic.create({
        name: "Custom Marxist Philosophy",
        description: "Triết học Mác-Lê-Nin với chủ đề tùy chọn của người dùng",
        isActive: true,
      });
    }

    let levelDoc = await Level.findOne({ name: "marxist_custom" });
    if (!levelDoc) {
      console.log("🔧 Creating marxist_custom level...");

      // Tìm order cao nhất hiện tại và +1
      const lastLevel = await Level.findOne().sort({ order: -1 });
      const nextOrder = lastLevel ? lastLevel.order + 1 : 1;

      levelDoc = await Level.create({
        name: "marxist_custom",
        description: "Trình độ tùy chọn cho Marxist với chủ đề tự do",
        order: nextOrder,
        minScoreRequired: 70,
        minUserLevel: 1,
        minLessonPassed: 0,
        maxScore: 3000,
        timeLimit: 300, // 30s * 10 câu
        isActive: true,
      });

      console.log(`✅ Created custom level with order: ${nextOrder}`);
    }

    let skillDoc = await Skill.findOne({ name: "custom_marxist_philosophy" });
    if (!skillDoc) {
      console.log("🔧 Creating custom_marxist_philosophy skill...");
      skillDoc = await Skill.create({
        name: "custom_marxist_philosophy",
        description: "Triết học Mác-Lê-Nin với chủ đề tùy chọn của người dùng",
        supportedTypes: ["multiple_choice"],
        isActive: true,
      });
    }

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

    // Chuẩn hóa câu hỏi và correctAnswer
    const normalizeCorrectAnswer = (question) => {
      try {
        const options = Array.isArray(question.options) ? question.options : [];
        let answer = question.correctAnswer;

        if (!options.length) return question.correctAnswer;

        // Nếu answer là số (1-4)
        if (typeof answer === "number") {
          const idx = Math.max(0, Math.min(options.length - 1, answer - 1));
          return options[idx];
        }

        if (typeof answer === "string") {
          const trimmed = answer.trim();

          // Nếu là chữ cái A-D
          const letterMatch = trimmed.match(/^[A-Da-d]$/);
          if (letterMatch) {
            const idx = trimmed.toUpperCase().charCodeAt(0) - 65; // A->0
            return options[idx] || options[0];
          }

          // Nếu là tiền tố "A." hoặc "A)"
          const letterPrefix = trimmed.match(/^([A-Da-d])[\.)\-\s]?/);
          if (letterPrefix) {
            const idx = letterPrefix[1].toUpperCase().charCodeAt(0) - 65;
            return options[idx] || options[0];
          }

          // Khớp gần đúng: loại bỏ tiền tố "A. " khi so sánh
          const normalizeText = (s) => String(s).replace(/^\s*[A-Da-d][\.)\-]\s*/, "").trim();
          const normalizedAnswer = normalizeText(trimmed);
          const found = options.find((opt) => normalizeText(opt) === normalizedAnswer);
          if (found) return found;

          // Nếu đã khớp chính xác với một option
          const exact = options.find((opt) => opt === trimmed);
          if (exact) return exact;
        }

        // Fallback: chọn option đầu tiên để không chặn tạo bài
        return options[0];
      } catch (e) {
        return question.correctAnswer;
      }
    };

    const processedQuestions = lessonData.questions.map((q) => {
      const normalized = {
        ...q,
        type: "multiple_choice",
        timeLimit: 30,
        score: 100,
      };
      return {
        ...normalized,
        skill: skillDoc._id,
        correctAnswer: normalizeCorrectAnswer(normalized),
      };
    });

    // Tạo lesson với custom topic title
    console.log("📝 Creating custom lesson document...");
    const lesson = await Lesson.create({
      title: lessonData.title || `Bài học: ${finalTopic}`,
      topic: topicDoc._id,
      level: levelDoc._id,
      skills: [skillDoc._id],
      maxScore: lessonData.questions.length * 100, // 100 điểm mỗi câu
      questions: [],
      isActive: true,
    });

    console.log("✅ Custom Lesson created:", lesson._id);

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
          timeLimit: qData.timeLimit || 30,
        });
        questionIds.push(question._id);

        if ((i + 1) % 10 === 0) {
          console.log(
            `✅ Created ${i + 1}/${processedQuestions.length} questions`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to create question ${i + 1}:`, error.message);
        throw error;
      }
    }

    // Cập nhật lesson với question IDs
    lesson.questions = questionIds;
    await lesson.save();

    // Tạo MarxistLearningPath entry cho custom lesson
    const pathOrder = await getNextMarxistOrder(userId);
    const learningPath = await MarxistLearningPath.create({
      userId: user._id,
      lessonId: lesson._id,
      source: "ai_generated_custom_marxist",
      customTopic: finalTopic, // Sử dụng customTopic thay vì marxistTopic
      difficultyLevel: difficulty,
      previousScore: 0,
      recommendedReason: `Bài học tùy chọn về "${finalTopic}" do người dùng yêu cầu`,
      order: pathOrder,
    });

    // Gửi notification
    await NotificationService.createNotification(userId, {
      title: "📚 Bài học tùy chọn đã sẵn sàng!",
      message: `AI đã tạo bài học về "${finalTopic}" với 10 câu hỏi theo yêu cầu của bạn. Hãy vào học ngay!`,
      type: "ai_generated_custom",
      link: "/philosophy",
    });

    return {
      success: true,
      statusCode: 201,
      message: "Tạo bài học triết học Mác-Lê-Nin tùy chọn thành công",
      lesson: {
        lessonId: lesson._id,
        title: lesson.title,
        customTopic: finalTopic,
        originalTopic: customTopic,
        topicKey: topicKey,
        difficultyLevel: difficulty,
        questionCount: questionIds.length,
        maxScore: lesson.maxScore,
        createdAt: lesson.createdAt,
      },
      learningPath: {
        pathId: learningPath._id,
        order: pathOrder,
        isCustom: true,
        customTopic: finalTopic,
        topicKey: topicKey,
        recommendedReason: learningPath.recommendedReason,
      },
    };
  } catch (error) {
    console.error("Error in _generateCustomMarxistLessonInternal:", error);
    throw error; // Re-throw để rate limiter xử lý
  }
};

export default {
  generateMarxistLesson,
  generateCustomMarxistLesson,
  analyzeUserProgress,
  getMarxistLearningPath,
  completeMarxistLesson,
  retryMarxistLesson,
  getMarxistStats,
  getAllMarxistTopics,
};
