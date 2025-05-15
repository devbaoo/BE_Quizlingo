import express from "express";
import userController from "../controllers/userController.js";
import authController from "../controllers/authController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import lessonController from "../controllers/lessonController.js";

const router = express.Router();
const initWebRoutes = (app) => {
  // Health check route
  router.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is running",
    });
  });

  // Authentication routes
  router.post("/auth/register", authController.register);
  router.post("/auth/login", authController.login);
  router.get("/auth/verify-email/:token", authController.verifyEmail);
  router.post(
    "/auth/resend-verification",
    authController.resendVerificationEmail
  );

  // User routes (protected)
  router.get("/users/profile", protect, userController.getUserProfile);
  router.put("/users/profile", protect, userController.updateUserProfile);
  router.post('/user/level', protect, userController.chooseLevel);
  router.post('/user/skill', protect, userController.chooseSkill);
  // Admin routes
  router.get("/users", protect, authorize("admin"), userController.getAllUsers);
  router.delete(
    "/users/:id",
    protect,
    authorize("admin"),
    userController.deleteUser
  );

  // Lesson routes
  router.post('/lessons', protect, authorize('admin'), lessonController.createLesson);
  router.get('/lessons', protect, lessonController.getLessons);
  router.get('/lessons/:id', protect, lessonController.getLessonById);
  router.post('/progress', protect, lessonController.completeLesson);
  router.post('/lessons/retry', protect, lessonController.retryLesson);
  router.get('/topics', lessonController.getTopics);
  router.get('/skills', lessonController.getSkills);


  app.use("/api", router);
};

export default initWebRoutes;
