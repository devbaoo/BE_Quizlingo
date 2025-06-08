// cleanupUnverifiedUsers.js
import mongoose from "mongoose";
import User from "../models/user.js";
import dotenv from "dotenv";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);

const deleteUnverifiedUsers = async () => {
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.deleteMany({
        isVerify: false,
        createdAt: { $lt: expired },
    });

    console.log(`[CRON] Đã xoá ${result.deletedCount} tài khoản chưa xác thực`);
    process.exit(0);
};

deleteUnverifiedUsers();
