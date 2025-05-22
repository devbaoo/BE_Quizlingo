import mongoose from "mongoose";
import softDeletePlugin from "../plugins/mongoose-soft-delete.js";

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "Họ là bắt buộc"],
  },
  lastName: {
    type: String,
    required: [true, "Tên là bắt buộc"],
  },
  email: {
    type: String,
    unique: true,
    required: [true, "Email là bắt buộc"],
  },
  password: {
    type: String,
    required: [true, "Mật khẩu là bắt buộc"],
  },
  avatar: {
    type: String,
    default: "",
  },
  role: {
    type: String,
    enum: ["admin", "user"],
    default: "user",
  },
  isVerify: {
    type: Boolean,
    default: false,
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
    required: false,
    default: null,
  },
  userLevel: {
    type: Number,
    default: 1,
    min: [1, "Cấp người chơi không được nhỏ hơn 1"],
  },
  xp: {
    type: Number,
    default: 0,
  },
  streak: {
    type: Number,
    default: 0,
  },
  lastLoginDate: {
    type: Date,
    default: null,
  },
  lives: {
    type: Number,
    default: 5,
    min: [0, "Số mạng không được nhỏ hơn 0"],
    max: [5, "Số mạng không được lớn hơn 5"],
  },
  lastLivesRegenerationTime: {
    type: Date,
    default: Date.now,
  },
  completedBasicVocab: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    },
  ],
  preferredSkills: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Skill",
    },
  ],
  preferredTopics: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    },
  ],
  notifications: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
    },
  ],
  notificationSettings: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ email: 1 });
UserSchema.plugin(softDeletePlugin);

const User = mongoose.model("User", UserSchema);
export default User;
