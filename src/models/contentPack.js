import mongoose from "mongoose";

const MindmapNodeSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        label: { type: String, required: true },
        children: [{ type: Object }],
    },
    { _id: false }
);

const FlashcardSchema = new mongoose.Schema(
    {
        term: { type: String, required: true },
        definition: { type: String, required: true },
        example: { type: String },
        tags: [{ type: String }],
        difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    },
    { _id: false }
);

const ContentPackSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        topicId: { type: mongoose.Schema.Types.ObjectId, ref: "MarxistTopic" },
        topicName: { type: String },
        level: { type: String },
        goal: { type: String },

        summary: { type: String, required: true },
        keyPoints: [{ type: String }],
        mindmapNodes: [MindmapNodeSchema],
        flashcards: [FlashcardSchema],
        slideOutline: [{ type: String }],

        readingTime: { type: Number, default: 5 },
        sources: [{ type: String }],

        // Deterministic key for caching and dedupe (topic+level+goal hash)
        cacheKey: { type: String, index: true, unique: true },
    },
    { timestamps: true }
);

const ContentPack = mongoose.model("ContentPack", ContentPackSchema);
export default ContentPack;


