import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề bài học là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tiêu đề không được vượt quá 100 ký tự']
  },
  type: {
    type: String,
    required: [true, 'Loại bài học là bắt buộc'],
    trim: true,
    validate: {
      validator: function (value) {
        return ['multiple_choice', 'text_input', 'audio_input'].includes(value);
      },
      message: 'Loại bài học phải là multiple_choice, text_input hoặc audio_input'
    }
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
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: [true, 'Kỹ năng bài học là bắt buộc']
  },
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
    const skill = await mongoose.model('Skill').findById(this.skill);
    if (!skill || !skill.isActive) {
      return next(new Error('Kỹ năng không hợp lệ hoặc không hoạt động'));
    }
    const skillName = skill.name;

    if (this.type === 'multiple_choice' && !skill.supportedTypes.includes('multiple_choice')) {
      next(new Error('Loại multiple_choice không được hỗ trợ bởi kỹ năng này'));
    }
    if (this.type === 'text_input' && skillName !== 'writing') {
      next(new Error('Loại text_input chỉ áp dụng cho kỹ năng writing'));
    }
    if (this.type === 'audio_input' && skillName !== 'speaking') {
      next(new Error('Loại audio_input chỉ áp dụng cho kỹ năng speaking'));
    }

    const topic = await mongoose.model('Topic').findById(this.topic);
    if (!topic || !topic.isActive) {
      return next(new Error('Chủ đề không hợp lệ hoặc không hoạt động'));
    }

    const level = await mongoose.model('Level').findById(this.level);
    if (!level || !level.isActive) {
      return next(new Error('Cấp độ không hợp lệ hoặc không hoạt động'));
    }
    this.maxScore = level.maxScore;
    this.timeLimit = level.timeLimit;

    next();
  } catch (error) {
    next(error);
  }
});

lessonSchema.index({ type: 1, topic: 1, level: 1, skill: 1 });

const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;