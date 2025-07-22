import mongoose from 'mongoose';

const marxistLearningPathSchema = new mongoose.Schema({
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
        enum: ['ai_generated_marxist'],
        default: 'ai_generated_marxist',
    },
    // Chủ đề cụ thể trong kinh tế chính trị Mác-Lê-Nin (reference to MarxistTopic)
    marxistTopic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarxistTopic',
        required: true
    },
    // Độ khó (1-5, với 1 là cơ bản, 5 là nâng cao)
    difficultyLevel: {
        type: Number,
        min: 1,
        max: 5,
        default: 1
    },
    // Điểm số trung bình của lesson trước đó (để điều chỉnh độ khó)
    previousScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // Lý do AI tạo lesson này
    recommendedReason: {
        type: String,
        required: true
    },
    // Thứ tự trong lộ trình
    order: {
        type: Number,
        required: true
    },
    // Trạng thái hoàn thành
    completed: {
        type: Boolean,
        default: false,
    },
    // Điểm số đạt được khi hoàn thành
    achievedScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    // Thời gian hoàn thành
    completedAt: {
        type: Date,
        default: null
    }
});

// Index để tối ưu query
marxistLearningPathSchema.index({ userId: 1, order: 1 });
marxistLearningPathSchema.index({ userId: 1, marxistTopic: 1 });
marxistLearningPathSchema.index({ userId: 1, completed: 1 });

const MarxistLearningPath = mongoose.model('MarxistLearningPath', marxistLearningPathSchema);
export default MarxistLearningPath; 