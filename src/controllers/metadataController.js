import metadataService from '../services/metadataService.js';

const getTopics = async (req, res) => {
    const result = await metadataService.getTopics();
    return res.status(result.statusCode).json(result);
};

const createTopic = async (req, res) => {
    const result = await metadataService.createTopic(req.body);
    return res.status(result.statusCode).json(result);
};

const updateTopic = async (req, res) => {
    const result = await metadataService.updateTopic(req.params.id, req.body);
    return res.status(result.statusCode).json(result);
};

const deleteTopic = async (req, res) => {
    const result = await metadataService.deleteTopic(req.params.id);
    return res.status(result.statusCode).json(result);
};

const getLevels = async (req, res) => {
    const result = await metadataService.getLevels();
    return res.status(result.statusCode).json(result);
};

const createLevel = async (req, res) => {
    const result = await metadataService.createLevel(req.body);
    return res.status(result.statusCode).json(result);
};

const updateLevel = async (req, res) => {
    const result = await metadataService.updateLevel(req.params.id, req.body);
    return res.status(result.statusCode).json(result);
};

const deleteLevel = async (req, res) => {
    const result = await metadataService.deleteLevel(req.params.id);
    return res.status(result.statusCode).json(result);
};

const getSkills = async (req, res) => {
    const { userId, topic, level } = req.query;
    const result = await metadataService.getSkills(userId, topic, level);
    return res.status(result.statusCode).json(result);
};

const createSkill = async (req, res) => {
    const result = await metadataService.createSkill(req.body);
    return res.status(result.statusCode).json(result);
};

const updateSkill = async (req, res) => {
    const result = await metadataService.updateSkill(req.params.id, req.body);
    return res.status(result.statusCode).json(result);
};

const deleteSkill = async (req, res) => {
    const result = await metadataService.deleteSkill(req.params.id);
    return res.status(result.statusCode).json(result);
};

export default {
    getTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    getLevels,
    createLevel,
    updateLevel,
    deleteLevel,
    getSkills,
    createSkill,
    updateSkill,
    deleteSkill
};