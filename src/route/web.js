import express from "express";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });
import userController from "../controllers/userController.js";
import authController from "../controllers/authController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import lessonController from "../controllers/lessonController.js";
import groqController from "../controllers/groqController.js";
import topicController from "../controllers/topicController.js";
import levelController from "../controllers/levelController.js";
import skillController from "../controllers/skillController.js";
import notificationController from "../controllers/notificationController.js";
import automatedNotificationController from "../controllers/automatedNotificationController.js";
import packageController from "../controllers/packageController.js";
import adminPackageController from "../controllers/adminPackageController.js";
import progressController from "../controllers/progressController.js";

const router = express.Router();

const initWebRoutes = (app) => {
  // Health check route
  router.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is running",
    });
  });

  // Root route - Redirect to health check
  app.get("/", (req, res) => {
    res.redirect("/api/health");
  });

  // Authentication routes
  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);
  router.get("/auth/verify-email/:token", authController.verifyEmail);
  router.post(
    "/auth/resend-verification",
    authController.resendVerificationEmail
  );
  router.post("/auth/forgot-password", authController.forgotPassword);
  router.post("/auth/reset-password/:token", authController.resetPassword);
  router.post("/auth/change-password", protect, authController.changePassword);

  // User routes (protected)
  router.get("/users/profile", protect, userController.getUserProfile);
  router.put("/users/profile", protect, userController.updateUserProfile);
  router.post("/user/level", protect, userController.chooseLevel);
  router.post("/user/skill", protect, userController.chooseSkill);
  router.post("/user/topic", protect, userController.chooseTopic);
  router.get("/user/lives-status", protect, userController.getUserLivesStatus);

  // Route avatar sử dụng middleware từ controller
  router.post(
    "/users/avatar",
    protect,
    userController.handleAvatarUpload,
    userController.uploadAvatar
  );

  // Admin routes
  router.get("/users", protect, authorize("admin"), userController.getAllUsers);
  router.delete(
    "/users/:id",
    protect,
    authorize("admin"),
    userController.deleteUser
  );
  router.patch(
    "/users/:userId/role",
    protect,
    authorize("admin"),
    userController.updateUserRole
  );

  // Staff lesson management routes
  router.get(
    "/staff/lessons",
    protect,
    authorize("staff"),
    lessonController.getAllLessons
  );
  router.post(
    "/lessons",
    protect,
    authorize("staff"),
    lessonController.createLesson
  );
  router.put(
    "/lessons/:id",
    protect,
    authorize("staff"),
    lessonController.updateLesson
  );
  router.delete(
    "/lessons/:id",
    protect,
    authorize("staff"),
    lessonController.deleteLesson
  );

  // Topic routes
  router.get("/topics", topicController.getTopics);
  router.post(
    "/topics",
    protect,
    authorize("staff"),
    topicController.createTopic
  );
  router.put(
    "/topics/:id",
    protect,
    authorize("staff"),
    topicController.updateTopic
  );
  router.delete(
    "/topics/:id",
    protect,
    authorize("staff"),
    topicController.deleteTopic
  );

  // Level routes
  router.get("/levels", levelController.getLevels);
  router.post(
    "/levels",
    protect,
    authorize("staff"),
    levelController.createLevel
  );
  router.put(
    "/levels/:id",
    protect,
    authorize("staff"),
    levelController.updateLevel
  );
  router.delete(
    "/levels/:id",
    protect,
    authorize("staff"),
    levelController.deleteLevel
  );

  // Skill routes
  router.get("/skills", skillController.getSkills);
  router.post(
    "/skills",
    protect,
    authorize("staff"),
    skillController.createSkill
  );
  router.put(
    "/skills/:id",
    protect,
    authorize("staff"),
    skillController.updateSkill
  );
  router.delete(
    "/skills/:id",
    protect,
    authorize("staff"),
    skillController.deleteSkill
  );

  // Lesson routes for users
  router.get("/lessons", protect, lessonController.getLessons);
  router.get("/lessons/:id", protect, lessonController.getLessonById);
  router.post("/progress", protect, lessonController.completeLesson);
  router.post("/lessons/retry", protect, lessonController.retryLesson);
  router.get("/topics", lessonController.getTopics);
  router.get("/skills", lessonController.getSkills);

  // Progress routes
  router.get(
    "/check-completion/:lessonId",
    protect,
    progressController.checkLessonCompletion
  );
  router.get(
    "/progression",
    protect,
    progressController.getUserLessonProgression
  );

  // Groq AI routes
  router.post("/speech/text-to-speech", groqController.textToSpeech);
  router.post(
    "/speech/speech-to-text",
    protect,
    upload.single("audio"),
    groqController.speechToText
  );
  router.post(
    "/speech/evaluate-pronunciation",
    protect,
    upload.single("audio"),
    groqController.evaluatePronunciation
  );

  // Notification routes
  router.get(
    "/notifications",
    protect,
    notificationController.getNotifications
  );
  router.patch(
    "/notifications/:notificationId/read",
    protect,
    notificationController.markAsRead
  );
  router.patch(
    "/notifications/mark-all-read",
    protect,
    notificationController.markAllAsRead
  );
  router.patch(
    "/notifications/settings",
    protect,
    notificationController.updateSettings
  );
  router.get(
    "/notifications/settings",
    protect,
    notificationController.getNotificationsSetting
  );

  // Admin notification routes
  router.post(
    "/admin/notifications",
    protect,
    authorize("admin"),
    notificationController.createUserNotification
  );
  router.post(
    "/admin/notifications/bulk",
    protect,
    authorize("admin"),
    notificationController.createBulkNotifications
  );
  router.post(
    "/admin/notifications/all",
    protect,
    notificationController.createNotificationForAllUsers
  );

  // Automated notification routes (Admin only)
  router.get(
    "/admin/automated-notifications/stats",
    protect,
    authorize("admin"),
    automatedNotificationController.getInactiveUsersStats
  );
  router.post(
    "/admin/automated-notifications/run-check",
    protect,
    authorize("admin"),
    automatedNotificationController.runManualCheck
  );
  router.get(
    "/admin/automated-notifications/scheduler-info",
    protect,
    authorize("admin"),
    automatedNotificationController.getSchedulerInfo
  );

  // Package routes (public)
  router.get("/packages", packageController.getActivePackages);
  router.get("/packages/:packageId", packageController.getPackageDetails);
  router.get(
    "/packages/user/active",
    protect,
    packageController.getUserActivePackage
  );
  router.post(
    "/packages/purchase",
    protect,
    packageController.createPackagePurchase
  );
  router.post(
    "/packages/payment/webhook",
    packageController.handlePaymentWebhook
  );
  router.get(
    "/packages/payment/:transactionId/status",
    protect,
    packageController.checkPaymentStatus
  );
  router.post(
    "/packages/payment/:transactionId/cancel",
    protect,
    packageController.cancelPayment
  );

  // Admin package routes
  router.get(
    "/admin/packages",
    protect,
    authorize("admin"),
    adminPackageController.getAllPackages
  );
  router.post(
    "/admin/packages",
    protect,
    authorize("admin"),
    adminPackageController.createPackage
  );
  router.put(
    "/admin/packages/:packageId",
    protect,
    authorize("admin"),
    adminPackageController.updatePackage
  );
  router.delete(
    "/admin/packages/:packageId",
    protect,
    authorize("admin"),
    adminPackageController.deletePackage
  );
  router.get(
    "/admin/packages/stats",
    protect,
    authorize("admin"),
    adminPackageController.getPackageStats
  );

  app.use("/api", router);
};

export default initWebRoutes;
