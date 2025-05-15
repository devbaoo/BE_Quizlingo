import userService from '../services/userService.js';

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const result = await userService.getUserProfile(req.user.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const result = await userService.updateUserProfile(req.user.id, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await userService.getAllUsers();
    return res.status(result.statusCode).json({
      success: result.success,
      count: result.count,
      users: result.users
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const result = await userService.softDeleteUser(req.params.id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Chọn Knowledge Level
const chooseLevel = async (req, res) => {
  try {
    const { level } = req.body;
    const result = await userService.chooseLevel(req.user.id, level);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error("Choose level error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// Chọn skill ưu tiên
const chooseSkill = async (req, res) => {
  try {
    const { skills } = req.body;
    const result = await userService.chooseSkill(req.user.id, skills);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error("Choose skill error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export default {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  deleteUser,
  chooseLevel,
  chooseSkill
};