import mongoose from "mongoose";
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
 * Enhanced validation cho answer distribution và content accuracy
 * @param {Array} questions - Danh sách câu hỏi
 * @returns {Object} Validation result với score và detailed issues
 */
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
    const questionNum = index + 1;

    // Validate question structure
    if (
      !q.content ||
      typeof q.content !== "string" ||
      q.content.trim().length < 10
    ) {
      issues.push(`Question ${questionNum}: Invalid or too short content`);
      score -= 15;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      issues.push(`Question ${questionNum}: Must have exactly 4 options`);
      score -= 15;
    }

    if (!q.correctAnswer || typeof q.correctAnswer !== "string") {
      issues.push(`Question ${questionNum}: Missing or invalid correctAnswer`);
      score -= 20;
      distribution.Unknown++;
      return;
    }

    // Extract answer letter with enhanced pattern matching
    const answer = q.correctAnswer.trim();
    let letter = "Unknown";

    // Pattern 1: Just letter (A, B, C, D)
    const singleLetterMatch = answer.match(/^([A-Da-d])$/);
    if (singleLetterMatch) {
      letter = singleLetterMatch[1].toUpperCase();
    } else {
      // Pattern 2: Letter with prefix (A., A), A-, etc.)
      const letterPrefixMatch = answer.match(/^([A-Da-d])[\.)\-\s]/);
      if (letterPrefixMatch) {
        letter = letterPrefixMatch[1].toUpperCase();
      } else {
        // Pattern 3: Full option text - match with options array
        if (Array.isArray(q.options)) {
          const cleanAnswer = answer
            .replace(/^\s*[A-Da-d][\.)\-\s]*/, "")
            .trim()
            .toLowerCase();
          const matchingOptionIndex = q.options.findIndex((opt) => {
            if (!opt || typeof opt !== "string") return false;
            const cleanOption = opt
              .replace(/^\s*[A-Da-d][\.)\-\s]*/, "")
              .trim()
              .toLowerCase();
            return cleanOption === cleanAnswer;
          });

          if (matchingOptionIndex >= 0 && matchingOptionIndex < 4) {
            letter = String.fromCharCode(65 + matchingOptionIndex); // 0->A, 1->B, etc.
          }
        }
      }
    }

    distribution[letter]++;

    // Additional validation: Check if correctAnswer actually exists in options
    if (letter !== "Unknown" && Array.isArray(q.options)) {
      const expectedOptionIndex = letter.charCodeAt(0) - 65; // A->0, B->1, etc.
      if (expectedOptionIndex < 0 || expectedOptionIndex >= q.options.length) {
        issues.push(
          `Question ${questionNum}: correctAnswer letter ${letter} points to non-existent option`
        );
        score -= 10;
      } else {
        const expectedOption = q.options[expectedOptionIndex];
        if (!expectedOption || typeof expectedOption !== "string") {
          issues.push(
            `Question ${questionNum}: Option ${letter} is empty or invalid`
          );
          score -= 10;
        }
      }
    }

    // Validate that each option is different and meaningful
    if (Array.isArray(q.options)) {
      const cleanOptions = q.options.map((opt) =>
        opt
          ? opt
              .replace(/^\s*[A-Da-d][\.)\-\s]*/, "")
              .trim()
              .toLowerCase()
          : ""
      );
      const uniqueOptions = new Set(
        cleanOptions.filter((opt) => opt.length > 0)
      );

      if (uniqueOptions.size < 4) {
        issues.push(
          `Question ${questionNum}: Options are not unique or some are empty`
        );
        score -= 15;
      }

      // Check for too short or meaningless options
      cleanOptions.forEach((opt, optIndex) => {
        if (opt.length < 3) {
          issues.push(
            `Question ${questionNum}: Option ${String.fromCharCode(
              65 + optIndex
            )} is too short`
          );
          score -= 5;
        }
      });
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

/**
 * Enhanced normalizeCorrectAnswer với better error handling và logging
 * @param {Object} question - Question object
 * @returns {string} Normalized correct answer
 */
const normalizeCorrectAnswer = (question) => {
  try {
    const options = Array.isArray(question.options) ? question.options : [];
    let answer = question.correctAnswer;

    if (!options.length) {
      console.warn("❌ normalizeCorrectAnswer: No options provided");
      return question.correctAnswer;
    }

    if (!answer) {
      console.warn("❌ normalizeCorrectAnswer: No correct answer provided");
      return options[0]; // Fallback to first option
    }

    // Log original values for debugging
    console.log(
      `🔍 Normalizing: "${answer}" with options:`,
      options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
    );

    // Nếu answer là số (1-4)
    if (typeof answer === "number") {
      const idx = Math.max(0, Math.min(options.length - 1, answer - 1));
      const result = options[idx];
      console.log(`✅ Number answer ${answer} -> Option ${idx}: "${result}"`);
      return result;
    }

    if (typeof answer === "string") {
      const trimmed = answer.trim();

      // Pattern 1: Nếu là chữ cái A-D
      const letterMatch = trimmed.match(/^[A-Da-d]$/);
      if (letterMatch) {
        const idx = trimmed.toUpperCase().charCodeAt(0) - 65; // A->0
        if (idx >= 0 && idx < options.length) {
          const result = options[idx];
          console.log(
            `✅ Letter answer ${trimmed} -> Option ${idx}: "${result}"`
          );
          return result;
        }
      }

      // Pattern 2: Nếu là tiền tố "A." hoặc "A)"
      const letterPrefix = trimmed.match(/^([A-Da-d])[\.)\-\s]/);
      if (letterPrefix) {
        const idx = letterPrefix[1].toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < options.length) {
          const result = options[idx];
          console.log(
            `✅ Letter prefix ${letterPrefix[1]} -> Option ${idx}: "${result}"`
          );
          return result;
        }
      }

      // Pattern 3: Khớp gần đúng: loại bỏ tiền tố "A. " khi so sánh
      const normalizeText = (s) =>
        String(s)
          .replace(/^\s*[A-Da-d][\.)\-]\s*/, "")
          .trim()
          .toLowerCase();

      const normalizedAnswer = normalizeText(trimmed);
      const found = options.find(
        (opt) => normalizeText(opt) === normalizedAnswer
      );
      if (found) {
        console.log(`✅ Text match: "${normalizedAnswer}" -> "${found}"`);
        return found;
      }

      // Pattern 4: Nếu đã khớp chính xác với một option
      const exact = options.find((opt) => opt === trimmed);
      if (exact) {
        console.log(`✅ Exact match: "${exact}"`);
        return exact;
      }

      // Pattern 5: Partial match (tìm option chứa answer text)
      const partial = options.find(
        (opt) =>
          opt &&
          typeof opt === "string" &&
          (opt.toLowerCase().includes(normalizedAnswer) ||
            normalizedAnswer.includes(opt.toLowerCase()))
      );
      if (partial) {
        console.log(`✅ Partial match: "${normalizedAnswer}" -> "${partial}"`);
        return partial;
      }
    }

    // Fallback: chọn option đầu tiên và log warning
    console.warn(
      `⚠️ No match found for "${answer}". Falling back to first option: "${options[0]}"`
    );
    return options[0];
  } catch (e) {
    console.error("❌ normalizeCorrectAnswer error:", e.message);
    return question.correctAnswer;
  }
};

/**
 * Improved prompt engineering cho AI generation
 * @param {Object} params - Parameters for prompt generation
 * @returns {string} Enhanced prompt
 */
const generateEnhancedPrompt = ({
  topicTitle,
  topicDescription,
  keywords,
  difficulty,
  contentHints = null,
  customTopic = null,
}) => {
  const finalTitle = customTopic || contentHints?.title || topicTitle;
  const finalDescription = contentHints?.summary || topicDescription;
  const hintsText = contentHints
    ? `\n\nCơ sở tạo câu hỏi (tóm tắt trước khi ôn):\n- Tiêu đề: ${
        contentHints.title || topicTitle
      }\n- Tóm tắt: ${contentHints.summary || ""}\n- Key points: ${(
        contentHints.keyPoints || []
      ).join(", ")}`
    : "";

  return `
Bạn là chuyên gia cao cấp về TRIẾT HỌC Mác-Lênin với nhiều năm kinh nghiệm giảng dạy.  
Hãy tạo 10 câu hỏi trắc nghiệm chất lượng cao về chủ đề "${finalTitle}" với độ khó cấp độ ${difficulty}/5.${hintsText}

🎯 THÔNG TIN CHỦ ĐỀ:
- Tiêu đề: ${finalTitle}
- Mô tả: ${finalDescription}
- Từ khóa quan trọng: ${keywords?.join(", ") || "triết học, duy vật biện chứng"}
- Độ khó: ${difficulty}/5

⚠️ YÊU CẦU TUYỆT ĐỐI:
1. Nội dung CHỈ về **triết học Mác-Lênin** (thế giới quan duy vật, phép biện chứng, nhận thức luận, quy luật cơ bản, vai trò trong đời sống xã hội).
2. TUYỆT ĐỐI KHÔNG hỏi về kinh tế chính trị, giá trị thặng dư, tư bản, bóc lột (không thuộc phạm vi triết học).
3. TUYỆT ĐỐI KHÔNG được đưa ra đáp án sai lệch, phản Mác-Lênin (ví dụ: ca ngợi duy tâm, cá nhân chủ nghĩa cực đoan, phủ nhận vai trò thực tiễn...).
4. Đúng 10 câu hỏi, mỗi câu có 4 đáp án (A, B, C, D).
5. Mỗi đáp án sai phải hợp lý nhưng KHÔNG trái với bản chất triết học Mác-Lênin.
6. Đáp án đúng phải phân bố đều: A (2-3 câu), B (2-3 câu), C (2-3 câu), D (2-3 câu).

🚨 FORMAT CHÍNH XÁC - QUAN TRỌNG NHẤT:
- Mỗi options array phải có đúng 4 phần tử
- Format chính xác: ["A. Nội dung đáp án A", "B. Nội dung đáp án B", "C. Nội dung đáp án C", "D. Nội dung đáp án D"]
- correctAnswer phải khớp CHÍNH XÁC với một trong 4 options (bao gồm cả ký tự A., B., C., D.)
- VÍ DỤ ĐÚNG: correctAnswer: "A. Quy luật thống nhất và đấu tranh của các mặt đối lập"

📝 TIÊU CHUẨN CHẤT LƯỢNG CAO:
- Câu hỏi rõ ràng, trực tiếp, liên quan chặt chẽ đến "${finalTitle}"
- Đáp án sai hợp lý, có tính học thuật nhưng KHÔNG đúng và KHÔNG phản triết học
- Độ khó phù hợp với cấp độ ${difficulty}/5
- Thời gian làm mỗi câu: 30 giây
- Nội dung chính xác, phù hợp với lý luận Mác-Lênin chính thống

🔍 KIỂM TRA TRƯỚC KHI TRẢ VỀ:
1. Đếm số câu có đáp án A, B, C, D → đảm bảo phân bố đều.
2. Kiểm tra \`correctAnswer\` khớp chính xác với một trong 4 options.
3. Đảm bảo nội dung phù hợp lý luận Mác-Lênin, không phản triết học.
4. Mỗi câu phải rõ ràng, logic, độ khó phù hợp ${difficulty}/5.

⚠️ CHỈ trả về kết quả ở định dạng JSON CHÍNH XÁC. KHÔNG thêm text giải thích.

{
  "title": "${finalTitle}",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Câu hỏi rõ ràng, trực tiếp, liên quan đến ${finalTitle}...",
      "options": [
        "A. Nội dung đáp án A",
        "B. Nội dung đáp án B", 
        "C. Nội dung đáp án C",
        "D. Nội dung đáp án D"
      ],
      "correctAnswer": "B. Nội dung đáp án B",
      "score": 100,
      "timeLimit": 30
    }
  ]
}`;
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
        reason: "Người học mới bắt đầu với triết học Mác-LêNin",
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

// Export improved functions
export {
  validateAnswerDistribution,
  normalizeCorrectAnswer,
  generateEnhancedPrompt,
  analyzeUserProgress,
  getNextMarxistOrder,
  getAllMarxistTopics,
  getRequiredXpForLevel,
};
