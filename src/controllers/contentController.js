import contentService from "../services/contentService.js";
import marxistPhilosophyService from "../services/marxistPhilosophyService.js";
import ContentPack from "../models/contentPack.js";

const generateContent = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { topicId, topicName, level, goal, include } = req.body || {};

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const contentPack = await contentService.getOrGenerateContentPack(userId, {
            topicId,
            topicName,
            level,
            goal,
            include,
        });

        return res.status(200).json({ success: true, contentPack });
    } catch (error) {
        console.error("generateContent error:", error.message);
        return res
            .status(500)
            .json({ success: false, message: "Failed to generate content", error: error.message });
    }
};

const generateLessonFromContent = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { topicId, topicName, level, goal, questionCount } = req.body || {};

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Reuse deterministic content to guide question generation (implicit in marxistPhilosophyService prompts)
        const contentPack = await contentService.getOrGenerateContentPack(userId, {
            topicId,
            topicName,
            level,
            goal,
            include: { summary: true, keyPoints: true },
        });

        const result = await marxistPhilosophyService.generateMarxistLesson(userId, {
            questionCount: questionCount || 10,
            contentHints: {
                title: contentPack.title,
                summary: contentPack.summary,
                keyPoints: contentPack.keyPoints?.slice(0, 8) || [],
            },
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("generateLessonFromContent error:", error.message);
        return res
            .status(500)
            .json({ success: false, message: "Failed to generate lesson from content", error: error.message });
    }
};

const getLatestContent = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Lấy ContentPack mới nhất của user từ database
        const latestContentPack = await ContentPack.findOne({})
            .sort({ createdAt: -1 })
            .limit(1);

        if (!latestContentPack) {
            return res.status(404).json({
                success: false,
                message: "Chưa có ContentPack nào được tạo"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy ContentPack mới nhất thành công",
            contentPack: {
                id: latestContentPack._id,
                title: latestContentPack.title,
                summary: latestContentPack.summary,
                keyPoints: latestContentPack.keyPoints,
                mindmapNodes: latestContentPack.mindmapNodes,
                flashcards: latestContentPack.flashcards,
                slideOutline: latestContentPack.slideOutline,
                readingTime: latestContentPack.readingTime,
                level: latestContentPack.level,
                goal: latestContentPack.goal,
                createdAt: latestContentPack.createdAt,
                updatedAt: latestContentPack.updatedAt
            }
        });
    } catch (error) {
        console.error("getLatestContent error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to get latest content",
            error: error.message
        });
    }
};

export default {
    generateContent,
    generateLessonFromContent,
    getLatestContent,
};


