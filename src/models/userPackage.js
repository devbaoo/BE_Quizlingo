import mongoose from "mongoose";

const userPackageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["momo", "vnpay", "zalopay", "bank_transfer", "payos"],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    discountApplied: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tìm kiếm package đang active của user
userPackageSchema.index({ user: 1, isActive: 1, endDate: 1 });

const UserPackage = mongoose.model("UserPackage", userPackageSchema);

export default UserPackage;
