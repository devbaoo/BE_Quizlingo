import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Cấu hình cho Qwen2.5 72B từ OpenRouter API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const QWEN_MODEL_ID = "qwen/qwen2.5-72b-instruct"; // Model ID cho Qwen2.5 72B

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
 * @returns {Promise<string>} - Nội dung được tạo ra
 */
const generateContent = async (prompt, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key is missing");
      }

      console.log(`🤖 Generating with Qwen2.5 (attempt ${attempt})...`);

      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: QWEN_MODEL_ID,
          messages: [
            {
              role: "system",
              content:
                "Bạn là trợ lý AI chuyên về triết học Mác-Lênin, giúp tạo nội dung học tập chất lượng cao bằng tiếng Việt.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 3000,
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
          timeout: 45000, // 45 seconds timeout
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        console.log(`✅ Qwen2.5 generation successful (attempt ${attempt})`);
        return content;
      } else {
        throw new Error("Invalid response structure from Qwen2.5");
      }
    } catch (error) {
      console.error(
        `❌ Qwen2.5 generation attempt ${attempt} failed:`,
        error.message || error
      );

      if (attempt === maxRetries) {
        throw new Error(
          `Qwen2.5 generation failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Exponential backoff với jitter
      const delayMs = attempt * 1000 + Math.random() * 1000;
      console.log(`⏳ Retrying Qwen2.5 in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/**
 * Tạo nội dung JSON với Qwen2.5 72B
 */
const generateJsonContent = async (prompt) => {
  try {
    // Tăng cường prompt để Qwen2.5 tạo JSON hợp lệ
    const jsonPrompt = `${prompt}

🚨 CRITICAL JSON FORMATTING RULES:
1. Return ONLY pure JSON - NO markdown, NO explanations
2. Start immediately with { and end with }
3. Use ONLY double quotes " for strings
4. NO trailing commas anywhere
5. Escape special characters properly: \" \\ \n \t
6. Close ALL brackets and braces correctly
7. Focus ONLY on Vietnamese Marxist-Leninist philosophy
8. Each question about "triết học Mác-LêNin" (NOT economics)

EXAMPLE FORMAT:
{"title":"Bài học","questions":[{"type":"multiple_choice","content":"Câu hỏi?","options":["A","B","C","D"],"correctAnswer":0,"explanation":"Giải thích"}]}

NOW GENERATE VALID JSON:`;

    console.log("🎯 Generating JSON content with Qwen2.5...");
    const result = await generateContent(jsonPrompt, 2);

    if (!result) {
      throw new Error("Empty response from Qwen2.5");
    }

    console.log("🔧 Cleaning and parsing JSON from Qwen2.5...");
    const cleanedJson = cleanAndRepairJson(result);

    try {
      const parsedJson = JSON.parse(cleanedJson);
      console.log("✅ Qwen2.5 JSON parsing successful");
      return parsedJson;
    } catch (parseError) {
      console.error("❌ Qwen2.5 JSON parsing error:", parseError.message);
      console.error("Raw response length:", result.length);
      console.error(
        "Cleaned JSON preview:",
        cleanedJson.substring(0, 200) + "..."
      );
      throw new Error(`Qwen2.5 JSON parsing error: ${parseError.message}`);
    }
  } catch (error) {
    console.error("❌ Qwen2.5 JSON generation failed:", error.message);
    throw error;
  }
};

/**
 * Kiểm tra kết nối với Qwen2.5
 */
const validateConnection = async () => {
  try {
    console.log("🔍 Testing Qwen2.5 connection...");

    const testPrompt = "Hãy trả lời ngắn gọn: Triết học Mác-LêNin là gì?";
    const result = await generateContent(testPrompt, 1);

    if (result && result.length > 10) {
      console.log("✅ Qwen2.5 connection successful");
      return {
        success: true,
        message: "Qwen2.5 connection validated successfully",
        response: result.substring(0, 100) + "...",
      };
    } else {
      throw new Error("Invalid response from Qwen2.5");
    }
  } catch (error) {
    console.error("❌ Qwen2.5 connection failed:", error.message);
    return {
      success: false,
      message: `Qwen2.5 connection failed: ${error.message}`,
      error: error.message,
    };
  }
};

export default {
  generateContent,
  generateJsonContent,
  validateConnection,
};
