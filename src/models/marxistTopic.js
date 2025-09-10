import mongoose from 'mongoose';

const marxistTopicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên chủ đề là bắt buộc'],
        unique: true,
        trim: true,
        maxlength: [100, 'Tên chủ đề không được vượt quá 100 ký tự']
    },
    title: {
        type: String,
        required: [true, 'Tiêu đề chủ đề là bắt buộc'],
        trim: true,
        maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
    },
    description: {
        type: String,
        required: [true, 'Mô tả chủ đề là bắt buộc'],
        trim: true,
        maxlength: [1000, 'Mô tả không được vượt quá 1000 ký tự']
    },
    keywords: [{
        type: String,
        trim: true,
        maxlength: [50, 'Từ khóa không được vượt quá 50 ký tự']
    }],
    // Độ khó đề xuất cho chủ đề này (1-5)
    suggestedDifficulty: {
        type: Number,
        min: 1,
        max: 5,
        default: 2
    },
    // Số lượng câu hỏi đề xuất
    suggestedQuestionCount: {
        type: Number,
        min: 10,
        max: 50,
        default: 10
    },
    // Chủ đề có đang hoạt động không
    isActive: {
        type: Boolean,
        default: true
    },
    // Thứ tự hiển thị
    displayOrder: {
        type: Number,
        default: 0
    },
    // Thống kê
    totalLessonsGenerated: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    },
    // Người tạo
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware để cập nhật updatedAt
marxistTopicSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Index để tối ưu query
marxistTopicSchema.index({ name: 1 });
marxistTopicSchema.index({ isActive: 1, displayOrder: 1 });
marxistTopicSchema.index({ createdBy: 1 });

const MarxistTopic = mongoose.model('MarxistTopic', marxistTopicSchema);
export default MarxistTopic; 