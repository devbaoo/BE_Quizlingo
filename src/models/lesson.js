// lesson.js

import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề bài học là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tiêu đề không được vượt quá 100 ký tự']
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: [true, 'Chủ đề bài học là bắt buộc']
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    required: [true, 'Trình độ bài học là bắt buộc']
  },
  skills: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    }
  ],
  maxScore: {
    type: Number,
    required: true
  },
  timeLimit: {
    type: Number,
    default: 0
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

lessonSchema.pre('validate', async function (next) {
  try {
    const topic = await mongoose.model('Topic').findById(this.topic);
    if (!topic || !topic.isActive) {
      return next(new Error('Chủ đề không hợp lệ hoặc không hoạt động'));
    }

    const level = await mongoose.model('Level').findById(this.level);
    if (!level || !level.isActive) {
      return next(new Error('Cấp độ không hợp lệ hoặc không hoạt động'));
    }

    if (!Array.isArray(this.skills) || this.skills.length === 0) {
      return next(new Error('Phải có ít nhất một kỹ năng cho bài học'));
    }

    const skills = await mongoose.model('Skill').find({
      _id: { $in: this.skills },
      isActive: true
    });

    if (skills.length !== this.skills.length) {
      return next(new Error('Một hoặc nhiều kỹ năng không hợp lệ hoặc không hoạt động'));
    }

    this.maxScore = level.maxScore;
    this.timeLimit = level.timeLimit;

    next();
  } catch (error) {
    next(error);
  }
});

lessonSchema.index({ topic: 1, level: 1 });

const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;
