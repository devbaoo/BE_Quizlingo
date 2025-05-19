import levelService from "../services/levelService.js";

const getLevels = async (req, res) => {
  const result = await levelService.getLevels();
  res.status(result.statusCode).json(result);
};

const createLevel = async (req, res) => {
  const result = await levelService.createLevel(req.body);
  res.status(result.statusCode).json(result);
};

const updateLevel = async (req, res) => {
  const { id } = req.params;
  const result = await levelService.updateLevel(id, req.body);
  res.status(result.statusCode).json(result);
};

const deleteLevel = async (req, res) => {
  const { id } = req.params;
  const result = await levelService.deleteLevel(id);
  res.status(result.statusCode).json(result);
};

export default {
  getLevels,
  createLevel,
  updateLevel,
  deleteLevel,
};
