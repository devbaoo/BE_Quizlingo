import mongoose from 'mongoose';
import softDeletePlugin from '../plugins/mongoose-soft-delete.js';

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Họ là bắt buộc'],
  },
  lastName: {
    type: String,
    required: [true, 'Tên là bắt buộc'],
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'Email là bắt buộc'],
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
  },
  avatar: {
    type: String,
    default: "",
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  isVerify: {
    type: Boolean,
    default: false,
  },
  level: {
    type: String,
    enum: {
      values: ['beginner', 'intermediate', 'advanced'],
      message: 'Trình độ kiến thức phải là beginner, intermediate, hoặc advanced'
    },
    required: [true, 'Trình độ kiến thức là bắt buộc']
  },
  userLevel: {
    type: Number,
    default: 1,
    min: [1, 'Cấp người chơi không được nhỏ hơn 1']
  },
  xp: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lives: {
    type: Number,
    default: 5,
    min: [0, 'Số mạng không được nhỏ hơn 0'],
    max: [5, 'Số mạng không được lớn hơn 5']
  },
  completedBasicVocab: [{
    type: String,
    enum: {
      values: ['travel', 'business', 'daily_life', 'education', 'food'],
      message: 'Chủ đề hoàn thành phải là travel, business, daily_life, education, hoặc food'
    }
  }],
  preferredSkills: [{
    type: String,
    enum: {
      values: ['vocabulary', 'reading', 'writing', 'listening', 'speaking'],
      message: 'Kỹ năng phải là vocabulary, reading, writing, listening, hoặc speaking'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

UserSchema.index({ email: 1 });
UserSchema.plugin(softDeletePlugin);

const User = mongoose.model('User', UserSchema);
export default User;