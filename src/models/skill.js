import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên kỹ năng là bắt buộc'],
        unique: true,
        trim: true,
        maxlength: [50, 'Tên kỹ năng không được vượt quá 50 ký tự']
    },
    description: {
        type: String,
        trim: true
    },
    supportedTypes: {
        type: [String],
        default: [],
        validate: {
            validator: function (v) {
                return v.every(type => ['multiple_choice', 'text_input', 'audio_input'].includes(type));
            },
            message: 'Loại bài học hỗ trợ phải là multiple_choice, text_input, hoặc audio_input'
        }
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

skillSchema.index({ name: 1 });

const Skill = mongoose.model('Skill', skillSchema);
export default Skill;