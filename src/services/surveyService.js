import Survey from "../models/survey.js";
import SurveyResponse from "../models/surveyResponse.js";
import User from "../models/user.js";
import mongoose from "mongoose";

/**
 * Create or update the main survey
 * @param {Object} surveyData - Survey data
 * @param {String} userId - ID of the user creating/updating the survey
 * @returns {Object} - Result object
 */
const updateMainSurvey = async (surveyData, userId) => {
  try {
    const { title, description, questions, isActive, reward } = surveyData;

    // Get the current active survey
    const currentSurvey = await Survey.findOne({ isActive: true }).sort({
      version: -1,
    });

    // Create a new version of the survey
    const newVersion = currentSurvey ? currentSurvey.version + 1 : 1;

    // If there's a current survey, deactivate it
    if (currentSurvey) {
      currentSurvey.isActive = false;
      await currentSurvey.save();
    }

    // Create new survey with incremented version
    const survey = new Survey({
      title: title || "Khảo sát người dùng",
      description:
        description || "Khảo sát để cải thiện trải nghiệm người dùng",
      questions,
      isActive: isActive !== undefined ? isActive : true,
      version: newVersion,
      reward: reward || { xp: 100, points: 200 },
      createdBy: userId,
    });

    await survey.save();

    return {
      success: true,
      statusCode: 201,
      message: "Cập nhật khảo sát thành công",
      survey,
    };
  } catch (error) {
    console.error("Update main survey error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi cập nhật khảo sát",
    };
  }
};

/**
 * Get the current active survey
 * @returns {Object} - Result object with survey
 */
const getActiveSurvey = async () => {
  try {
    const survey = await Survey.getActiveSurvey();

    if (!survey) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy khảo sát",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thông tin khảo sát thành công",
      survey,
    };
  } catch (error) {
    console.error("Get active survey error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thông tin khảo sát",
    };
  }
};

/**
 * Get all survey versions (admin)
 * @returns {Object} - Result object with surveys
 */
const getAllSurveyVersions = async () => {
  try {
    const surveys = await Survey.find({ deleted: { $ne: true } })
      .populate("createdBy", "firstName lastName email")
      .sort({ version: -1 });

    return {
      success: true,
      statusCode: 200,
      message: "Lấy tất cả phiên bản khảo sát thành công",
      surveys,
    };
  } catch (error) {
    console.error("Get all survey versions error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy tất cả phiên bản khảo sát",
    };
  }
};

/**
 * Check if user has completed the current survey
 * @param {String} userId - ID of the user
 * @returns {Object} - Result object with completion status
 */
const checkUserSurveyCompletion = async (userId) => {
  try {
    const activeSurvey = await Survey.getActiveSurvey();

    if (!activeSurvey) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy khảo sát",
      };
    }

    const response = await SurveyResponse.findOne({
      user: userId,
      survey: activeSurvey._id,
      surveyVersion: activeSurvey.version,
      completed: true,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Kiểm tra hoàn thành khảo sát thành công",
      hasCompleted: !!response,
      surveyVersion: activeSurvey.version,
    };
  } catch (error) {
    console.error("Check user survey completion error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi kiểm tra hoàn thành khảo sát",
    };
  }
};

/**
 * Submit survey response
 * @param {Array} answers - Array of answers
 * @param {String} userId - ID of the user submitting the response
 * @returns {Object} - Result object
 */
const submitSurveyResponse = async (answers, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get active survey
    const survey = await Survey.getActiveSurvey();

    if (!survey) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy khảo sát",
      };
    }

    // Check if user has already submitted a response for this version
    const existingResponse = await SurveyResponse.findOne({
      user: userId,
      surveyVersion: survey.version,
    }).session(session);

    if (existingResponse && existingResponse.completed) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "Bạn đã hoàn thành khảo sát này rồi",
      };
    }

    // Validate required questions
    const requiredQuestions = survey.questions.filter((q) => q.required);
    for (const question of requiredQuestions) {
      const answer = answers.find(
        (a) => a.questionId.toString() === question._id.toString()
      );
      if (
        !answer ||
        answer.answer === "" ||
        answer.answer === null ||
        answer.answer === undefined ||
        (Array.isArray(answer.answer) && answer.answer.length === 0)
      ) {
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          statusCode: 400,
          message: `Câu hỏi "${question.questionText}" là bắt buộc`,
        };
      }
    }

    // Create formatted answers with question text
    const formattedAnswers = answers.map((answer) => {
      const question = survey.questions.find(
        (q) => q._id.toString() === answer.questionId.toString()
      );
      return {
        questionId: answer.questionId,
        questionText: question ? question.questionText : "Unknown question",
        questionType: question ? question.questionType : "text",
        answer: answer.answer,
      };
    });

    // Create or update response
    const now = new Date();
    let response;

    if (existingResponse) {
      existingResponse.answers = formattedAnswers;
      existingResponse.completed = true;
      existingResponse.completedAt = now;
      existingResponse.updatedAt = now;
      response = await existingResponse.save({ session });
    } else {
      response = await SurveyResponse.create(
        [
          {
            survey: survey._id,
            surveyVersion: survey.version,
            user: userId,
            answers: formattedAnswers,
            completed: true,
            completedAt: now,
          },
        ],
        { session }
      );
      response = response[0];
    }

    // Add reward to user
    const user = await User.findById(userId).session(session);
    if (user) {
      user.xp += survey.reward.xp || 0;
      await user.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      statusCode: 200,
      message: "Gửi câu trả lời khảo sát thành công",
      data: {
        response,
        reward: {
          xp: survey.reward.xp || 0,
          points: survey.reward.points || 0,
        },
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Submit survey response error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi gửi câu trả lời khảo sát",
    };
  }
};

/**
 * Get survey statistics
 * @param {Number} version - Optional survey version, defaults to latest
 * @returns {Object} - Result object with statistics
 */
const getSurveyStatistics = async (version = null) => {
  try {
    // Get the survey (either specific version or latest active)
    let survey;
    if (version) {
      survey = await Survey.findOne({ version });
    } else {
      survey = await Survey.getActiveSurvey();
    }

    if (!survey) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy khảo sát",
      };
    }

    const responses = await SurveyResponse.find({
      survey: survey._id,
      surveyVersion: survey.version,
      completed: true,
    });

    // Calculate statistics for each question
    const statistics = survey.questions.map((question) => {
      const questionStats = {
        questionId: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        totalResponses: 0,
      };

      // Get all answers for this question
      const answers = responses
        .map((response) =>
          response.answers.find(
            (a) => a.questionId.toString() === question._id.toString()
          )
        )
        .filter((answer) => answer !== undefined);

      questionStats.totalResponses = answers.length;

      // Calculate statistics based on question type
      if (
        question.questionType === "multiple_choice" ||
        question.questionType === "single_choice"
      ) {
        // Count occurrences of each option
        const optionCounts = {};
        question.options.forEach((option) => {
          optionCounts[option] = 0;
        });

        answers.forEach((answer) => {
          if (Array.isArray(answer.answer)) {
            answer.answer.forEach((option) => {
              if (optionCounts[option] !== undefined) {
                optionCounts[option]++;
              }
            });
          } else if (optionCounts[answer.answer] !== undefined) {
            optionCounts[answer.answer]++;
          }
        });

        questionStats.options = Object.keys(optionCounts).map((option) => ({
          option,
          count: optionCounts[option],
          percentage:
            answers.length > 0
              ? (optionCounts[option] / answers.length) * 100
              : 0,
        }));
      } else if (question.questionType === "rating") {
        // Calculate average rating
        const ratings = answers
          .map((answer) => Number(answer.answer))
          .filter((r) => !isNaN(r));
        questionStats.averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : 0;

        // Count occurrences of each rating
        const ratingCounts = {};
        for (let i = 1; i <= 5; i++) {
          ratingCounts[i] = 0;
        }

        ratings.forEach((rating) => {
          if (ratingCounts[rating] !== undefined) {
            ratingCounts[rating]++;
          }
        });

        questionStats.ratingDistribution = Object.keys(ratingCounts).map(
          (rating) => ({
            rating: Number(rating),
            count: ratingCounts[rating],
            percentage:
              ratings.length > 0
                ? (ratingCounts[rating] / ratings.length) * 100
                : 0,
          })
        );
      } else if (question.questionType === "text") {
        // Just collect text responses
        questionStats.textResponses = answers.map((answer) => answer.answer);
      }

      return questionStats;
    });

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thống kê khảo sát thành công",
      statistics: {
        totalResponses: responses.length,
        surveyVersion: survey.version,
        questions: statistics,
      },
    };
  } catch (error) {
    console.error("Get survey statistics error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thống kê khảo sát",
    };
  }
};

export default {
  updateMainSurvey,
  getActiveSurvey,
  getAllSurveyVersions,
  checkUserSurveyCompletion,
  submitSurveyResponse,
  getSurveyStatistics,
};
