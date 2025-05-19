import Skill from "../models/skill.js";
import mongoose from "mongoose";

const getSkills = async (userId, topic, level) => {
  try {
    let skills = await Skill.find({ isActive: true }).select(
      "name description supportedTypes"
    );

    if (userId && topic && level) {
      const user = await mongoose.model("User").findById(userId);
      if (!user) {
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy người dùng",
        };
      }

      const topicDoc = await mongoose.model("Topic").findById(topic);
      if (!topicDoc || !topicDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Chủ đề không hợp lệ hoặc không hoạt động",
        };
      }

      const levelDoc = await mongoose.model("Level").findById(level);
      if (!levelDoc || !levelDoc.isActive) {
        return {
          success: false,
          statusCode: 400,
          message: "Cấp độ không hợp lệ hoặc không hoạt động",
        };
      }

      if (
        user.level &&
        user.level.toString() === levelDoc._id.toString() &&
        levelDoc.name === "beginner"
      ) {
        const completedVocab = user.completedBasicVocab.map((id) =>
          id.toString()
        );
        if (!completedVocab.includes(topic.toString())) {
          skills = skills.filter((skill) => skill.name === "vocabulary");
        }
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách kỹ năng thành công",
      skills,
    };
  } catch (error) {
    console.error("Get skills error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách kỹ năng",
    };
  }
};

const createSkill = async (skillData) => {
  try {
    const { name, description, supportedTypes } = skillData;
    if (!name) {
      return {
        success: false,
        statusCode: 400,
        message: "Tên kỹ năng là bắt buộc",
      };
    }

    const skill = await Skill.create({
      name,
      description,
      supportedTypes: supportedTypes || [],
    });
    return {
      success: true,
      statusCode: 201,
      message: "Tạo kỹ năng thành công",
      skill,
    };
  } catch (error) {
    console.error("Create skill error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi tạo kỹ năng",
    };
  }
};

const updateSkill = async (id, skillData) => {
  try {
    const { name, description, supportedTypes, isActive } = skillData;
    const skill = await Skill.findByIdAndUpdate(
      id,
      { name, description, supportedTypes, isActive },
      { new: true, runValidators: true }
    );
    if (!skill) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy kỹ năng",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật kỹ năng thành công",
      skill,
    };
  } catch (error) {
    console.error("Update skill error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi cập nhật kỹ năng",
    };
  }
};

const deleteSkill = async (id) => {
  try {
    const skill = await Skill.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!skill) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy kỹ năng",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Xóa kỹ năng thành công (soft delete)",
      skill,
    };
  } catch (error) {
    console.error("Delete skill error:", error);
    return {
      success: false,
      statusCode: 400,
      message: "Lỗi khi xóa kỹ năng",
    };
  }
};

export default {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
};
