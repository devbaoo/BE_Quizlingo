import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String, // e.g., "lesson_generation"
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    payload: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const ErrorLog = mongoose.model("ErrorLog", errorLogSchema);
export default ErrorLog;
