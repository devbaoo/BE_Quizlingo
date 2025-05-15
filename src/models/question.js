import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: [true, 'LessonId là bắt buộc']
    },
    content: {
        type: String,
        required: [true, 'Nội dung câu hỏi là bắt buộc'],
        trim: true
    },
    options: [{
        type: String,
        trim: true
    }],
    correctAnswer: {
        type: String,
        required: [true, 'Đáp án đúng là bắt buộc'],
        trim: true
    },
    score: {
        type: Number,
        default: 100,
        min: [0, 'Điểm không được nhỏ hơn 0']
    },
    audioContent: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

questionSchema.index({ lessonId: 1 });

const Question = mongoose.model('Question', questionSchema);
export default Question;