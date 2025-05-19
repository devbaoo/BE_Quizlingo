import skillService from "../services/skillService.js";

const getSkills = async (req, res) => {
  const { userId, topic, level } = req.query;
  const result = await skillService.getSkills(userId, topic, level);
  res.status(result.statusCode).json(result);
};

const createSkill = async (req, res) => {
  const result = await skillService.createSkill(req.body);
  res.status(result.statusCode).json(result);
};

const updateSkill = async (req, res) => {
  const { id } = req.params;
  const result = await skillService.updateSkill(id, req.body);
  res.status(result.statusCode).json(result);
};

const deleteSkill = async (req, res) => {
  const { id } = req.params;
  const result = await skillService.deleteSkill(id);
  res.status(result.statusCode).json(result);
};

export default {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
};
