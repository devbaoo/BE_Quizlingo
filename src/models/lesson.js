import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Tiêu đề bài học là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tiêu đề không được vượt quá 100 ký tự']
    },
    type: {
        type: String,
        enum: {
            values: ['multiple_choice', 'text_input'],
            message: 'Loại bài học phải là multiple_choice hoặc text_input'
        },
        required: [true, 'Loại bài học là bắt buộc']
    },
    topic: {
        type: String,
        enum: {
            values: ['travel', 'business', 'daily_life', 'education', 'food'],
            message: 'Chủ đề phải là một trong: travel, business, daily_life, education, food'
        },
        required: [true, 'Chủ đề bài học là bắt buộc']
    },
    level: {
        type: String,
        enum: {
            values: ['beginner', 'intermediate', 'advanced'],
            message: 'Trình độ phải là beginner, intermediate, hoặc advanced'
        },
        required: [true, 'Trình độ bài học là bắt buộc']
    },
    skill: {
        type: String,
        enum: {
            values: ['vocabulary', 'reading', 'writing'],
            message: 'Kỹ năng phải là vocabulary, reading, hoặc writing'
        },
        required: [true, 'Kỹ năng bài học là bắt buộc']
    },
    maxScore: {
        type: Number,
        default: function () {
            if (this.level === 'beginner') return 1000;
            if (this.level === 'intermediate') return 1500;
            return 2000;
        }
    },
    timeLimit: {
        type: Number,
        default: function () {
            return this.level === 'beginner' ? 0 : 30;
        }
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

lessonSchema.pre('validate', function (next) {
    if (this.type === 'multiple_choice' && !['vocabulary', 'reading'].includes(this.skill)) {
        next(new Error('Loại multiple_choice chỉ áp dụng cho kỹ năng vocabulary hoặc reading'));
    }
    if (this.type === 'text_input' && this.skill !== 'writing') {
        next(new Error('Loại text_input chỉ áp dụng cho kỹ năng writing'));
    }
    next();
});

lessonSchema.index({ type: 1, topic: 1, level: 1, skill: 1 });

const Lesson = mongoose.model('Lesson', lessonSchema);
export default Lesson;