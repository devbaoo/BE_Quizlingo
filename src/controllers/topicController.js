import topicService from "../services/topicService.js";

const getTopics = async (req, res) => {
  const result = await topicService.getTopics();
  res.status(result.statusCode).json(result);
};

const createTopic = async (req, res) => {
  const result = await topicService.createTopic(req.body);
  res.status(result.statusCode).json(result);
};

const updateTopic = async (req, res) => {
  const { id } = req.params;
  const result = await topicService.updateTopic(id, req.body);
  res.status(result.statusCode).json(result);
};

const deleteTopic = async (req, res) => {
  const { id } = req.params;
  const result = await topicService.deleteTopic(id);
  res.status(result.statusCode).json(result);
};

export default {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
};
