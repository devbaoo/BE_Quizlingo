import mongoose from 'mongoose';


const userLearningPathSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true,
    },
    generatedAt: {
        type: Date,
        default: Date.now,
    },
    source: {
        type: String,
        enum: ['ai_generated'],
        default: 'ai_generated',
    },
    focusSkills: [String], // ['Listening', 'Speaking']
    accuracyBefore: Number, // độ chính xác trước khi tạo
    recommendedReason: String, // ghi chú lý do AI tạo bài học này
    order: Number, // thứ tự trong lộ trình
    completed: {
        type: Boolean,
        default: false,
    }
});

const UserLearningPath = mongoose.model('UserLearningPath', userLearningPathSchema);
export default UserLearningPath;