import topicService from "../services/topicService.js";

const getTopics = async (req, res) => {
  try {
    const topics = await topicService.getTopics();
    res.status(200).json({ success: true, topics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTopic = async (req, res) => {
  try {
    const { name, description } = req.body;
    const topic = await topicService.createTopic({ name, description });
    res.status(201).json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await topicService.updateTopic(id, req.body);
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.status(200).json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await topicService.deleteTopic(id);
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.status(200).json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
};
