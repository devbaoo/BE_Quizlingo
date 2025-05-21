import mongoose from 'mongoose';
import Lesson from '../models/lesson.js';
import User from '../models/user.js';
import Progress from '../models/progress.js';
import Question from '../models/question.js';
import Topic from '../models/topic.js';
import Level from '../models/level.js';
import Skill from '../models/skill.js';
import groqService from './groqService.js';

// Function to check and regenerate lives
const checkAndRegenerateLives = async (user) => {
  if (!user || user.lives >= 5) return;

  const now = new Date();
  const lastRegeneration = user.lastLivesRegenerationTime || now;
  const timeDiff = Math.floor((now - lastRegeneration) / (1000 * 60)); // Time difference in minutes

  if (timeDiff >= 10) {
    // Calculate how many lives to regenerate (1 per 10 minutes, up to max 5)
    const livesToRegenerate = Math.min(Math.floor(timeDiff / 10), 5 - user.lives);

    if (livesToRegenerate > 0) {
      user.lives = Math.min(user.lives + livesToRegenerate, 5);
      user.lastLivesRegenerationTime = now;
      await user.save();
      console.log(`Regenerated ${livesToRegenerate} lives for user ${user._id}`);
    }
  }

  return user;
};

// Lấy danh sách topic
const getTopics = async () => {
  try {
    const topics = await Topic.find({ isActive: true }).select('name description');
    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách chủ đề thành công',
      topics
    };
  } catch (error) {
    console.error('Get topics error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi lấy danh sách chủ đề'
    };
  }
};

// Lấy danh sách skill
const getSkills = async (userId, topic, level) => {
  try {
    let skills = await Skill.find({ isActive: true }).select('name description supportedTypes');

    if (userId && topic && level) {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return {
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy người dùng'
        };
      }

      const topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        console.error(`Invalid topic: ${topic}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Chủ đề không hợp lệ hoặc không hoạt động'
        };
      }

      const levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        console.error(`Invalid level: ${level}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Trình độ không hợp lệ hoặc không hoạt động'
        };
      }

      if (user.level && user.level.toString() === levelDoc._id.toString() && levelDoc.name === 'beginner') {
        const completedVocab = user.completedBasicVocab.map(id => id.toString());
        if (!completedVocab.includes(topic.toString())) {
          skills = skills.filter(skill => skill.name === 'vocabulary');
        }
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách kỹ năng thành công',
      skills
    };
  } catch (error) {
    console.error('Get skills error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi lấy danh sách kỹ năng'
    };
  }
};

// Tạo bài học (admin)
const createLesson = async (lessonData, token) => {
  try {
    const { title, type, topic, level, skill, questions } = lessonData;

    // Kiểm tra các trường bắt buộc
    if (!title || !type || !topic || !level || !skill || !questions) {
      return {
        success: false,
        statusCode: 400,
        message: 'Thiếu các trường bắt buộc: title, type, topic, level, skill, questions',
      };
    }

    // Kiểm tra topic, level, skill
    const topicDoc = await Topic.findById(topic);
    if (!topicDoc || !topicDoc.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: 'Chủ đề không hợp lệ hoặc không hoạt động',
      };
    }

    const levelDoc = await Level.findById(level);
    if (!levelDoc || !levelDoc.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: 'Cấp độ không hợp lệ hoặc không hoạt động',
      };
    }

    const skillDoc = await Skill.findById(skill);
    if (!skillDoc || !skillDoc.isActive) {
      return {
        success: false,
        statusCode: 400,
        message: 'Kỹ năng không hợp lệ hoặc không hoạt động',
      };
    }

    // Kiểm tra loại câu hỏi theo kỹ năng
    if (type === 'multiple_choice' && !skillDoc.supportedTypes.includes('multiple_choice')) {
      return {
        success: false,
        statusCode: 400,
        message: 'Loại multiple_choice không được hỗ trợ bởi kỹ năng này',
      };
    }

    if (type === 'text_input' && skillDoc.name.toLowerCase() !== 'writing') {
      return {
        success: false,
        statusCode: 400,
        message: 'Loại text_input chỉ áp dụng cho kỹ năng writing',
      };
    }

    if (type === 'audio_input' && skillDoc.name.toLowerCase() !== 'speaking') {
      return {
        success: false,
        statusCode: 400,
        message: 'Loại audio_input chỉ áp dụng cho kỹ năng speaking',
      };
    }

    // Tạo lesson mới
    const lesson = await Lesson.create({
      title,
      type,
      topic,
      level,
      skill,
      maxScore: levelDoc.maxScore,
      timeLimit: levelDoc.timeLimit,
      questions: [],
    });

    const questionIds = [];

    for (const q of questions) {
      // Gọi Groq TTS nếu là kỹ năng listening
      if (skillDoc.name.toLowerCase() === 'listening' && q.content) {
        console.log("→ Gọi TTS với nội dung:", q.content);

        try {
          const ttsResponse = await fetch(`${process.env.BASE_URL}/api/speech/text-to-speech`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text: q.content, voice: 'female' }),
          });

          const ttsData = await ttsResponse.json();
          console.log("← Kết quả TTS:", ttsData);

          if (ttsData.success) {
            q.audioContent = ttsData.audioContent;
          } else {
            console.warn(`TTS thất bại: ${ttsData.message}`);
          }
        } catch (err) {
          console.error('Gọi TTS thất bại:', err.message);
        }
      }

      // Tạo câu hỏi
      const question = await Question.create({
        lessonId: lesson._id,
        content: q.content,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        score: q.score || 100,
        audioContent: q.audioContent,
      });

      questionIds.push(question._id);
    }

    // Cập nhật danh sách câu hỏi
    lesson.questions = questionIds;
    await lesson.save();

    return {
      success: true,
      statusCode: 201,
      message: 'Tạo bài học thành công',
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
    console.error('Create lesson error:', error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || 'Lỗi khi tạo bài học',
    };
  }
};

// Cập nhật bài học (admin)
const updateLesson = async (lessonId, lessonData) => {
  try {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy bài học'
      };
    }

    const { title, type, topic, level, skill, questions } = lessonData;

    // Kiểm tra topic nếu được cung cấp
    let topicDoc = lesson.topic;
    if (topic) {
      topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: 'Chủ đề không hợp lệ hoặc không hoạt động'
        };
      }
    }

    // Kiểm tra level nếu được cung cấp
    let levelDoc = lesson.level;
    if (level) {
      levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: 'Cấp độ không hợp lệ hoặc không hoạt động'
        };
      }
    }

    // Kiểm tra skill và type
    let skillDoc = lesson.skill;
    if (skill) {
      skillDoc = await Skill.findById(skill);
      if (!skillDoc || !skillDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: 'Kỹ năng không hợp lệ hoặc không hoạt động'
        };
      }
    }

    if (type && skill) {
      if (type === 'multiple_choice' && !skillDoc.supportedTypes.includes('multiple_choice')) {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại multiple_choice không được hỗ trợ bởi kỹ năng này'
        };
      }
      if (type === 'text_input' && skillDoc.name !== 'writing') {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại text_input chỉ áp dụng cho kỹ năng writing'
        };
      }
      if (type === 'audio_input' && skillDoc.name !== 'speaking') {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại audio_input chỉ áp dụng cho kỹ năng speaking'
        };
      }
    } else if (type) {
      const currentSkill = await Skill.findById(lesson.skill);
      if (type === 'multiple_choice' && !currentSkill.supportedTypes.includes('multiple_choice')) {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại multiple_choice không được hỗ trợ bởi kỹ năng hiện tại'
        };
      }
      if (type === 'text_input' && currentSkill.name !== 'writing') {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại text_input chỉ áp dụng cho kỹ năng writing'
        };
      }
      if (type === 'audio_input' && currentSkill.name !== 'speaking') {
        return {
          success: false,
          statusCode: 400,
          message: 'Loại audio_input chỉ áp dụng cho kỹ năng speaking'
        };
      }
    } else if (skill) {
      if (lesson.type === 'multiple_choice' && !skillDoc.supportedTypes.includes('multiple_choice')) {
        return {
          success: false,
          statusCode: 400,
          message: 'Kỹ năng không tương thích với loại multiple_choice'
        };
      }
      if (lesson.type === 'text_input' && skillDoc.name !== 'writing') {
        return {
          success: false,
          statusCode: 400,
          message: 'Kỹ năng không tương thích với loại text_input'
        };
      }
      if (lesson.type === 'audio_input' && skillDoc.name !== 'speaking') {
        return {
          success: false,
          statusCode: 400,
          message: 'Kỹ năng không tương thích với loại audio_input'
        };
      }
    }

    // Cập nhật thông tin bài học
    if (title !== undefined) lesson.title = title;
    if (type !== undefined) lesson.type = type;
    if (topic !== undefined) lesson.topic = topic;
    if (level !== undefined) lesson.level = level;
    if (skill !== undefined) lesson.skill = skill;

    // Cập nhật maxScore và timeLimit nếu level thay đổi
    if (level) {
      lesson.maxScore = levelDoc.maxScore;
      lesson.timeLimit = levelDoc.timeLimit;
    }

    // Xử lý cập nhật câu hỏi
    if (questions && questions.length > 0) {
      await Question.deleteMany({ lessonId: lesson._id });
      const questionIds = [];
      for (const q of questions) {
        if (skillDoc.name === 'listening' && q.content) {
          const audioResult = await groqService.textToSpeech(q.content);
          if (audioResult.success) {
            q.audioContent = audioResult.audioContent;
          }
        }

        const question = await Question.create({
          lessonId: lesson._id,
          content: q.content,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          score: q.score || 100,
          audioContent: q.audioContent
        });
        questionIds.push(question._id);
      }
      lesson.questions = questionIds;
    }

    const updatedLesson = await lesson.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Cập nhật bài học thành công',
      lesson: {
        lessonId: updatedLesson._id,
        title: updatedLesson.title,
        type: updatedLesson.type,
        topic: updatedLesson.topic,
        level: updatedLesson.level,
        skill: updatedLesson.skill,
        maxScore: updatedLesson.maxScore,
        timeLimit: updatedLesson.timeLimit,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Update lesson error:', error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || 'Lỗi khi cập nhật bài học'
    };
  }
};

// Lấy danh sách bài học
const getLessons = async (userId, queryParams) => {
  try {

    const { topic, level, skill, preferredSkills } = queryParams;

    let query = {};
    let topicDoc, levelDoc, skillDoc;

    // Kiểm tra topic
    if (topic) {
      topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        console.error(`Invalid topic: ${topic}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Chủ đề không hợp lệ hoặc không hoạt động'
        };
      }
      query.topic = topic;
    }

    // Kiểm tra level
    if (level) {
      levelDoc = await Level.findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        console.error(`Invalid level: ${level}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Trình độ không hợp lệ hoặc không hoạt động'
        };
      }
      query.level = level;
    }

    // Kiểm tra skill
    if (skill) {
      skillDoc = await Skill.findById(skill);
      if (!skillDoc || !skillDoc.isActive) {
        console.error(`Invalid skill: ${skill}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Kỹ năng không hợp lệ hoặc không hoạt động'
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
          message: 'Không tìm thấy người dùng'
        };
      }
      if (user.level && levelDoc && user.level.toString() !== levelDoc._id.toString()) {
        console.error(`Level mismatch: user level ${user.level}, requested level ${level}`);
        return {
          success: false,
          statusCode: 400,
          message: 'Cấp độ không khớp với người dùng'
        };
      }
      if (user.level && levelDoc && levelDoc.name === 'beginner' && topic) {
        const completedVocab = user.completedBasicVocab.map(id => id.toString());
        if (!completedVocab.includes(topic.toString())) {
          query.skill = (await Skill.findOne({ name: 'vocabulary' }))?._id;
        }
      }
    }

    let sortOptions = {};
    if (preferredSkills) {
      const skillsArray = preferredSkills.split(',').map(s => s.trim());
      if (skillsArray.includes('all')) {
        sortOptions = {};
      } else {
        const validSkills = await Skill.find({ _id: { $in: skillsArray }, isActive: true });
        if (validSkills.length === 0) {
          console.error(`No valid skills in preferredSkills: ${preferredSkills}`);
          return {
            success: false,
            statusCode: 400,
            message: 'Không có kỹ năng hợp lệ trong preferredSkills'
          };
        }
        sortOptions = { skill: -1 };
      }
    }

    const lessons = await Lesson.find(query)
      .populate('questions topic level skill')
      .select('title type topic level skill maxScore timeLimit createdAt')
      .sort(sortOptions);

    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách bài học thành công',
      lessons
    };
  } catch (error) {
    console.error('Get lessons error:', {
      message: error.message,
      stack: error.stack,
      userId,
      queryParams
    });
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi lấy danh sách bài học: ${error.message}`
    };
  }
};

// Lấy chi tiết bài học
const getLessonById = async (lessonId) => {
  try {
    const lesson = await Lesson.findById(lessonId).populate('questions topic level skill');

    if (!lesson) {
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy bài học'
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Lấy bài học thành công',
      lesson
    };
  } catch (error) {
    console.error('Get lesson by ID error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi lấy bài học'
    };
  }
};

// Hoàn thành bài học
const completeLesson = async (userId, lessonId, score, questionResults, isRetried = false) => {
  try {

    if (!userId) {
      return {
        success: true,
        statusCode: 200,
        message: 'Hoàn thành bài học (guest)',
        score,
        questionResults
      };
    }

    const lesson = await Lesson.findById(lessonId).populate('skill topic level');
    if (!lesson) {
      console.error(`Lesson not found: ${lessonId}`);
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy bài học'
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng'
      };
    }

    // Check and regenerate lives
    await checkAndRegenerateLives(user);

    if (!user.level) {
      console.warn(`User ${userId} has no level, setting default to 'beginner'`);
      user.level = (await Level.findOne({ name: 'beginner' }))?._id;
    }

    const lessonSkill = lesson.skill.name;
    const lessonTopic = lesson.topic._id.toString();
    const userLevel = await Level.findById(user.level);
    if (userLevel.name === 'beginner' && lessonSkill !== 'vocabulary') {
      const completedVocab = user.completedBasicVocab.map(id => id.toString());
      if (!completedVocab.includes(lessonTopic)) {
        return {
          success: false,
          statusCode: 403,
          message: 'Vui lòng hoàn thành từ vựng cơ bản trước'
        };
      }
    }

    const questionIds = questionResults.map(result => result.questionId);
    const questions = await Question.find({ _id: { $in: questionIds }, lessonId });
    if (questions.length !== questionIds.length) {
      console.error(`Invalid questionIds: ${questionIds}, found: ${questions.map(q => q._id)}`);
      return {
        success: false,
        statusCode: 400,
        message: 'Một hoặc nhiều questionId không hợp lệ hoặc không thuộc lesson'
      };
    }

    // Xử lý đánh giá phát âm nếu là bài speaking
    if (lessonSkill === 'speaking') {
      for (let i = 0; i < questionResults.length; i++) {
        const result = questionResults[i];
        const question = questions.find(q => q._id.toString() === result.questionId.toString());

        // Ensure timeout answers have a valid value
        if (result.isTimeout) {
          questionResults[i].answer = result.answer || "[TIMEOUT]";
        }

        if (result.audioAnswer && question) {
          const evaluationResult = await groqService.evaluatePronunciation(
            question.correctAnswer,
            Buffer.from(result.audioAnswer, 'base64') // Giả sử audioAnswer là base64
          );

          if (evaluationResult.success) {
            questionResults[i].score = evaluationResult.score;
            questionResults[i].feedback = evaluationResult.feedback;
            questionResults[i].transcription = evaluationResult.transcription;
            questionResults[i].isCorrect = evaluationResult.score >= 70;
            questionResults[i].answer = evaluationResult.transcription || "[UNANSWERED]";
          } else {
            questionResults[i].score = 0;
            questionResults[i].feedback = evaluationResult.message;
            questionResults[i].isCorrect = false;
            questionResults[i].answer = "[ERROR]";
          }
        } else {
          questionResults[i].isCorrect = result.answer === question.correctAnswer;
          questionResults[i].answer = result.answer || (result.isTimeout ? "[TIMEOUT]" : "[UNANSWERED]");
        }
      }

      score = questionResults.reduce((total, r) => total + (r.score || 0), 0);
    } else {
      for (let i = 0; i < questionResults.length; i++) {
        const result = questionResults[i];
        const question = questions.find(q => q._id.toString() === result.questionId.toString());

        // Ensure timeout answers have a valid value
        if (result.isTimeout) {
          questionResults[i].answer = result.answer || "[TIMEOUT]";
        } else {
          questionResults[i].answer = result.answer || "[UNANSWERED]";
        }

        questionResults[i].isCorrect = result.answer === question.correctAnswer;
        questionResults[i].score = result.isCorrect ? question.score : 0;
      }
      score = questionResults.reduce((total, r) => total + (r.score || 0), 0);
    }

    if (userLevel.name !== 'beginner' && lesson.timeLimit > 0) {
      const hasTimeout = questionResults.some(result => result.isTimeout);
      if (hasTimeout && user.lives > 0) {
        user.lives -= 1;
        user.lastLivesRegenerationTime = new Date();
      }
    }

    const progress = await Progress.create({
      userId,
      lessonId,
      score,
      isRetried,
      questionResults
    });

    if (userLevel.name === 'beginner' && lessonSkill === 'vocabulary') {
      const completedVocab = user.completedBasicVocab.map(id => id.toString());
      if (!completedVocab.includes(lessonTopic)) {
        user.completedBasicVocab.push(lessonTopic);
      }
    }

    user.xp += Math.round(score / 10);
    if (user.xp >= user.userLevel * 1000) {
      user.userLevel += 1;
      user.lives = Math.min(user.lives + 1, 5);
    }
    if (user.xp >= 1000 && userLevel.name === 'beginner') {
      user.level = (await Level.findOne({ name: 'intermediate' }))?._id;
    } else if (user.xp >= 2000 && userLevel.name === 'intermediate') {
      user.level = (await Level.findOne({ name: 'advanced' }))?._id;
    }

    await user.save();

    return {
      success: true,
      statusCode: 201,
      message: 'Hoàn thành bài học thành công',
      status: 'COMPLETE',
      progress,
      user: {
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills
      }
    };

  } catch (error) {
    console.error('Complete lesson error:', {
      message: error.message,
      stack: error.stack,
      userId,
      lessonId,
      score,
      questionResults
    });
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi hoàn thành bài học: ${error.message}`
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
        message: 'Không tìm thấy người dùng hoặc bài học'
      };
    }

    // Check and regenerate lives before checking if user has enough lives
    await checkAndRegenerateLives(user);

    if (user.lives <= 0) {
      return {
        success: false,
        statusCode: 403,
        message: 'Không đủ lượt chơi để làm lại'
      };
    }

    await Progress.deleteMany({ userId, lessonId });
    user.lives -= 1;
    user.lastLivesRegenerationTime = new Date();
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Có thể làm lại bài học',
      lives: user.lives
    };
  } catch (error) {
    console.error('Retry lesson error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi làm lại bài học'
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
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    let query = {};

    if (topic) {
      const topicDoc = await Topic.findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: 'Chủ đề không hợp lệ hoặc không hoạt động'
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
          message: 'Cấp độ không hợp lệ hoặc không hoạt động'
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
          message: 'Kỹ năng không hợp lệ hoặc không hoạt động'
        };
      }
      query.skill = skill;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const total = await Lesson.countDocuments(query);
    const lessons = await Lesson.find(query)
      .populate('questions topic level skill')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách bài học thành công',
      data: {
        lessons,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    };
  } catch (error) {
    console.error('Get all lessons for admin error:', error);
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi lấy danh sách bài học: ${error.message}`
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
        message: 'Không tìm thấy bài học'
      };
    }

    await lesson.deleteOne();

    return {
      success: true,
      statusCode: 200,
      message: 'Xóa bài học thành công'
    };
  } catch (error) {
    console.error('Delete lesson error:', error);
    return {
      success: false,
      statusCode: 500,
      message: error.message || 'Lỗi khi xóa bài học'
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
  checkAndRegenerateLives
};