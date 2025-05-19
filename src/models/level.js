import mongoose from 'mongoose';

const levelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên cấp độ là bắt buộc'],
        unique: true,
        trim: true,
        maxlength: [50, 'Tên cấp độ không được vượt quá 50 ký tự']
    },
    maxScore: {
        type: Number,
        required: [true, 'Điểm tối đa là bắt buộc'],
        min: [0, 'Điểm tối đa phải lớn hơn 0']
    },
    timeLimit: {
        type: Number,
        required: [true, 'Thời gian giới hạn là bắt buộc'],
        min: [0, 'Thời gian giới hạn không được nhỏ hơn 0']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

levelSchema.index({ name: 1 });

const Level = mongoose.model('Level', levelSchema);
export default Level;