import mongoose from "mongoose";
import softDeletePlugin from "../plugins/mongoose-soft-delete.js";

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Apply soft delete plugin
UserSchema.plugin(softDeletePlugin);

const User = mongoose.model("User", UserSchema);
export default User;
