import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'UserId là bắt buộc']
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: [true, 'LessonId là bắt buộc']
    },
    score: {
        type: Number,
        required: [true, 'Điểm là bắt buộc'],
        min: [0, 'Điểm không được nhỏ hơn 0'],
        max: [10000, 'Điểm không được lớn hơn 10000']
    },
    isRetried: {
        type: Boolean,
        default: false
    },
    questionResults: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        isCorrect: { type: Boolean, required: true },
        score: { type: Number, required: true },
        isTimeout: { type: Boolean, default: false }
    }],
    completedAt: {
        type: Date,
        default: Date.now
    }
});

progressSchema.index({ userId: 1, lessonId: 1 });

const Progress = mongoose.model('Progress', progressSchema);
export default Progress;