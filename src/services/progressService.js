import Progress from '../models/progress.js';
import Lesson from '../models/lesson.js';
import User from '../models/user.js';
import mongoose from 'mongoose';

// Check if a user has completed a specific lesson
const checkLessonCompletion = async (userId, lessonId) => {
    try {
        // Guest users don't have completion status
        if (!userId) {
            return {
                success: true,
                statusCode: 200,
                message: 'Không có dữ liệu hoàn thành cho người dùng không xác thực',
                completed: false,
                progress: null
            };
        }

        // Find the most recent progress for this lesson and user
        const progress = await Progress.findOne({
            userId,
            lessonId,
            status: 'COMPLETE'
        }).sort({ completedAt: -1 });

        return {
            success: true,
            statusCode: 200,
            message: progress ? 'Người dùng đã hoàn thành bài học' : 'Người dùng chưa hoàn thành bài học',
            completed: !!progress,
            progress: progress
        };
    } catch (error) {
        return {
            success: false,
            statusCode: 500,
            message: `Lỗi khi kiểm tra hoàn thành bài học: ${error.message}`
        };
    }
};

// Get user's lesson progression
const getUserLessonProgression = async (userId, topicId, levelId) => {
    try {
        if (!userId) {
            return {
                success: false,
                statusCode: 400,
                message: 'User ID là bắt buộc'
            };
        }

        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                statusCode: 404,
                message: 'Không tìm thấy người dùng'
            };
        }

        // Get all lessons for the specified topic and level
        const lessons = await Lesson.find({
            topic: topicId,
            level: levelId || user.level
        }).sort({ createdAt: 1 });

        // Find completed lessons for this user
        const completedLessons = await Progress.distinct('lessonId', {
            userId,
            status: 'COMPLETE'
        });

        const lessonProgression = lessons.map(lesson => ({
            lessonId: lesson._id,
            title: lesson.title,
            type: lesson.type,
            skill: lesson.skill,
            completed: completedLessons.some(id => id.toString() === lesson._id.toString())
        }));

        return {
            success: true,
            statusCode: 200,
            message: 'Lấy tiến độ bài học thành công',
            progression: lessonProgression
        };
    } catch (error) {
        return {
            success: false,
            statusCode: 500,
            message: `Lỗi khi lấy tiến độ bài học: ${error.message}`
        };
    }
};

export default {
    checkLessonCompletion,
    getUserLessonProgression
};
