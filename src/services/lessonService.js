import mongoose from "mongoose";
import Lesson from "../models/lesson.js";
import User from "../models/user.js";
import Progress from "../models/progress.js";
import Question from "../models/question.js";
import Topic from "../models/topic.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";
import groqService from "./groqService.js";
import UserPackage from "../models/userPackage.js";
import moment from "moment-timezone";
import NotificationService from "./notificationService.js";
import userService from "./userService.js";
import UserLearningPath from "../models/userLearningPath.js";

const checkAndRegenerateLives = async (user) => {
  if (!user || user.lives >= 5) return;

  const now = new Date();
  const lastRegeneration = user.lastLivesRegenerationTime || now;
  const timeDiff = Math.floor((now - lastRegeneration) / (1000 * 60)); // Time difference in minutes

  if (timeDiff >= 10) {
    // Calculate how many lives to regenerate (1 per 10 minutes, up to max 5)
    const livesToRegenerate = Math.min(
      Math.floor(timeDiff / 10),
      5 - user.lives
    );

    if (livesToRegenerate > 0) {
      user.lives = Math.min(user.lives + livesToRegenerate, 5);
      user.lastLivesRegenerationTime = now;
      await user.save();
    }
  }

  return user;
};

// Lấy danh sách topic
const getTopics = async () => {
  try {
    const topics = await Topic.find({ isActive: true }).select(
      "name description"
    );
    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách chủ đề thành công",
      topics,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách chủ đề",
    };
  }
};

// Lấy danh sách skill
const getSkills = async (userId, topic, level) => {
  try {
    let skills = await Skill.find({ isActive: true }).select(
      "name description supportedTypes"
    );

    if (userId && topic && level) {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      const topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Chủ đề không hợp lệ hoặc không hoạt động",
        };
      }

      const levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Trình độ không hợp lệ hoặc không hoạt động",
        };
      }

      if (
        user.level &&
        user.level.toString() === levelDoc._id.toString() &&
        levelDoc.name === "beginner"
      ) {
        const completedVocab = user.completedBasicVocab.map((id) =>
          id.toString()
        );
        if (!completedVocab.includes(topic.toString())) {
          skills = skills.filter((skill) => skill.name === "vocabulary");
        }
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách kỹ năng thành công",
      skills,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách kỹ năng",
    };
  }
};

const createLesson = async (lessonData, token) => {
  try {
    const { title, topic, level, questions } = lessonData;


    if (!title || !topic || !level || !questions || !Array.isArray(questions) || questions.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: "Thiếu các trường bắt buộc: title, topic, level, questions",
      };
    }

    const topicDoc = await Topic.findById(topic);
    if (!topicDoc || !topicDoc.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: "Chủ đề không hợp lệ hoặc không hoạt động",
      };
    }

    const levelDoc = await Level.findById(level);
    if (!levelDoc || !levelDoc.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: "Cấp độ không hợp lệ hoặc không hoạt động",
      };
    }

    // Chuẩn hóa và lọc skill
    const allSkillIds = [...new Set(questions.map((q) => q.skill?.toString()))];
    const skillDocs = await Skill.find({ _id: { $in: allSkillIds }, isActive: true });

    if (skillDocs.length !== allSkillIds.length) {
      return {
        success: false,
        statusCode: 400,
        message: "Một hoặc nhiều kỹ năng trong câu hỏi không hợp lệ hoặc không hoạt động",
      };
    }

    // Kiểm tra từng câu hỏi
    for (const q of questions) {
      q.skill = q.skill?.toString();
      q.timeLimit = Number(q.timeLimit);

      if (!q.skill || !q.type || !q.content) {
        return {
          success: false,
          statusCode: 400,
          message: "Thiếu dữ liệu trong câu hỏi (type, content, skill)",
        };
      }

      if (q.type === "multiple_choice" && !q.correctAnswer) {
        return {
          success: false,
          statusCode: 400,
          message: "Thiếu correctAnswer cho câu hỏi multiple_choice",
        };
      }

      const skillDoc = skillDocs.find((s) => s._id.toString() === q.skill);
      if (!skillDoc) {
        return {
          success: false,
          statusCode: 400,
          message: `Không tìm thấy kỹ năng phù hợp với ID: ${q.skill}`,
        };
      }

      if (!skillDoc.supportedTypes.includes(q.type)) {
        return {
          success: false,
          statusCode: 400,
          message: `Kỹ năng ${skillDoc.name} không hỗ trợ loại câu hỏi ${q.type}`,
        };
      }

      if (!q.timeLimit || q.timeLimit <= 0) {
        return {
          success: false,
          statusCode: 400,
          message: "Mỗi câu hỏi phải có timeLimit hợp lệ (lớn hơn 0)",
        };
      }
    }

    const lesson = await Lesson.create({
      title,
      topic,
      level,
      skills: allSkillIds,
      maxScore: levelDoc.maxScore,
      questions: [], // sẽ cập nhật sau
    });

    const questionIds = [];

    for (const q of questions) {
      const skillDoc = skillDocs.find((s) => s._id.toString() === q.skill);

      if (skillDoc.name.toLowerCase() === "listening" && q.content) {
        const ttsResult = await groqService.textToSpeechAndUpload(q.content);
        if (ttsResult.success) {
          q.audioContent = ttsResult.audioUrl;
        } else {
          console.warn("TTS failed:", ttsResult.message);
        }
      }

      const question = await Question.create({
        lessonId: lesson._id,
        skill: q.skill,
        type: q.type,
        timeLimit: q.timeLimit,
        content: q.content,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        score: q.score || 100,
        audioContent: q.audioContent,
      });

      questionIds.push(question._id);
    }

    lesson.questions = questionIds;
    await lesson.save();

    return {
      success: true,
      statusCode: 201,
      message: "Tạo bài học thành công",
      lesson: {
        lessonId: lesson._id,
        title: lesson.title,
        topic: lesson.topic,
        level: lesson.level,
        skills: lesson.skills,
        maxScore: lesson.maxScore,
        questions: questionIds,
        createdAt: lesson.createdAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi tạo bài học",
    };
  }
};


// Cập nhật bài học (admin)
const updateLesson = async (lessonId, lessonData) => {
  try {
    const { title, topic, level, questions } = lessonData;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học",
      };
    }

    if (questions && (!Array.isArray(questions) || questions.length === 0)) {
      return {
        success: false,
        statusCode: 400,
        message: "Danh sách câu hỏi không hợp lệ",
      };
    }

    let topicDoc = lesson.topic;
    if (topic) {
      topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Chủ đề không hợp lệ hoặc không hoạt động",
        };
      }
    }

    let levelDoc = lesson.level;
    if (level) {
      levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Cấp độ không hợp lệ hoặc không hoạt động",
        };
      }
    }

    if (questions) {
      const allSkillIds = [...new Set(questions.map((q) => q.skill))];
      const skillDocs = await Skill.find({
        _id: { $in: allSkillIds },
        isActive: true,
      });

      if (skillDocs.length !== allSkillIds.length) {
        return {
          success: false,
          statusCode: 400,
          message: "Một hoặc nhiều kỹ năng trong câu hỏi không hợp lệ hoặc không hoạt động",
        };
      }

      for (const q of questions) {
        if (!q.skill || !q.type || !q.content) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu dữ liệu trong câu hỏi (type, content, skill)",
          };
        }

        if (q.type === "multiple_choice" && !q.correctAnswer) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu correctAnswer cho câu hỏi multiple_choice",
          };
        }

        const skillDoc = skillDocs.find((s) => s._id.toString() === q.skill);
        if (!skillDoc || !skillDoc.supportedTypes.includes(q.type)) {
          return {
            success: false,
            statusCode: 400,
            message: `Kỹ năng ${skillDoc?.name || "n/a"} không hỗ trợ loại câu hỏi ${q.type}`,
          };
        }

        if (!q.timeLimit || q.timeLimit <= 0) {
          return {
            success: false,
            statusCode: 400,
            message: "Câu hỏi thiếu timeLimit hợp lệ (lớn hơn 0)",
          };
        }
      }

      await Question.deleteMany({ lessonId: lesson._id });

      const questionIds = [];
      for (const q of questions) {
        const skillDoc = skillDocs.find((s) => s._id.toString() === q.skill);

        if (skillDoc.name.toLowerCase() === "listening" && q.content) {
          const ttsResult = await groqService.textToSpeechAndUpload(q.content);
          if (ttsResult.success) {
            q.audioContent = ttsResult.audioUrl;
          } else {
            console.warn("TTS failed:", ttsResult.message);
          }
        }

        const question = await Question.create({
          lessonId: lesson._id,
          skill: q.skill,
          type: q.type,
          timeLimit: q.timeLimit, // ✅ Đã thêm
          content: q.content,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          score: q.score || 100,
          audioContent: q.audioContent,
        });

        questionIds.push(question._id);
      }

      lesson.questions = questionIds;
      lesson.skills = allSkillIds;
    }

    if (title) lesson.title = title;
    if (topic) lesson.topic = topic;
    if (level) {
      lesson.level = level;
      lesson.maxScore = levelDoc.maxScore;
      // lesson.timeLimit = levelDoc.timeLimit; ❌ Bỏ dòng này
    }

    await lesson.save();

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật bài học thành công",
      lesson: {
        lessonId: lesson._id,
        title: lesson.title,
        topic: lesson.topic,
        level: lesson.level,
        skills: lesson.skills,
        maxScore: lesson.maxScore,
        updatedAt: lesson.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi cập nhật bài học",
    };
  }
};


const getLessons = async (userId, queryParams) => {
  try {
    const { level, skill, preferredSkills, page = 1, limit = 3 } = queryParams;

    let query = {};
    let levelDoc, skillDoc;
    let user = null;

    if (userId) {
      user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy người dùng",
        };
      }
    }

    if (level) {
      levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Trình độ không hợp lệ hoặc không hoạt động",
        };
      }
      query.level = level;

      if (user?.level && user.level.toString() !== levelDoc._id.toString()) {
        return {
          success: false,
          statusCode: 400,
          message: "Cấp độ không khớp với người dùng",
        };
      }
    }

    if (skill) {
      skillDoc = await Skill.findById(skill);
      if (!skillDoc || !skillDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Kỹ năng không hợp lệ hoặc không hoạt động",
        };
      }
      query.skill = skill;
    }

    let sortOptions = {};
    if (preferredSkills) {
      const skillsArray = preferredSkills.split(",").map((s) => s.trim());
      if (!skillsArray.includes("all")) {
        const validSkills = await Skill.find({
          _id: { $in: skillsArray },
          isActive: true,
        });
        if (validSkills.length === 0) {
          return {
            success: false,
            statusCode: 400,
            message: "Không có kỹ năng hợp lệ trong preferredSkills",
          };
        }
        sortOptions = { skill: -1 };
      }
    }

    // Lấy tất cả bài học
    const allLessons = await Lesson.find(query)
      .populate("questions topic level skills") // ✅ Sửa lại ở đây
      .select("title topic level skills maxScore timeLimit createdAt")
      .sort(sortOptions);

    // Lấy các bài học user đã hoàn thành
    let completedLessonIds = [];
    if (userId) {
      completedLessonIds = await Progress.distinct("lessonId", {
        userId,
        status: "COMPLETE",
      });
    }

    // Gắn trạng thái cho từng bài học
    const lessonsWithStatus = allLessons.map((lesson) => {
      const isCompleted = completedLessonIds.some(
        (id) => id.toString() === lesson._id.toString()
      );
      return {
        ...lesson.toObject(),
        status: isCompleted ? "COMPLETE" : "LOCKED",
      };
    });

    // Nhóm bài học theo topic
    const topicMap = new Map();
    for (const lesson of lessonsWithStatus) {
      const topicId = lesson.topic._id.toString();
      if (!topicMap.has(topicId)) {
        topicMap.set(topicId, {
          topic: lesson.topic,
          lessons: [],
        });
      }
      topicMap.get(topicId).lessons.push(lesson);
    }

    // Chuyển sang mảng và phân trang theo topic
    const groupedByTopic = Array.from(topicMap.values());
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 3;
    const skip = (pageNum - 1) * pageSize;
    const paginated = groupedByTopic.slice(skip, skip + pageSize);

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách bài học thành công",
      topics: paginated,
      pagination: {
        currentPage: pageNum,
        pageSize,
        totalTopics: groupedByTopic.length,
        totalPages: Math.ceil(groupedByTopic.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get lessons error:", {
      message: error.message,
      stack: error.stack,
      userId,
      queryParams,
    });
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi lấy danh sách bài học: ${error.message}`,
    };
  }
};

// Lấy chi tiết bài học
const getLessonById = async (lessonId) => {
  try {
    const lesson = await Lesson.findById(lessonId).populate(
      "questions topic level skills"
    );

    if (!lesson) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy bài học thành công",
      lesson,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy bài học",
    };
  }
};

const getRequiredXpForLevel = (level) => {
  // Giảm tốc độ tăng XP yêu cầu để user dễ lên cấp hơn
  return Math.floor(100 * Math.pow(1.3, level - 1));
};

const upgradeUserLevel = async (user, currentLevelId) => {
  const allLevels = await Level.find().sort({ order: 1 });
  const currentIndex = allLevels.findIndex(
    (l) => l._id.toString() === currentLevelId.toString()
  );

  if (currentIndex === -1 || currentIndex >= allLevels.length - 1) return;

  const nextLevel = allLevels[currentIndex + 1];

  const passedLessons = await Progress.countDocuments({
    userId: user._id,
    score: { $gte: nextLevel.minScoreRequired || 70 },
  });

  const meetsUserLevel = user.userLevel >= nextLevel.minUserLevel;
  const meetsLessonPassed = passedLessons >= nextLevel.minLessonPassed;

  if (meetsUserLevel && meetsLessonPassed) {
    user.level = nextLevel._id;
  }
};

const getNextLearningOrder = async (userId) => {
  const lastPath = await UserLearningPath
    .findOne({ userId })
    .sort({ order: -1 });

  return lastPath ? lastPath.order + 1 : 1;
};

const generateLessonForUser = async (userId) => {
  console.log("🟡 Generating lesson for userId:", userId);
  try {
    const profileRes = await userService.getUserProfile(userId);
    console.log("✅ Profile result:", profileRes);
    if (!profileRes.success) return profileRes;

    const user = profileRes.user;
    const levelName = user.level || "Beginner";
    const userLevel = user.userLevel || 1;
    const preferredTopics = user.preferredTopics || [];
    const preferredSkills = user.preferredSkills || [];


    const progresses = await Progress.find({ userId }).populate("lessonId");
    const skillStats = {};

    for (const progress of progresses) {
      for (const result of progress.questionResults) {
        const skillId = result?.questionId?.skill?.toString();
        if (!skillId) continue;
        if (!skillStats[skillId]) skillStats[skillId] = { total: 0, correct: 0 };
        skillStats[skillId].total += 1;
        if (result.isCorrect) skillStats[skillId].correct += 1;
      }
    }

    const topSkills = preferredSkills.slice();
    if (Object.keys(skillStats).length > 0) {
      const statsSkills = await Skill.find({ _id: { $in: Object.keys(skillStats) } });
      const sorted = statsSkills.sort((a, b) => {
        const accA = skillStats[a._id]?.correct / skillStats[a._id]?.total;
        const accB = skillStats[b._id]?.correct / skillStats[b._id]?.total;
        return accA - accB;
      });
      for (const s of sorted) {
        if (!topSkills.includes(s.name)) topSkills.push(s.name);
      }
    }

    const selectedSkills = [...new Set(topSkills)].slice(0, 3);
    const selectedTopic = preferredTopics[0] || "Daily Life";

    const levelTypeMap = {
      Beginner: ["multiple_choice"],
      Intermediate: ["multiple_choice", "text_input"],
      Advanced: ["multiple_choice", "text_input", "audio_input"],
    };

    const allowedTypes = levelTypeMap[levelName] || ["multiple_choice"];

    const skillDocs = await Skill.find({
      name: { $in: selectedSkills.map((s) => new RegExp(`^${s}$`, "i")) },
      isActive: true,
    });

    if (!skillDocs.length) return { success: false, message: "Không tìm thấy kỹ năng phù hợp" };

    let promptParts = [];
    for (const skill of skillDocs) {
      const types = skill.supportedTypes.filter((t) => allowedTypes.includes(t));
      if (types.length === 0) continue;

      const isSpecial = ["speaking", "listening"].includes(skill.name.toLowerCase());
      const count = isSpecial ? 1 : skill.analysis?.recommendLength || 2;

      const examples = skill.analysis?.recommendedPromptExamples?.join(", ") || "";
      const commonMistakes = skill.analysis?.commonMistakes?.join(", ") || "";

      promptParts.push(`
Tạo ${count} câu hỏi cho kỹ năng: ${skill.name}.
Chỉ sử dụng loại câu hỏi: ${types.join(", ")}.
Gợi ý nội dung: ${examples}.
Lỗi thường gặp: ${commonMistakes}.
`);
    }

    const prompt = `Bạn là giáo viên tiếng Anh.
    ⚠️ CHỈ trả về kết quả ở định dạng JSON. KHÔNG thêm bất kỳ dòng chữ nào trước/sau. KHÔNG giải thích.
Tạo một bài học với trình độ "${levelName}" và chủ đề "${selectedTopic}".
Mỗi kỹ năng chỉ được dùng đúng loại câu hỏi được hỗ trợ như sau:
- Listening: chỉ dùng multiple_choice hoặc text_input, không dùng audio_input.
- Speaking: chỉ dùng audio_input, tối đa 1 câu.
- Các kỹ năng khác chọn tự do trong: ${allowedTypes.join(", ")}.
Trả kết quả dưới dạng JSON như sau:

{
  "title": "Tên bài học",
  "topic": "${selectedTopic}",
  "level": "${levelName}",
  "questions": [
    {
      "type": "multiple_choice" | "text_input" | "audio_input",
      "content": "...",
      "skill": "...",
      "options": [...],
      "correctAnswer": "...",
      "score": 100,
      "timeLimit": 30
    }
  ]
}
${promptParts.join("\n")}`;

    const groqRes = await groqService.generateJsonFromPrompt(prompt);
    if (!groqRes.success) return groqRes;
    console.log("[DEBUG] Raw Groq response:\n", groqRes.data);


    const lessonData = groqRes.data;

    const [levelDoc, topicDoc, allSkills] = await Promise.all([
      Level.findOne({ name: lessonData.level }),
      Topic.findOne({ name: lessonData.topic }),
      Skill.find({ isActive: true }),
    ]);

    const skillMap = {};
    const typeMap = {};
    for (const s of allSkills) {
      const key = s.name.toLowerCase();
      skillMap[key] = s._id;
      typeMap[key] = s.supportedTypes || [];
    }

    const skillCounters = { speaking: 0, listening: 0 };
    const finalQuestions = [];

    for (const q of lessonData.questions || []) {
      const name = q.skill?.toLowerCase();
      if (!name || !skillMap[name]) continue;
      if (!typeMap[name].includes(q.type)) continue;

      if (name === "speaking" && ++skillCounters.speaking > 1) continue;
      if (name === "listening" && ++skillCounters.listening > 1) continue;

      if (q.type === "multiple_choice") {
        if (typeof q.correctAnswer === "string" && q.correctAnswer.match(/^\d+\.\s*/)) {
          q.correctAnswer = q.correctAnswer.replace(/^\d+\.\s*/, "").trim();
        }

        if (typeof q.correctAnswer === "number" && q.options?.[q.correctAnswer]) {
          q.correctAnswer = q.options[q.correctAnswer];
        }

        if (!q.options?.includes(q.correctAnswer)) continue;
      }

      if (q.type === "text_input" && (!q.timeLimit || q.timeLimit <= 0)) continue;

      finalQuestions.push({ ...q, skill: skillMap[name] });
    }


    if (!finalQuestions.length) {
      return { success: false, message: "Không có câu hỏi hợp lệ" };
    }

    const createRes = await createLesson({
      title: lessonData.title,
      topic: topicDoc?._id,
      level: levelDoc?._id,
      questions: finalQuestions,
      isAutoGenerated: true,
    });

    if (createRes.success) {
      await NotificationService.createNotification(userId, {
        title: "📘 Bài học mới từ AI đã sẵn sàng!",
        message: `AI đã tạo bài học \"${createRes.lesson.title}\". Hãy vào học ngay để nâng cao trình độ nhé!`,
        type: "ai_generated",
        link: "/learn",
      });
    }
    const last3Progresses = await Progress.find({ userId }).sort({ createdAt: -1 }).limit(3);
    let accuracy = 0;

    if (last3Progresses.length) {
      let totalQuestions = 0, correctAnswers = 0;
      for (const prog of last3Progresses) {
        for (const r of prog.questionResults) {
          totalQuestions += 1;
          if (r.isCorrect) correctAnswers += 1;
        }
      }
      accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    }

    try {
      const path = await UserLearningPath.create({
        userId: user._id,
        lessonId: createRes.lesson.lessonId,
        source: 'ai_generated',
        focusSkills: selectedSkills,
        accuracyBefore: Math.round(accuracy),
        recommendedReason: 'Based on performance from last 3 lessons',
        order: await getNextLearningOrder(user._id),
      });
      console.log("✅ UserLearningPath created:", path);
    } catch (err) {
      console.error("❌ Failed to create UserLearningPath:", err.message);
    }
    return createRes;
  } catch (error) {
    return { success: false, message: "Lỗi khi tạo bài học: " + error.message };
  }
};

const completeLesson = async (
  userId,
  lessonId,
  score,
  questionResults,
  isRetried = false
) => {
  try {
    if (!userId) {
      return {
        success: true,
        statusCode: 200,
        message: "Hoàn thành bài học (guest)",
        status: "COMPLETE",
        score,
        questionResults,
      };
    }

    const existingProgress = await Progress.findOne({ userId, lessonId });
    if (existingProgress && existingProgress.status === "COMPLETE") {
      return {
        success: false,
        statusCode: 409,
        message: "Bài học đã được hoàn thành trước đó",
        status: existingProgress.status,
        progress: existingProgress,
      };
    }

    const lesson = await Lesson.findById(lessonId)
      .populate("topic")
      .populate("level");
    if (!lesson)
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học",
      };

    const user = await User.findById(userId);
    if (!user)
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };

    await checkAndRegenerateLives(user);

    const now = moment().tz("Asia/Ho_Chi_Minh");
    const activePackage = await UserPackage.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: now.toDate() },
      paymentStatus: "completed",
    }).populate("package");

    const hasPremium = activePackage?.package?.features || {};
    const doubleXP = hasPremium.doubleXP || false;
    const unlimitedLives = hasPremium.unlimitedLives || false;

    if (!user.level) {
      user.level = (await Level.findOne({ name: "beginner" }))?._id;
    }

    const lessonTopic = lesson.topic._id.toString();
    const userLevel = await Level.findById(user.level);

    if (userLevel.name === "beginner") {
      const completedVocab = user.completedBasicVocab.map((id) =>
        id.toString()
      );
      if (!completedVocab.includes(lessonTopic)) {
        return {
          success: false,
          statusCode: 403,
          message: "Vui lòng hoàn thành từ vựng cơ bản trước",
        };
      }
    }

    const questionIds = questionResults.map((r) => r.questionId);
    const questions = await Question.find({
      _id: { $in: questionIds },
      lessonId,
    }).populate("skill");

    if (questions.length !== questionIds.length) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Một hoặc nhiều questionId không hợp lệ hoặc không thuộc lesson",
      };
    }

    for (let i = 0; i < questionResults.length; i++) {
      const result = questionResults[i];
      const question = questions.find(
        (q) => q._id.toString() === result.questionId.toString()
      );
      const answer =
        result.answer || (result.isTimeout ? "[TIMEOUT]" : "[UNANSWERED]");

      switch (question.type) {
        case "text_input": {
          const skillName = question.skill?.name?.toLowerCase();

          if (skillName === "writing") {
            const evalRes = await groqService.evaluateWritingTextInput(
              question.content,
              answer
            );
            questionResults[i] = {
              ...result,
              answer,
              score: typeof evalRes.score === "number" ? evalRes.score : 0,
              isCorrect:
                typeof evalRes.score === "number" ? evalRes.score >= 50 : false,
              feedback: evalRes.feedback || "Lỗi chấm điểm",
            };
          } else if (skillName === "reading") {
            const evalRes = await groqService.evaluateWritingTextInput(
              question.content,
              answer
            );
            questionResults[i] = {
              ...result,
              answer,
              score: typeof evalRes.score === "number" ? evalRes.score : 0,
              isCorrect: typeof evalRes.score === "number" ? evalRes.score >= 50 : false,
              feedback: evalRes.feedback || "Lỗi chấm điểm",
            };
          } else if (skillName === "listening") {
            const evalRes = await groqService.evaluateListeningTextInput(
              question.correctAnswer,
              answer
            );
            questionResults[i] = {
              ...result,
              answer,
              score: evalRes.score ?? 0,
              isCorrect: evalRes.isCorrect ?? false,
              feedback: evalRes.feedback || "",
            };
          } else {
            questionResults[i] = {
              ...result,
              answer,
              isCorrect: answer === question.correctAnswer,
              score: answer === question.correctAnswer ? question.score : 0,
            };
          }
          break;
        }

        case "multiple_choice": {
          questionResults[i] = {
            ...result,
            answer,
            isCorrect: answer === question.correctAnswer,
            score: answer === question.correctAnswer ? question.score : 0,
          };
          break;
        }

        case "audio_input": {
          if (question.type === "audio_input" && result.answer) {
            const audioBuffer = Buffer.from(result.answer, "base64");
            const skillName = question.skill?.name?.toLowerCase();

            if (skillName === "speaking") {
              const evalRes = await groqService.evaluatePronunciationFromAudio(
                audioBuffer,
                question.content
              );
              questionResults[i] = evalRes.success
                ? {
                  ...result,
                  score: evalRes.score,
                  feedback: evalRes.feedback,
                  transcription: evalRes.transcription,
                  isCorrect: evalRes.score >= 50,
                  answer: evalRes.transcription || "[UNANSWERED]",
                }
                : {
                  ...result,
                  score: 0,
                  feedback: evalRes.message,
                  isCorrect: false,
                  answer: "[ERROR]",
                };
            } else {
              const evalRes = await groqService.evaluatePronunciation(
                question.correctAnswer,
                audioBuffer
              );
              questionResults[i] = evalRes.success
                ? {
                  ...result,
                  score: evalRes.score,
                  feedback: evalRes.feedback,
                  transcription: evalRes.transcription,
                  isCorrect: evalRes.score >= 50,
                  answer: evalRes.transcription || "[UNANSWERED]",
                }
                : {
                  ...result,
                  score: 0,
                  feedback: evalRes.message,
                  isCorrect: false,
                  answer: "[ERROR]",
                };
            }
          }
          break;
        }
      }
    }

    // Fallback để đảm bảo score luôn có
    for (let i = 0; i < questionResults.length; i++) {
      if (typeof questionResults[i].score !== "number")
        questionResults[i].score = 0;
      if (typeof questionResults[i].isCorrect !== "boolean")
        questionResults[i].isCorrect = false;
    }

    score = questionResults.reduce((total, r) => total + (r.score || 0), 0);
    const correctAnswers = questionResults.filter((r) => r.isCorrect).length;
    const accuracy = (correctAnswers / questionResults.length) * 100;
    const lessonStatus = accuracy >= 70 ? "COMPLETE" : "FAILED";

    const hasTimeout = questionResults.some((r) => r.isTimeout);
    if ((accuracy < 70 || hasTimeout) && user.lives > 0 && !unlimitedLives) {
      user.lives -= 1;
      user.lastLivesRegenerationTime = new Date();
    }

    const progress = await Progress.create({
      userId,
      lessonId,
      score,
      status: lessonStatus,
      isRetried,
      questionResults,
    });

    if (
      userLevel.name === "beginner" &&
      lessonStatus === "COMPLETE" &&
      lesson.skills?.some((s) => s.name === "vocabulary")
    ) {
      const completedVocab = user.completedBasicVocab.map((id) =>
        id.toString()
      );
      if (!completedVocab.includes(lessonTopic)) {
        user.completedBasicVocab.push(lessonTopic);
      }
    }

    let earnedXP = Math.round(score / 10);
    if (doubleXP) earnedXP *= 2;
    user.xp += earnedXP;

    const requiredXp = getRequiredXpForLevel(user.userLevel);
    if (user.xp >= requiredXp) {
      user.userLevel += 1;
      user.xp = 0;
      user.lives = Math.min(user.lives + 1, 5);

      try {
        await NotificationService.createLevelUpNotification(
          user._id,
          user.userLevel
        );
      } catch (error) {
        console.error("[DEBUG] Failed to create level up notification:", error);
      }
    }

    // Dù userLevel có tăng hay không, vẫn check nâng level tiếng Anh
    await upgradeUserLevel(user, user.level);
    await user.save();

    if (lessonStatus === "COMPLETE") {
      Promise.resolve().then(async () => {
        try {
          await generateLessonForUser(user._id);
        } catch (err) {
          console.warn("Tạo bài học tự động thất bại:", err.message);
        }
      });
    }


    return {
      success: true,
      statusCode: 201,
      message:
        lessonStatus === "COMPLETE"
          ? "Hoàn thành bài học thành công"
          : "Bài học chưa được hoàn thành",
      status: lessonStatus,
      progress,
      user: {
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills,
        nextLevelXp: getRequiredXpForLevel(user.userLevel) - user.xp,
      },
      premium: {
        doubleXP,
        unlimitedLives,
        earnedXP,
      },
    };
  } catch (error) {
    console.error("Complete lesson error:", {
      message: error.message,
      stack: error.stack,
      userId,
      lessonId,
      score,
      questionResults,
    });
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi hoàn thành bài học: ${error.message}`,
    };
  }
};

// Làm lại bài học
const retryLesson = async (userId, lessonId) => {
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
        message: "Không đủ lượt chơi để làm lại",
      };
    }

    // Xoá tiến trình bài học cũ
    await Progress.deleteMany({ userId, lessonId });

    // Trừ lives nếu không phải là premium
    if (!unlimitedLives) {
      user.lives -= 1;
      user.lastLivesRegenerationTime = new Date();
      await user.save();
    }

    return {
      success: true,
      statusCode: 200,
      message: "Có thể làm lại bài học",
      lives: user.lives,
      premium: {
        unlimitedLives,
      },
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi làm lại bài học",
    };
  }
};

// Lấy tất cả bài học (dành cho admin)
const getAllLessonsForAdmin = async (queryParams = {}) => {
  try {
    const {
      topic,
      level,
      skill,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryParams;

    let query = {};

    if (topic) {
      const topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Chủ đề không hợp lệ hoặc không hoạt động",
        };
      }
      query.topic = topic;
    }

    if (level) {
      const levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Cấp độ không hợp lệ hoặc không hoạt động",
        };
      }
      query.level = level;
    }

    if (skill) {
      const skillDoc = await Skill.findById(skill);
      if (!skillDoc || !skillDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Kỹ năng không hợp lệ hoặc không hoạt động",
        };
      }
      query.skill = skill;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const total = await Lesson.countDocuments(query);
    const lessons = await Lesson.find(query)
      .populate("questions topic level skill")
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách bài học thành công",
      data: {
        lessons,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi lấy danh sách bài học: ${error.message}`,
    };
  }
};

// Soft delete một bài học
const deleteLesson = async (lessonId) => {
  try {
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học",
      };
    }

    await lesson.deleteOne();

    return {
      success: true,
      statusCode: 200,
      message: "Xóa bài học thành công",
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      message: error.message || "Lỗi khi xóa bài học",
    };
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
  getAllLessonsForAdmin,
  deleteLesson,
  updateLesson,
  checkAndRegenerateLives,
  generateLessonForUser,
};
