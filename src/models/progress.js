import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID là bắt buộc']
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: [true, 'Lesson ID là bắt buộc']
    },
    score: {
        type: Number,
        required: [true, 'Điểm là bắt buộc'],
        min: [0, 'Điểm không được nhỏ hơn 0']
    },
    status: {
        type: String,
        enum: ['COMPLETE', 'FAILED', 'IN_PROGRESS'],
        default: 'IN_PROGRESS'
    },
    isRetried: {
        type: Boolean,
        default: false
    },
    questionResults: [
        {
            questionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Question',
                required: true
            },
            answer: {
                type: String,
                required: [true, 'Câu trả lời là bắt buộc']
            },
            isCorrect: {
                type: Boolean,
                required: true
            },
            score: {
                type: Number,
                required: true,
                min: 0
            },
            isTimeout: {
                type: Boolean,
                default: false
            },
            transcription: {
                type: String,
                default: null
            },
            feedback: {
                type: String,
                default: null
            }
        }
    ],
    completedAt: {
        type: Date,
        default: Date.now
    }
});

progressSchema.index({ userId: 1, lessonId: 1 });

const Progress = mongoose.model('Progress', progressSchema);
export default Progress;