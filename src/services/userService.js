import User from "../models/user.js";
import Level from "../models/level.js";
import Skill from "../models/skill.js";
import Topic from "../models/topic.js";
import UserPackage from "../models/userPackage.js";
import moment from "moment-timezone";

// Lấy profile người dùng
const getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select("-password")
      .populate("level", "name")
      .populate("preferredSkills", "name")
      .populate("preferredTopics", "name");

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Lấy thông tin package đang active
    const now = moment().tz("Asia/Ho_Chi_Minh");
    const activePackage = await UserPackage.findOne({
      user: userId,
      isActive: true,
      endDate: { $gt: now.toDate() },
      paymentStatus: "completed",
    }).populate("package");

    // Tính số ngày còn lại của package
    let packageInfo = null;
    if (activePackage) {
      const daysRemaining = moment(activePackage.endDate).diff(now, "days");
      packageInfo = {
        name: activePackage.package.name,
        startDate: activePackage.startDate,
        endDate: activePackage.endDate,
        daysRemaining,
        isExpiringSoon: daysRemaining <= 7,
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
        level: user.level?.name || null,
        avatar: user.avatar,
        userLevel: user.userLevel,
        xp: user.xp,
        streak: user.streak,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills?.map((skill) => skill.name) || [],
        preferredTopics: user.preferredTopics?.map((topic) => topic.name) || [],
        activePackage: packageInfo,
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
      const foundNames = skills.map((s) => s.name);
      const invalid = skillNames.filter((name) => !foundNames.includes(name));
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

    user.preferredSkills = skills.map((skill) => skill._id);
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
      message: "Lỗi hệ thống",
    };
  }
};

const chooseTopic = async (userId, topicNames) => {
  try {
    const topics = await Topic.find({ name: { $in: topicNames } });

    if (topics.length !== topicNames.length) {
      const foundNames = topics.map((s) => s.name);
      const invalid = topicNames.filter((name) => !foundNames.includes(name));
      return {
        success: false,
        statusCode: 400,
        message: `Chủ đề không hợp lệ: ${invalid.join(", ")}`,
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

    user.preferredTopics = topics.map((topic) => topic._id);
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Chọn chủ đề thành công",
      user: { ...user.toObject(), preferredTopics: topics },
    };
  } catch (error) {
    console.error("ChooseTopic error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống",
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

const checkAndRegenerateLives = async (user) => {
  if (!user || user.lives >= 5) return;

  const now = new Date();
  const lastRegeneration = user.lastLivesRegenerationTime || now;
  const timeDiff = Math.floor((now - lastRegeneration) / (1000 * 60)); // Time difference in minutes

  if (timeDiff >= 10) {
    // Calculate how many lives to regenerate (1 per 10 minutes, up to max 5)
    const livesToRegenerate = Math.min(
      Math.floor(timeDiff / 10),
      5 - user.lives
    );

    if (livesToRegenerate > 0) {
      user.lives = Math.min(user.lives + livesToRegenerate, 5);
      user.lastLivesRegenerationTime = now;
      await user.save();
      console.log(
        `Regenerated ${livesToRegenerate} lives for user ${user._id}`
      );
    }
  }

  return user;
};

const getUserLivesStatus = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Check and regenerate lives
    await checkAndRegenerateLives(user);

    // Calculate time until next life regeneration
    let timeUntilNextLife = null;
    if (user.lives < 5) {
      const lastRegeneration = user.lastLivesRegenerationTime || new Date();
      const now = new Date();
      const timeSinceLastRegen = Math.floor(
        (now - lastRegeneration) / (1000 * 60)
      ); // minutes
      timeUntilNextLife = 10 - (timeSinceLastRegen % 10); // minutes until next 10-minute mark
      if (timeUntilNextLife === 10) timeUntilNextLife = 0;
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy thông tin lives thành công",
      data: {
        lives: user.lives,
        maxLives: 5,
        timeUntilNextLife: timeUntilNextLife,
        lastRegenerationTime: user.lastLivesRegenerationTime,
      },
    };
  } catch (error) {
    console.error("Get user lives status error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy thông tin lives",
    };
  }
};

const updateUserRole = async (userId, newRole) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy người dùng",
      };
    }

    // Validate role
    const validRoles = ["admin", "staff", "user"];
    if (!validRoles.includes(newRole)) {
      return {
        success: false,
        statusCode: 400,
        message: "Role không hợp lệ",
      };
    }

    user.role = newRole;
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật role thành công",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Update user role error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi cập nhật role",
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
  chooseTopic,
  getUserLivesStatus,
  checkAndRegenerateLives,
  updateUserRole,
};
