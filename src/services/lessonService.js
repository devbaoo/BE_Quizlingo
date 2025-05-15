import Lesson from "../models/lesson.js";
import User from "../models/user.js";
import Progress from "../models/progress.js";
import Question from "../models/question.js";

// Danh sách enum từ schema
const TOPICS = ["travel", "business", "daily_life", "education", "food"];
const SKILLS = ["vocabulary", "reading", "writing"];

// Lấy danh sách topic
const getTopics = async () => {
  try {
    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách chủ đề thành công",
      topics: TOPICS,
    };
  } catch (error) {
    console.error("Get topics error:", error);
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
    let availableSkills = [...SKILLS];

    if (userId && topic && level) {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      if (
        user.level === "beginner" &&
        !user.completedBasicVocab.includes(topic)
      ) {
        availableSkills = ["vocabulary"];
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách kỹ năng thành công",
      skills: availableSkills,
    };
  } catch (error) {
    console.error("Get skills error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách kỹ năng",
    };
  }
};

// Tạo bài học (admin)
const createLesson = async (lessonData) => {
  try {
    if (
      !lessonData.title ||
      !lessonData.type ||
      !lessonData.topic ||
      !lessonData.level ||
      !lessonData.skill ||
      !lessonData.questions
    ) {
      return {
        success: false,
        statusCode: 400,
        message:
          "Thiếu các trường bắt buộc: title, type, topic, level, skill, questions",
      };
    }

    const lesson = await Lesson.create({
      title: lessonData.title,
      type: lessonData.type,
      topic: lessonData.topic,
      level: lessonData.level,
      skill: lessonData.skill,
      maxScore:
        lessonData.level === "beginner"
          ? 1000
          : lessonData.level === "intermediate"
          ? 1500
          : 2000,
      timeLimit: lessonData.level === "beginner" ? 0 : 30,
      questions: [],
    });

    const questionIds = [];
    for (const q of lessonData.questions) {
      const question = await Question.create({
        lessonId: lesson._id,
        content: q.content,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        score: q.score || 100,
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
        type: lesson.type,
        topic: lesson.topic,
        level: lesson.level,
        skill: lesson.skill,
        maxScore: lesson.maxScore,
        timeLimit: lesson.timeLimit,
        createdAt: lesson.createdAt,
      },
    };
  } catch (error) {
    console.error("Create lesson error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi tạo bài học",
    };
  }
};

// Lấy danh sách bài học
const getLessons = async (userId, queryParams) => {
  try {
    console.log(
      `Get lessons called with userId: ${userId}, queryParams:`,
      queryParams
    );

    const { topic, level, skill, preferredSkills } = queryParams;

    // Kiểm tra dữ liệu đầu vào
    if (!topic || !TOPICS.includes(topic)) {
      console.error(`Invalid topic: ${topic}`);
      return {
        success: false,
        statusCode: 400,
        message: "Chủ đề không hợp lệ",
      };
    }
    if (!level || !["beginner", "intermediate", "advanced"].includes(level)) {
      console.error(`Invalid level: ${level}`);
      return {
        success: false,
        statusCode: 400,
        message: "Trình độ không hợp lệ",
      };
    }

    let query = { topic, level };
    if (skill) {
      if (!SKILLS.includes(skill)) {
        console.error(`Invalid skill: ${skill}`);
        return {
          success: false,
          statusCode: 400,
          message: "Kỹ năng không hợp lệ",
        };
      }
      query.skill = skill;
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy người dùng",
        };
      }
      if (
        user.level === "beginner" &&
        topic &&
        !user.completedBasicVocab.includes(topic)
      ) {
        console.log(
          `User ${userId} is beginner, restricting to vocabulary for topic ${topic}`
        );
        query.skill = "vocabulary";
      }
    }

    // Xử lý preferredSkills
    let sortOptions = {};
    if (preferredSkills) {
      const skillsArray = preferredSkills.split(",").map((s) => s.trim());
      console.log(`Preferred skills: ${skillsArray}`);
      if (skillsArray.includes("all")) {
        sortOptions = {};
      } else {
        const validSkills = skillsArray.filter((s) => SKILLS.includes(s));
        if (validSkills.length === 0) {
          console.error(
            `No valid skills in preferredSkills: ${preferredSkills}`
          );
          return {
            success: false,
            statusCode: 400,
            message: "Không có kỹ năng hợp lệ trong preferredSkills",
          };
        }
        sortOptions = { skill: { $in: validSkills } ? -1 : 1 };
      }
    }

    console.log(
      `Querying lessons with query:`,
      query,
      `sortOptions:`,
      sortOptions
    );
    const lessons = await Lesson.find(query)
      .populate("questions")
      .select("title type topic level skill maxScore timeLimit createdAt")
      .sort(sortOptions);

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách bài học thành công",
      lessons,
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
    const lesson = await Lesson.findById(lessonId).populate("questions");

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
    console.error("Get lesson by ID error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy bài học",
    };
  }
};

// Hoàn thành bài học
const completeLesson = async (
  userId,
  lessonId,
  score,
  questionResults,
  isRetried = false
) => {
  try {
    console.log(
      `Complete lesson called with userId: ${userId}, lessonId: ${lessonId}, score: ${score}`
    );

    if (!userId) {
      console.log("No userId provided, handling as guest");
      return {
        success: true,
        statusCode: 200,
        message: "Hoàn thành bài học (guest)",
        score,
        questionResults,
      };
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      console.error(`Lesson not found: ${lessonId}`);
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bài học",
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    if (!user.level) {
      console.warn(
        `User ${userId} has no level, setting default to 'beginner'`
      );
      user.level = "beginner";
    }

    if (
      user.level === "beginner" &&
      lesson.skill !== "vocabulary" &&
      !user.completedBasicVocab.includes(lesson.topic)
    ) {
      console.log(
        `User ${userId} is beginner and has not completed vocab for topic ${lesson.topic}`
      );
      return {
        success: false,
        statusCode: 403,
        message: "Vui lòng hoàn thành từ vựng cơ bản trước",
      };
    }

    const questionIds = questionResults.map((result) => result.questionId);
    console.log(`Checking questionIds: ${questionIds}`);
    const questions = await Question.find({
      _id: { $in: questionIds },
      lessonId,
    });
    if (questions.length !== questionIds.length) {
      console.error(
        `Invalid questionIds: ${questionIds}, found: ${questions.map(
          (q) => q._id
        )}`
      );
      return {
        success: false,
        statusCode: 400,
        message:
          "Một hoặc nhiều questionId không hợp lệ hoặc không thuộc lesson",
      };
    }

    if (user.level !== "beginner" && lesson.timeLimit > 0) {
      const hasTimeout = questionResults.some((result) => result.isTimeout);
      if (hasTimeout && user.lives > 0) {
        user.lives -= 1;
        console.log(
          `User ${userId} lost 1 life due to timeout. Lives remaining: ${user.lives}`
        );
      }
    }

    console.log(`Creating progress for user ${userId}, lesson ${lessonId}`);
    const progress = await Progress.create({
      userId,
      lessonId,
      score,
      isRetried,
      questionResults,
    });

    if (user.level === "beginner" && lesson.skill === "vocabulary") {
      if (!user.completedBasicVocab.includes(lesson.topic)) {
        user.completedBasicVocab.push(lesson.topic);
        console.log(
          `Added ${lesson.topic} to completedBasicVocab for user ${userId}`
        );
      }
    }

    user.xp += Math.round(score / 10);
    if (user.xp >= user.userLevel * 1000) {
      user.userLevel += 1;
      user.lives = Math.min(user.lives + 1, 5);
      console.log(
        `User ${userId} leveled up to userLevel ${user.userLevel}, lives: ${user.lives}`
      );
    }
    if (user.xp >= 1000 && user.level === "beginner") {
      user.level = "intermediate";
      console.log(`User ${userId} advanced to knowledge level: intermediate`);
    } else if (user.xp >= 2000 && user.level === "intermediate") {
      user.level = "advanced";
      console.log(`User ${userId} advanced to knowledge level: advanced`);
    }

    console.log(
      `Saving user ${userId} with xp: ${user.xp}, level: ${user.level}, userLevel: ${user.userLevel}`
    );
    await user.save();

    return {
      success: true,
      statusCode: 201,
      message: "Hoàn thành bài học thành công",
      progress,
      user: {
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills,
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

    if (user.lives <= 0) {
      return {
        success: false,
        statusCode: 403,
        message: "Không đủ mạng để làm lại",
      };
    }

    await Progress.deleteMany({ userId, lessonId });
    user.lives -= 1;
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Có thể làm lại bài học",
      lives: user.lives,
    };
  } catch (error) {
    console.error("Retry lesson error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi làm lại bài học",
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
};
