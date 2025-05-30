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
    type: {
        type: String,
        enum: ['multiple_choice', 'text_input', 'audio_input'],
        required: true
    },
    skill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
        required: true
    },
    options: [{
        type: String,
        trim: true
    }],
    timeLimit: {
        type: Number,
        required: [true, 'Thời gian giới hạn là bắt buộc'],
        default: 0,
        min: [0, 'Thời gian giới hạn không được nhỏ hơn 0']
    },
    correctAnswer: {
        type: String,
        required: function () {
            return this.type === "multiple_choice";
        },
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