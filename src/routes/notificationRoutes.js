import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import notificationController from "../controllers/notificationController.js";

const router = express.Router();

// Lấy tất cả thông báo của user
router.get("/", protect, notificationController.getAllNotifications);

// ... other existing routes

export default router;
