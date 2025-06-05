import mongoose from "mongoose";
import softDeletePlugin from "../plugins/mongoose-soft-delete.js";

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["system", "achievement", "reminder", "level_up", "ai_generated"],
    default: "system",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  link: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.plugin(softDeletePlugin);

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;
