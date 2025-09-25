import crypto from "crypto";
import cacheService from "./cacheService.js";
import multiAiService from "./multiAiService.js";
import ContentPack from "../models/contentPack.js";
import generationRateLimiter from "../middleware/rateLimiter.js";

const CONTENT_TTL_MS = 15 * 60 * 1000; // 15 minutes cache TTL

function buildCacheKey({ topicId, topicName, level, goal, forceNew }) {
    // If forceNew is true, add timestamp to ensure unique cache key
    const raw = JSON.stringify({
        topicId,
        topicName,
        level,
        goal,
        ...(forceNew && { timestamp: Date.now() })
    });
    return crypto.createHash("sha1").update(raw).digest("hex");
}

function buildPrompt({ topicName, level, goal, include }) {
    const wants = {
        summary: include?.summary !== false,
        keyPoints: include?.keyPoints !== false,
        mindmap: include?.mindmap !== false,
        flashcards: include?.flashcards !== false,
        slideOutline: include?.slideOutline !== false,
    };

    return `Bạn là chuyên gia triết học Mác-Lê-Nin. Hãy tạo gói học liệu ngắn gọn, CHỈ JSON, tiếng Việt, về chủ đề: "${topicName || "Triết học Mác-Lê-Nin"
        }" cho level: "${level || "intermediate"}"${goal ? `, mục tiêu: "${goal}"` : ""
        }.

🚨 CRITICAL: Title PHẢI LÀ CHÍNH XÁC: "${topicName || "Triết học Mác-Lê-Nin"}" - KHÔNG ĐƯỢC THAY ĐỔI!

YÊU CẦU NGHIÊM NGẶT:
- CHỈ về triết học Mác-Lê-Nin (KHÔNG phải kinh tế chính trị).
- Title phải giữ NGUYÊN CHÍNH XÁC như yêu cầu ở trên.
- Trả về JSON THUẦN theo format bên dưới, không có markdown.
- Nội dung ngắn gọn, dễ học trước khi làm quiz.
- Tối ưu hoá độ ngắn gọn và rõ ràng.

FORMAT JSON:
{
  "title": "string",
  ${wants.summary ? '"summary": "string",' : ""}
  ${wants.keyPoints ? '"keyPoints": ["string", "string", "string"],' : ""}
  ${wants.mindmap ? '"mindmapNodes": [{"id":"root","label":"string","children":[{"id":"","label":"","children":[]}]}],' : ""}
  ${wants.flashcards ? '"flashcards": [{"term":"string","definition":"string","example":"string","tags":["string"],"difficulty":"easy|medium|hard"}],' : ""}
  ${wants.slideOutline ? '"slideOutline": ["Slide 1","Slide 2","Slide 3"],' : ""}
  "readingTime": 5,
  "sources": []
}

Trả về JSON hợp lệ bắt đầu bằng { và kết thúc bằng }.`;
}

async function generateContentPackInternal(params) {
    const prompt = buildPrompt(params);
    console.log(`🤖 Generating content pack with Multi-AI for topic: ${params.topicName}`);
    console.log(`📝 Expected title should be: ${params.topicName}`);

    const aiRes = await multiAiService.generateJsonContent(prompt, {
        strategy: "failover", // Use failover strategy for content generation
        baseDelay: 2000, // 2 second base delay for rate limiting
        maxProviderRetries: 3
    });
    const data = aiRes?.data || aiRes; // normalized by multiAiService

    console.log(`🔍 AI returned title: ${data.title}, forcing to: ${params.topicName}`);

    if (!data || !data.title) {
        throw new Error("AI returned invalid content pack structure");
    }

    const contentPack = {
        title: params.topicName, // LUÔN force sử dụng topicName từ params, KHÔNG dùng AI title
        topicId: params.topicId,
        topicName: params.topicName,
        level: params.level,
        goal: params.goal,
        summary: data.summary || "",
        keyPoints: data.keyPoints || [],
        mindmapNodes: data.mindmapNodes || [],
        flashcards: data.flashcards || [],
        slideOutline: data.slideOutline || [],
        readingTime: Number(data.readingTime) || 5,
        sources: data.sources || [],
    };

    return contentPack;
}

async function getOrGenerateContentPack(userId, params) {
    const cacheKey = buildCacheKey(params);

    return await cacheService.getOrSet(
        cacheKey,
        async () => {
            // Rate limit theo user để bảo vệ AI
            return await generationRateLimiter.requestGeneration(userId, async () => {
                const content = await generateContentPackInternal(params);
                // Lưu DB nhẹ để tái sử dụng (idempotent bằng cacheKey)
                try {
                    const saved = await ContentPack.findOneAndUpdate(
                        { cacheKey },
                        { ...content, cacheKey },
                        { upsert: true, new: true }
                    );
                    return saved.toObject();
                } catch (e) {
                    // Nếu unique key race condition, đọc lại
                    const existing = await ContentPack.findOne({ cacheKey });
                    return existing ? existing.toObject() : content;
                }
            });
        },
        CONTENT_TTL_MS
    );
}

export default {
    getOrGenerateContentPack,
};


