import Topic from '../models/topic.js';
import Level from '../models/level.js';
import Skill from '../models/skill.js';
import mongoose from 'mongoose';

// Topics
const getTopics = async () => {
    try {
        const topics = await Topic.find({ isActive: true }).select('name description');
        return {
            success: true,
            statusCode: 200,
            message: 'Lấy danh sách chủ đề thành công',
            topics
        };
    } catch (error) {
        console.error('Get topics error:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi lấy danh sách chủ đề'
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
                message: 'Tên chủ đề là bắt buộc'
            };
        }

        const topic = await Topic.create({ name, description });
        return {
            success: true,
            statusCode: 201,
            message: 'Tạo chủ đề thành công',
            topic
        };
    } catch (error) {
        console.error('Create topic error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi tạo chủ đề'
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
                message: 'Không tìm thấy chủ đề'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Cập nhật chủ đề thành công',
            topic
        };
    } catch (error) {
        console.error('Update topic error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi cập nhật chủ đề'
        };
    }
};

const deleteTopic = async (id) => {
    try {
        const topic = await Topic.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!topic) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy chủ đề'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Xóa chủ đề thành công (soft delete)',
            topic
        };
    } catch (error) {
        console.error('Delete topic error:', error);
        return {
            success: false,
            statusCode: 400,
            message: 'Lỗi khi xóa chủ đề'
        };
    }
};

// Levels
const getLevels = async () => {
    try {
        const levels = await Level.find({ isActive: true }).select('name maxScore timeLimit');
        return {
            success: true,
            statusCode: 200,
            message: 'Lấy danh sách cấp độ thành công',
            levels
        };
    } catch (error) {
        console.error('Get levels error:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi lấy danh sách cấp độ'
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
                message: 'Tên cấp độ, điểm tối đa, và thời gian giới hạn là bắt buộc'
            };
        }

        const level = await Level.create({ name, maxScore, timeLimit, description });
        return {
            success: true,
            statusCode: 201,
            message: 'Tạo cấp độ thành công',
            level
        };
    } catch (error) {
        console.error('Create level error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi tạo cấp độ'
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
                message: 'Không tìm thấy cấp độ'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Cập nhật cấp độ thành công',
            level
        };
    } catch (error) {
        console.error('Update level error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi cập nhật cấp độ'
        };
    }
};

const deleteLevel = async (id) => {
    try {
        const level = await Level.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!level) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy cấp độ'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Xóa cấp độ thành công (soft delete)',
            level
        };
    } catch (error) {
        console.error('Delete level error:', error);
        return {
            success: false,
            statusCode: 400,
            message: 'Lỗi khi xóa cấp độ'
        };
    }
};

// Skills
const getSkills = async (userId, topic, level) => {
    try {
        let skills = await Skill.find({ isActive: true }).select('name description supportedTypes');

        if (userId && topic && level) {
            const user = await mongoose.model('User').findById(userId);
            if (!user) {
                return {
                    success: false,
                    statusCode: 404,
                    message: 'Không tìm thấy người dùng'
                };
            }

            const topicDoc = await mongoose.model('Topic').findById(topic);
            if (!topicDoc || !topicDoc.isActive) {
                return {
                    success: false,
                    statusCode: 400,
                    message: 'Chủ đề không hợp lệ hoặc không hoạt động'
                };
            }

            const levelDoc = await mongoose.model('Level').findById(level);
            if (!levelDoc || !levelDoc.isActive) {
                return {
                    success: false,
                    statusCode: 400,
                    message: 'Cấp độ không hợp lệ hoặc không hoạt động'
                };
            }

            if (user.level && user.level.toString() === levelDoc._id.toString() && levelDoc.name === 'beginner') {
                const completedVocab = user.completedBasicVocab.map(id => id.toString());
                if (!completedVocab.includes(topic.toString())) {
                    skills = skills.filter(skill => skill.name === 'vocabulary');
                }
            }
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Lấy danh sách kỹ năng thành công',
            skills
        };
    } catch (error) {
        console.error('Get skills error:', error);
        return {
            success: false,
            statusCode: 500,
            message: 'Lỗi khi lấy danh sách kỹ năng'
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
                message: 'Tên kỹ năng là bắt buộc'
            };
        }

        const skill = await Skill.create({
            name,
            description,
            supportedTypes: supportedTypes || []
        });
        return {
            success: true,
            statusCode: 201,
            message: 'Tạo kỹ năng thành công',
            skill
        };
    } catch (error) {
        console.error('Create skill error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi tạo kỹ năng'
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
                message: 'Không tìm thấy kỹ năng'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Cập nhật kỹ năng thành công',
            skill
        };
    } catch (error) {
        console.error('Update skill error:', error);
        return {
            success: false,
            statusCode: 400,
            message: error.message || 'Lỗi khi cập nhật kỹ năng'
        };
    }
};

const deleteSkill = async (id) => {
    try {
        const skill = await Skill.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!skill) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy kỹ năng'
            };
        }

        return {
            success: true,
            statusCode: 200,
            message: 'Xóa kỹ năng thành công (soft delete)',
            skill
        };
    } catch (error) {
        console.error('Delete skill error:', error);
        return {
            success: false,
            statusCode: 400,
            message: 'Lỗi khi xóa kỹ năng'
        };
    }
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