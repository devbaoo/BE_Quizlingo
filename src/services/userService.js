import User from '../models/user.js';

// Danh sách level và skill hợp lệ
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const SKILLS = ['vocabulary', 'reading', 'writing'];

// Lấy profile người dùng
const getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng'
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Lấy profile thành công',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills
      }
    };
  } catch (error) {
    console.error('Get user profile error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi lấy profile'
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
        message: 'Không tìm thấy người dùng'
      };
    }

    if (updateData.firstName) user.firstName = updateData.firstName;
    if (updateData.lastName) user.lastName = updateData.lastName;
    if (updateData.email) user.email = updateData.email;

    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Cập nhật profile thành công',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills
      }
    };
  } catch (error) {
    console.error('Update user profile error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi cập nhật profile'
    };
  }
};

// Chọn Knowledge Level
const chooseLevel = async (userId, level) => {
  try {
    console.log(`Choosing level for userId: ${userId}, level: ${level}`);

    if (!userId) {
      return {
        success: false,
        statusCode: 401,
        message: 'Vui lòng đăng nhập để chọn trình độ'
      };
    }

    if (!LEVELS.includes(level)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Trình độ không hợp lệ, phải là beginner, intermediate, hoặc advanced'
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng'
      };
    }

    user.level = level;
    if (level === 'beginner') {
      user.completedBasicVocab = [];
    }
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Chọn trình độ thành công',
      user: {
        id: user._id,
        email: user.email,
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills
      }
    };
  } catch (error) {
    console.error('Choose level error:', error);
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi chọn trình độ: ${error.message}`
    };
  }
};

// Chọn skill ưu tiên
const chooseSkill = async (userId, skills) => {
  try {
    console.log(`Choosing skills for userId: ${userId}, skills: ${skills}`);

    if (!userId) {
      return {
        success: false,
        statusCode: 401,
        message: 'Vui lòng đăng nhập để chọn kỹ năng'
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return {
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy người dùng'
      };
    }

    if (Array.isArray(skills) && skills.includes('all')) {
      user.preferredSkills = [...SKILLS];
    } else if (Array.isArray(skills)) {
      const invalidSkills = skills.filter(skill => !SKILLS.includes(skill));
      if (invalidSkills.length > 0) {
        return {
          success: false,
          statusCode: 400,
          message: `Kỹ năng không hợp lệ: ${invalidSkills.join(', ')}`
        };
      }
      user.preferredSkills = skills;
    } else {
      return {
        success: false,
        statusCode: 400,
        message: 'Skills phải là mảng các kỹ năng'
      };
    }

    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Chọn kỹ năng thành công',
      user: {
        id: user._id,
        email: user.email,
        level: user.level,
        userLevel: user.userLevel,
        xp: user.xp,
        lives: user.lives,
        completedBasicVocab: user.completedBasicVocab,
        preferredSkills: user.preferredSkills
      }
    };
  } catch (error) {
    console.error('Choose skill error:', error);
    return {
      success: false,
      statusCode: 500,
      message: `Lỗi khi chọn kỹ năng: ${error.message}`
    };
  }
};

// Lấy tất cả user (admin)
const getAllUsers = async () => {
  try {
    const users = await User.find({ deleted: { $ne: true } }).select('-password');
    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách người dùng thành công',
      count: users.length,
      users
    };
  } catch (error) {
    console.error('Get all users error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi lấy danh sách người dùng'
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
        message: 'Không tìm thấy người dùng'
      };
    }

    user.deleted = true;
    await user.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Xóa người dùng thành công'
    };
  } catch (error) {
    console.error('Soft delete user error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Lỗi khi xóa người dùng'
    };
  }
};

export default {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  softDeleteUser,
  chooseLevel,
  chooseSkill
};