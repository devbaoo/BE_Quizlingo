import Topic from "../models/topic.js";

const getTopics = async () => {
  try {
    const topics = await Topic.find({ isActive: true }).select(
      "name description"
    );
    return {
      success: true,
      statusCode: 200,
      message: "Lấy danh sách chủ đề thành công",
      topics,
    };
  } catch (error) {
    console.error("Get topics error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách chủ đề",
    };
  }
};

const createTopic = async (topicData) => {
  try {
    const { name, description } = topicData;
    if (!name) {
      return {
        success: false,
        statusCode: 400,
        message: "Tên chủ đề là bắt buộc",
      };
    }

    const topic = await Topic.create({ name, description });
    return {
      success: true,
      statusCode: 201,
      message: "Tạo chủ đề thành công",
      topic,
    };
  } catch (error) {
    console.error("Create topic error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi tạo chủ đề",
    };
  }
};

const updateTopic = async (id, topicData) => {
  try {
    const { name, description, isActive } = topicData;
    const topic = await Topic.findByIdAndUpdate(
      id,
      { name, description, isActive },
      { new: true, runValidators: true }
    );

    if (!topic) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy chủ đề",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Cập nhật chủ đề thành công",
      topic,
    };
  } catch (error) {
    console.error("Update topic error:", error);
    return {
      success: false,
      statusCode: 400,
      message: error.message || "Lỗi khi cập nhật chủ đề",
    };
  }
};

const deleteTopic = async (id) => {
  try {
    const topic = await Topic.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!topic) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy chủ đề",
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Xóa chủ đề thành công (soft delete)",
      topic,
    };
  } catch (error) {
    console.error("Delete topic error:", error);
    return {
      success: false,
      statusCode: 400,
      message: "Lỗi khi xóa chủ đề",
    };
  }
};

export default {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
};
