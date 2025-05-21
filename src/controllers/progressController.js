import progressService from '../services/progressService.js';

const checkLessonCompletion = async (req, res) => {
    const { lessonId } = req.params;
    const userId = req.user?.id || null;

    const result = await progressService.checkLessonCompletion(userId, lessonId);
    res.status(result.statusCode).json(result);
};

const getUserLessonProgression = async (req, res) => {
    const userId = req.user?.id || null;
    const { topicId, levelId } = req.query;

    const result = await progressService.getUserLessonProgression(userId, topicId, levelId);
    res.status(result.statusCode).json(result);
};

export default {
    checkLessonCompletion,
    getUserLessonProgression
};
