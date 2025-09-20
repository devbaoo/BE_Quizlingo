import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["multiple_choice", "single_choice", "text", "rating"],
    required: true,
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const SurveyResponseSchema = new mongoose.Schema({
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey",
    required: true,
  },
  surveyVersion: {
    type: Number,
    required: true,
    default: 1,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  answers: {
    type: [AnswerSchema],
    default: [],
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  rewardClaimed: {
    type: Boolean,
    default: true, // Auto claim rewards
  },
  rewardClaimedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure a user can only submit one response per survey version
SurveyResponseSchema.index({ user: 1, surveyVersion: 1 }, { unique: true });
SurveyResponseSchema.index({ user: 1 });
SurveyResponseSchema.index({ survey: 1 });
SurveyResponseSchema.index({ completed: 1 });

const SurveyResponse = mongoose.model("SurveyResponse", SurveyResponseSchema);
export default SurveyResponse;
