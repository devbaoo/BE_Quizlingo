import userService from "../services/userService.js";

// Get user profile
let getUserProfile = async (req, res) => {
  try {
    let result = await userService.getUserProfile(req.user._id);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update user profile
let updateUserProfile = async (req, res) => {
  try {
    let result = await userService.updateUserProfile(req.user._id, req.body);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all users (admin only)
let getAllUsers = async (req, res) => {
  try {
    let result = await userService.getAllUsers();

    return res.status(result.statusCode).json({
      success: result.success,
      count: result.count,
      users: result.users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Delete user (admin only)
let deleteUser = async (req, res) => {
  try {
    let result = await userService.softDeleteUser(req.params.id);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export default {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  deleteUser,
};
