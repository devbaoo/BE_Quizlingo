import User from "../models/user.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";


// Lấy profile người dùng
const getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy profile thành công",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        level: user.level,
        avatar: user.avatar,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills,
      },
    };
  } catch (error) {
    console.error("Get user profile error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy profile",
    };
  }
};

// Cập nhật profile người dùng
const updateUserProfile = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    if (updateData.firstName) user.firstName = updateData.firstName;
    if (updateData.lastName) user.lastName = updateData.lastName;
    if (updateData.email) user.email = updateData.email;
    if (updateData.avatar) user.avatar = updateData.avatar;

    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật profile thành công",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills,
      },
    };
  } catch (error) {
    console.error("Update user profile error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi cập nhật profile",
    };
  }
};

// Chọn Knowledge Level
const chooseLevel = async (userId, levelName) => {
  try {
    const levelDoc = await Level.findOne({ name: levelName });
    if (!levelDoc) {
      return {
        success: false,
        statusCode: 400,
        message: `Không tìm thấy cấp độ "${levelName}"`,
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    user.level = levelDoc._id;
    if (levelName === "beginner") user.completedBasicVocab = [];
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Chọn trình độ thành công",
      user: { ...user.toObject(), level: levelDoc },
    };
  } catch (err) {
    console.error("ChooseLevel error:", err);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống",
    };
  }
};

// Chọn skill ưu tiên

const chooseSkill = async (userId, skillNames) => {
  try {
    const skills = await Skill.find({ name: { $in: skillNames } });

    if (skills.length !== skillNames.length) {
      const foundNames = skills.map(s => s.name);
      const invalid = skillNames.filter(name => !foundNames.includes(name));
      return {
        success: false,
        statusCode: 400,
        message: `Kỹ năng không hợp lệ: ${invalid.join(", ")}`,
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    user.preferredSkills = skills.map(skill => skill._id);
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Chọn kỹ năng thành công",
      user: { ...user.toObject(), preferredSkills: skills },
    };
  } catch (error) {
    console.error("ChooseSkill error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống"
    };
  }
};

// Lấy tất cả user (admin)
const getAllUsers = async () => {
  try {
    const users = await User.find({ deleted: { $ne: true } }).select(
      "-password"
    );
    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách người dùng thành công",
      count: users.length,
      users,
    };
  } catch (error) {
    console.error("Get all users error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách người dùng",
    };
  }
};

// Xóa mềm user (admin)
const softDeleteUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    user.deleted = true;
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Xóa người dùng thành công",
    };
  } catch (error) {
    console.error("Soft delete user error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xóa người dùng",
    };
  }
};

export default {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  softDeleteUser,
  chooseLevel,
  chooseSkill,
};
