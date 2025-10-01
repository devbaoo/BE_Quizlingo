import express from "express";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });
import userController from "../controllers/userController.js";
import authController from "../controllers/authController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import lessonController from "../controllers/lessonController.js";
import groqController from "../controllers/groqController.js";
import levelController from "../controllers/levelController.js";
import skillController from "../controllers/skillController.js";
import notificationController from "../controllers/notificationController.js";
import automatedNotificationController from "../controllers/automatedNotificationController.js";
import packageController from "../controllers/packageController.js";
import adminPackageController from "../controllers/adminPackageController.js";
import progressController from "../controllers/progressController.js";
import leaderboardController from "../controllers/leaderboardController.js";
import adDashboardController from "../controllers/adDashboardController.js";
import registerLimiter from "../middleware/registerLimiter.js";
import forgotPasswordLimiter from "../middleware/forgotPasswordLimiter.js";
import topicController from "../controllers/topicController.js";
import marxistPhilosophyController from "../controllers/marxistPhilosophyController.js";
import contentController from "../controllers/contentController.js";
import marxistTopicController from "../controllers/marxistTopicController.js";
import checkInController from "../controllers/checkInController.js";
import surveyController from "../controllers/surveyController.js";
import flashcardController from "../controllers/flashcardController.js";

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
  router.post("/auth/register", registerLimiter, authController.register);
  router.post("/auth/login", authController.login);
  router.post("/auth/refresh-token", authController.refreshToken);
  router.get("/auth/verify-email/:token", authController.verifyEmail);
  router.post(
    "/auth/resend-verification",
    authController.resendVerificationEmail
  );
  router.post(
    "/auth/forgot-password",
    forgotPasswordLimiter,
    authController.forgotPassword
  );
  router.post("/auth/reset-password/:token", authController.resetPassword);
  router.post("/auth/change-password", protect, authController.changePassword);
  router.post("/auth/google-login", authController.googleLogin);

  // User routes
  router.get("/user/profile", protect, userController.getUserProfile);
  router.put(
    "/user/profile",
    protect,
    upload.single("avatar"),
    userController.updateUserProfile
  );
  router.post("/user/level", protect, userController.chooseLevel);
  router.post("/user/skill", protect, userController.chooseSkill);
  router.get("/user/lives-status", protect, userController.getUserLivesStatus);
  router.get("/user/payment-history", protect, userController.paymentHistory);
  router.post("/user/topic", protect, userController.chooseTopic);

  // Route avatar sử dụng middleware từ controller
  router.post(
    "/users/avatar",
    protect,
    userController.handleAvatarUpload,
    userController.uploadAvatar
  );

  // Flashcard routes (public)
  router.get("/flashcards", flashcardController.listFlashcards);
  router.get("/flashcards/tags", flashcardController.getFlashcardTags);
  router.get("/flashcards/random", flashcardController.getRandomFlashcards);
  router.get("/flashcards/:id", flashcardController.getFlashcardDetails);

  // Admin routes

  router.get("/users", protect, authorize("admin"), userController.getAllUsers);
  router.get(
    "/total-user",
    protect,
    authorize("admin"),
    adDashboardController.totalUser
  );
  router.get(
    "/total-user-by-month",
    protect,
    authorize("admin"),
    adDashboardController.totalUserByMonth
  );
  router.get(
    "/total-user-by-year",
    protect,
    authorize("admin"),
    adDashboardController.totalUserByYear
  );
  router.get(
    "/total-lessons",
    protect,
    authorize("admin"),
    adDashboardController.totalLesson
  );
  router.get(
    "/total-levels",
    protect,
    authorize("admin"),
    adDashboardController.totalLevel
  );
  router.get(
    "/total-skills",
    protect,
    authorize("admin"),
    adDashboardController.totalSkill
  );
  router.get(
    "/total-user-by-level",
    protect,
    authorize("admin"),
    adDashboardController.getTotalUserByLevel
  );
  router.get(
    "/total-user-by-skill",
    protect,
    authorize("admin"),
    adDashboardController.getTotalUserBySkill
  );
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
  router.get("/topics", topicController.getTopics);
  router.get("/skills", lessonController.getSkills);
  router.get(
    "/user-lessons-learning-path",
    protect,
    lessonController.getUserLearningPath
  );

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
  router.get("/leaderboard", protect, leaderboardController.getLeaderboard);

  // Check-in routes
  router.post("/check-in", protect, checkInController.dailyCheckIn);
  router.get("/check-in/status", protect, checkInController.getCheckInStatus);

  // Survey routes - Single survey approach
  router.get("/survey", protect, surveyController.getActiveSurvey);
  router.get(
    "/survey/status",
    protect,
    surveyController.checkUserSurveyCompletion
  );
  router.post("/survey/submit", protect, surveyController.submitSurveyResponse);

  // Admin/staff survey routes
  router.post(
    "/admin/survey",
    protect,
    authorize("admin", "staff"),
    surveyController.updateMainSurvey
  );
  router.get(
    "/admin/survey/versions",
    protect,
    authorize("admin", "staff"),
    surveyController.getAllSurveyVersions
  );
  router.get(
    "/admin/survey/statistics",
    protect,
    authorize("admin", "staff"),
    surveyController.getSurveyStatistics
  );

  // Topic routes
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

  // Marxist Philosophy Learning System routes
  router.post(
    "/marxist-philosophy/generate-lesson",
    protect,
    marxistPhilosophyController.generateLesson
  );
  router.get(
    "/marxist-philosophy/learning-path",
    protect,
    marxistPhilosophyController.getLearningPath
  );
  router.get(
    "/marxist-philosophy/lessons/:pathId",
    protect,
    marxistPhilosophyController.getLessonByPath
  );
  router.post(
    "/marxist-philosophy/complete-lesson",
    protect,
    marxistPhilosophyController.completeLesson
  );
  router.post(
    "/marxist-philosophy/retry-lesson",
    protect,
    marxistPhilosophyController.retryMarxistLesson
  );
  router.get(
    "/marxist-philosophy/stats",
    protect,
    marxistPhilosophyController.getStats
  );
  router.get(
    "/marxist-philosophy/topics",
    protect,
    marxistPhilosophyController.getTopics
  );
  router.get(
    "/marxist-philosophy/analyze-progress",
    protect,
    marxistPhilosophyController.analyzeProgress
  );

  // Pre-study Content routes
  router.post(
    "/marxist-philosophy/content/generate",
    protect,
    contentController.generateContent
  );
  router.get(
    "/marxist-philosophy/content/latest",
    protect,
    contentController.getLatestContent
  );
  router.post(
    "/marxist-philosophy/lesson-from-content",
    protect,
    contentController.generateLessonFromContent
  );
  router.get(
    "/marxist-philosophy/test-connection",
    protect,
    authorize("admin"),
    marxistPhilosophyController.testGeminiConnection
  );
  router.post(
    "/marxist-philosophy/test-gemini",
    protect,
    authorize("admin"),
    marxistPhilosophyController.testGemini
  );

  // Rate limiter monitoring route
  router.get(
    "/marxist-philosophy/rate-limiter-stats",
    protect,
    authorize("admin"),
    marxistPhilosophyController.getRateLimiterStats
  );

  // Multi-AI monitoring routes
  router.get(
    "/marxist-philosophy/test-all-ai",
    protect,
    authorize("admin"),
    marxistPhilosophyController.testAllAiConnections
  );
  router.get(
    "/marxist-philosophy/multi-ai-stats",
    protect,
    authorize("admin"),
    marxistPhilosophyController.getMultiAiStats
  );
  router.get(
    "/marxist-philosophy/generation-stats",
    protect,
    authorize("admin"),
    marxistPhilosophyController.getGenerationStats
  );
  router.get(
    "/marxist-philosophy/test-ai-accuracy",
    protect,
    authorize("admin"),
    marxistPhilosophyController.testAiAccuracy
  );
  router.get(
    "/marxist-philosophy/test-answer-distribution",
    protect,
    authorize("admin"),
    marxistPhilosophyController.testAnswerDistribution
  );

  // Marxist Topics management routes
  router.post(
    "/marxist-topics",
    protect,
    authorize("staff"),
    marxistTopicController.createTopic
  );
  router.get("/marxist-topics", marxistTopicController.getTopics);
  router.get("/marxist-topics/:id", marxistTopicController.getTopicById);
  router.put(
    "/marxist-topics/:id",
    protect,
    authorize("staff"),
    marxistTopicController.updateTopic
  );
  router.delete(
    "/marxist-topics/:id",
    protect,
    authorize("staff"),
    marxistTopicController.deleteTopic
  );
  router.post(
    "/marxist-topics/seed",
    protect,
    authorize("staff"),
    marxistTopicController.seedDefaultTopics
  );

  // Admin package management routes
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
    "/admin/packages/:id",
    protect,
    authorize("admin"),
    adminPackageController.updatePackage
  );
  router.delete(
    "/admin/packages/:id",
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
  router.post(
    "/admin/users/:userId/packages",
    protect,
    authorize("admin"),
    adminPackageController.manageUserPackage
  );

  app.use("/api", router);
};

export default initWebRoutes;
