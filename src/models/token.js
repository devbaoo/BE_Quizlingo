import mongoose from "mongoose";

const TokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["verification", "reset-password"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Token sẽ tự động xóa sau 24 giờ (tính bằng giây)
  },
});

const Token = mongoose.model("Token", TokenSchema);
export default Token;
