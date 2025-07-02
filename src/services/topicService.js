import Topic from "../models/topic.js";

const getTopics = async () => {
  try {
    const topics = await Topic.find({ isActive: true }).select(
      "name description isActive"
    );
    return topics;
  } catch (error) {
    console.error("Get topics error:", error);
    throw error;
  }
};

const createTopic = async (topicData) => {
  try {
    const { name, description } = topicData;
    const topic = await Topic.create({ name, description });
    return topic;
  } catch (error) {
    console.error("Create topic error:", error);
    throw error;
  }
};

const updateTopic = async (id, topicData) => {
  try {
    const { name, description, isActive } = topicData;
    const topic = await Topic.findByIdAndUpdate(
      id,
      { name, description, isActive },
      { new: true }
    );
    if (!topic) {
      return null;
    }
    return topic;
  } catch (error) {
    console.error("Update topic error:", error);
    throw error;
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
      return null;
    }
    return topic;
  } catch (error) {
    console.error("Delete topic error:", error);
    throw error;
  }
};

export default {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
};
