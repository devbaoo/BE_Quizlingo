import Level from "../models/level.js";

const getLevels = async () => {
  try {
    const levels = await Level.find({ isActive: true }).select(
      "name maxScore timeLimit"
    );
    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách cấp độ thành công",
      levels,
    };
  } catch (error) {
    console.error("Get levels error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách cấp độ",
    };
  }
};

const createLevel = async (levelData) => {
  try {
    const { name, maxScore, timeLimit, description } = levelData;
    if (!name || !maxScore || timeLimit === undefined) {
      return {
        success: false,
        statusCode: 400,
        message: "Tên cấp độ, điểm tối đa, và thời gian giới hạn là bắt buộc",
      };
    }

    const level = await Level.create({
      name,
      maxScore,
      timeLimit,
      description,
    });
    return {
      success: true,
      statusCode: 201,
      message: "Tạo cấp độ thành công",
      level,
    };
  } catch (error) {
    console.error("Create level error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi tạo cấp độ",
    };
  }
};

const updateLevel = async (id, levelData) => {
  try {
    const { name, maxScore, timeLimit, description, isActive } = levelData;
    const level = await Level.findByIdAndUpdate(
      id,
      { name, maxScore, timeLimit, description, isActive },
      { new: true, runValidators: true }
    );
    if (!level) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy cấp độ",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật cấp độ thành công",
      level,
    };
  } catch (error) {
    console.error("Update level error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi cập nhật cấp độ",
    };
  }
};

const deleteLevel = async (id) => {
  try {
    const level = await Level.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!level) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy cấp độ",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Xóa cấp độ thành công (soft delete)",
      level,
    };
  } catch (error) {
    console.error("Delete level error:", error);
    return {
      success: false,
      statusCode: 400,
      message: "Lỗi khi xóa cấp độ",
    };
  }
};

export default {
  getLevels,
  createLevel,
  updateLevel,
  deleteLevel,
};
