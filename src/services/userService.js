import User from "../models/user.js";
import bcrypt from "bcryptjs";

// Get user profile
let getUserProfile = async (userId) => {
  try {
    let user = await User.findById(userId).select("-password");

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "User not found",
      };
    }

    return {
      success: true,
      statusCode: 200,
      user,
    };
  } catch (error) {
    console.error("Get user profile error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Server error",
    };
  }
};

// Update user profile
let updateUserProfile = async (userId, userData) => {
  try {
    let user = await User.findById(userId);

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "User not found",
      };
    }

    // Update fields
    if (userData.firstName) user.firstName = userData.firstName;
    if (userData.lastName) user.lastName = userData.lastName;
    if (userData.email) user.email = userData.email;

    // Update password if provided
    if (userData.password) {
      let salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(userData.password, salt);
    }

    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "User profile updated",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Update user profile error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Server error",
    };
  }
};

// Get all users (admin only)
let getAllUsers = async () => {
  try {
    let query = User.find().select("-password");
    let users = await query;

    return {
      success: true,
      statusCode: 200,
      count: users.length,
      users,
    };
  } catch (error) {
    console.error("Get all users error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Server error",
    };
  }
};

// Soft delete user
let softDeleteUser = async (userId) => {
  try {
    let user = await User.findById(userId);

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "User not found",
      };
    }

    await user.deleteOne();

    return {
      success: true,
      statusCode: 200,
      message: "User soft deleted successfully",
    };
  } catch (error) {
    console.error("Soft delete user error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Server error",
    };
  }
};

export default {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  softDeleteUser,
};
