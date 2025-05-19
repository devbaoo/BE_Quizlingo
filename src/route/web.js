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

  // User routes (protected)
  router.get("/users/profile", protect, userController.getUserProfile);
  router.put("/users/profile", protect, userController.updateUserProfile);
  router.post("/user/level", protect, userController.chooseLevel);
  router.post("/user/skill", protect, userController.chooseSkill);

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
  router.get(
    "/admin/lessons",
    protect,
    authorize("admin"),
    lessonController.getAllLessons
  );
  router.put(
    "/admin/lessons/:id",
    protect,
    authorize("admin"),
    lessonController.updateLesson
  );

  // Topic routes
  router.get("/topics", topicController.getTopics);
  router.post(
    "/topics",
    protect,
    authorize("admin"),
    topicController.createTopic
  );
  router.put(
    "/topics/:id",
    protect,
    authorize("admin"),
    topicController.updateTopic
  );
  router.delete(
    "/topics/:id",
    protect,
    authorize("admin"),
    topicController.deleteTopic
  );

  // Level routes
  router.get("/levels", levelController.getLevels);
  router.post(
    "/levels",
    protect,
    authorize("admin"),
    levelController.createLevel
  );
  router.put(
    "/levels/:id",
    protect,
    authorize("admin"),
    levelController.updateLevel
  );
  router.delete(
    "/levels/:id",
    protect,
    authorize("admin"),
    levelController.deleteLevel
  );

  // Skill routes
  router.get("/skills", skillController.getSkills);
  router.post(
    "/skills",
    protect,
    authorize("admin"),
    skillController.createSkill
  );
  router.put(
    "/skills/:id",
    protect,
    authorize("admin"),
    skillController.updateSkill
  );
  router.delete(
    "/skills/:id",
    protect,
    authorize("admin"),
    skillController.deleteSkill
  );

  // Lesson routes
  router.post(
    "/lessons",
    protect,
    authorize("admin"),
    lessonController.createLesson
  );
  router.get("/lessons", protect, lessonController.getLessons);
  router.get("/lessons/:id", protect, lessonController.getLessonById);
  router.post("/progress", protect, lessonController.completeLesson);
  router.post("/lessons/retry", protect, lessonController.retryLesson);
  router.get("/topics", lessonController.getTopics);
  router.get("/skills", lessonController.getSkills);
  router.delete(
    "/lessons/:id",
    protect,
    authorize("admin"),
    lessonController.deleteLesson
  );

  // Groq AI routes
  router.post("/speech/text-to-speech", protect, groqController.textToSpeech);
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

  app.use("/api", router);
};

export default initWebRoutes;
