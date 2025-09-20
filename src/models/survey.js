import mongoose from "mongoose";
import softDeletePlugin from "../plugins/mongoose-soft-delete.js";

const QuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, "Nội dung câu hỏi là bắt buộc"],
  },
  questionType: {
    type: String,
    enum: ["multiple_choice", "single_choice", "text", "rating"],
    required: [true, "Loại câu hỏi là bắt buộc"],
  },
  options: {
    type: [String],
    default: [],
  },
  required: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 0,
  },
});

const SurveySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Tiêu đề khảo sát là bắt buộc"],
    default: "Khảo sát người dùng",
  },
  description: {
    type: String,
    default: "Khảo sát để cải thiện trải nghiệm người dùng",
  },
  questions: {
    type: [QuestionSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  version: {
    type: Number,
    default: 1,
  },
  reward: {
    xp: {
      type: Number,
      default: 100,
    },
    points: {
      type: Number,
      default: 200,
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

SurveySchema.index({ version: 1 });
SurveySchema.index({ isActive: 1 });
SurveySchema.plugin(softDeletePlugin);

// Static method to get the active survey
SurveySchema.statics.getActiveSurvey = async function () {
  return this.findOne({ isActive: true }).sort({ version: -1 });
};

const Survey = mongoose.model("Survey", SurveySchema);
export default Survey;
