import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tên chủ đề là bắt buộc"],
    unique: true,
    trim: true,
    maxlength: [50, "Tên chủ đề không được vượt quá 50 ký tự"],
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

topicSchema.index({ name: 1 });

const Topic = mongoose.model("Topic", topicSchema);
export default Topic;
