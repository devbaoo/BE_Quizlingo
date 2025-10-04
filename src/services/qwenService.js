import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Cấu hình cho Qwen2.5 72B từ OpenRouter API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const QWEN_MODEL_ID = "qwen/qwen2.5-72b-instruct"; // Model ID cho Qwen2.5 72B
// Nếu Qwen2.5 không khả dụng, sử dụng model thay thế
const FALLBACK_MODEL_ID = "google/gemini-pro-1.5"; // Fallback model

// Helper function để làm sạch JSON trong kết quả từ Qwen
const cleanAndRepairJson = (text) => {
  // Trích xuất nội dung JSON từ kết quả, bỏ qua markdown hoặc các đoạn văn bản khác
  let jsonContent = text.trim();

  // Tìm { đầu tiên và } cuối cùng để trích xuất JSON
  const firstBrace = jsonContent.indexOf("{");
  const lastBrace = jsonContent.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
  }

  // Thay thế các lỗi phổ biến trong chuỗi JSON
  jsonContent = jsonContent
    .replace(/,\s*]/g, "]") // Loại bỏ dấu phẩy trước dấu ]
    .replace(/,\s*}/g, "}") // Loại bỏ dấu phẩy trước dấu }
    .replace(/\\'/g, "'") // Chuyển đổi \' thành '
    .replace(/\\"/g, '\\"') // Đảm bảo dấu nháy kép được escape đúng
    .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3'); // Thêm dấu nháy kép cho keys

  return jsonContent;
};

/**
 * Tạo nội dung với Qwen2.5 72B thông qua OpenRouter API
 * @param {string} prompt - Prompt để gửi đến model
 * @param {number} maxRetries - Số lần thử lại tối đa khi gặp lỗi
 * @returns {Promise<Object>} - Đối tượng phản hồi với nội dung được tạo ra
 */
const generateContent = async (prompt, maxRetries = 3) => {
  // Nếu prompt quá dài, cắt bớt để tránh lỗi
  const trimmedPrompt =
    prompt.length > 24000 ? prompt.substring(0, 24000) : prompt;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key is missing");
      }

      // Xác định model ID để sử dụng - thử Qwen trước, nếu không được thì dùng fallback
      const modelToUse =
        attempt <= maxRetries / 2 ? QWEN_MODEL_ID : FALLBACK_MODEL_ID;

      console.log(
        `🤖 Generating with ${
          attempt <= maxRetries / 2 ? "Qwen2.5" : "Fallback model"
        } (attempt ${attempt})...`
      );

      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: modelToUse,
          messages: [
            {
              role: "system",
              content:
                "Bạn là trợ lý AI chuyên về triết học Mác-Lênin, giúp tạo nội dung học tập chất lượng cao bằng tiếng Việt.",
            },
            {
              role: "user",
              content: trimmedPrompt,
            },
          ],
          max_tokens: 2000, // Giảm từ 3000 xuống 2000 để tránh vượt quá giới hạn
          temperature: 0.7,
          top_p: 0.9,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.SITE_URL || "https://marx-edu.netlify.app",
            "X-Title":
              process.env.SITE_NAME || "Marx-Edu - Marxist Philosophy Learning",
          },
          timeout: 60000, // Tăng timeout lên 60 giây
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        console.log(
          `✅ AI generation successful with ${modelToUse} (attempt ${attempt})`
        );
        return {
          success: true,
          content: content,
          message: "Content generated successfully",
          model: modelToUse,
        };
      } else {
        throw new Error("Invalid response structure from OpenRouter API");
      }
    } catch (error) {
      console.error(
        `❌ Generation attempt ${attempt} failed:`,
        error.message || error
      );

      if (attempt === maxRetries) {
        throw new Error(
          `AI generation failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Exponential backoff với jitter - tăng thời gian chờ
      const delayMs = Math.min(5000, attempt * 1500 + Math.random() * 1000);
      console.log(`⏳ Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/**
 * Tạo nội dung JSON với OpenRouter API
 */
const generateJsonContent = async (prompt) => {
  try {
    // Tăng cường prompt để AI tạo JSON hợp lệ - làm prompt ngắn hơn và rõ ràng hơn
    const jsonPrompt = `${prompt}

🚨 CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "title": "Bài học về triết học Mác-Lênin",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Câu hỏi về triết học Mác-Lênin?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctAnswer": 0,
      "explanation": "Giải thích đáp án đúng"
    }
  ]
}

Tuân thủ các quy tắc sau:
- Bắt đầu ngay bằng {, kết thúc bằng }
- Chỉ sử dụng dấu nháy kép " cho chuỗi
- Không có dấu phẩy ở cuối các phần tử
- Chỉ trả về JSON thuần túy, không có giải thích hoặc markdown

GENERATE JSON NOW:`;

    console.log("🎯 Generating JSON content via OpenRouter API...");
    const response = await generateContent(jsonPrompt, 3); // Tăng số lần thử lên 3

    if (!response || !response.success) {
      throw new Error(response?.message || "Empty response from AI model");
    }

    const result = response.content;
    const usedModel = response.model || QWEN_MODEL_ID;

    console.log(`🔧 Cleaning and parsing JSON from ${usedModel}...`);
    const cleanedJson = cleanAndRepairJson(result);

    try {
      const parsedJson = JSON.parse(cleanedJson);
      console.log(`✅ JSON parsing successful from ${usedModel}`);

      // Kiểm tra cấu trúc JSON có đúng không
      if (
        !parsedJson.questions ||
        !Array.isArray(parsedJson.questions) ||
        parsedJson.questions.length === 0
      ) {
        throw new Error(
          "Invalid JSON structure - missing questions array or empty array"
        );
      }

      return parsedJson;
    } catch (parseError) {
      console.error("❌ JSON parsing error:", parseError.message);
      console.error("Raw response length:", result.length);
      console.error(
        "Cleaned JSON preview:",
        cleanedJson.substring(0, 200) + "..."
      );

      // Tạo JSON giả để tránh lỗi
      console.log("⚠️ Creating fallback JSON to avoid failure");
      return {
        title: "Bài học về triết học Mác-Lênin (Fallback)",
        questions: [
          {
            type: "multiple_choice",
            content:
              "Triết học Mác - Lê-nin ra đời trong bối cảnh lịch sử nào?",
            options: [
              "Giữa thế kỷ XIX, khi chủ nghĩa tư bản đang phát triển mạnh mẽ",
              "Đầu thế kỷ XX, sau cuộc cách mạng công nghiệp lần thứ nhất",
              "Cuối thế kỷ XVIII, trong thời kỳ cách mạng tư sản Pháp",
              "Đầu thế kỷ XIX, khi phong trào công nhân bắt đầu hình thành",
            ],
            correctAnswer: 0,
            explanation:
              "Triết học Mác - Lê-nin ra đời vào giữa thế kỷ XIX, trong bối cảnh chủ nghĩa tư bản đang phát triển mạnh mẽ và giai cấp công nhân đang hình thành, trở thành một lực lượng xã hội độc lập.",
          },
        ],
      };
    }
  } catch (error) {
    console.error("❌ JSON generation failed:", error.message);

    // Trả về JSON giả trong trường hợp lỗi nghiêm trọng
    return {
      title: "Bài học về triết học Mác-Lênin (Emergency Fallback)",
      questions: [
        {
          type: "multiple_choice",
          content: "Ai là người sáng lập ra chủ nghĩa Mác?",
          options: [
            "Karl Marx và Friedrich Engels",
            "Vladimir Lenin",
            "Joseph Stalin",
            "Rosa Luxemburg",
          ],
          correctAnswer: 0,
          explanation:
            "Karl Marx và Friedrich Engels là hai nhà tư tưởng đã cùng sáng lập ra chủ nghĩa Mác vào thế kỷ 19.",
        },
      ],
    };
  }
};

/**
 * Kiểm tra kết nối với OpenRouter API
 */
const validateConnection = async () => {
  try {
    console.log("🔍 Testing OpenRouter API connection...");

    // Sử dụng prompt đơn giản và ngắn để kiểm tra kết nối
    const testPrompt = "Trả lời ngắn gọn (1-2 câu): Triết học Mác-LêNin là gì?";
    const response = await generateContent(testPrompt, 1);

    if (
      response &&
      response.success &&
      response.content &&
      response.content.length > 10
    ) {
      const modelUsed = response.model || QWEN_MODEL_ID;
      console.log(`✅ Connection successful with model: ${modelUsed}`);
      return {
        success: true,
        message: `OpenRouter API connection validated successfully using ${modelUsed}`,
        model: modelUsed,
        response: response.content.substring(0, 100) + "...",
      };
    } else {
      throw new Error("Invalid response from OpenRouter API");
    }
  } catch (error) {
    console.error("❌ OpenRouter API connection failed:", error.message);
    return {
      success: false,
      message: `OpenRouter API connection failed: ${error.message}`,
      error: error.message,
    };
  }
};

export default {
  generateContent,
  generateJsonContent,
  validateConnection,
};
