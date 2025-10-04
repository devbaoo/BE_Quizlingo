import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Cấu hình cho Qwen từ OpenRouter API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const QWEN_MODEL_ID = "qwen/qwen-2.5-72b-instruct"; // Model ID cho Qwen 2.5 72B (chính xác theo API)
// Nếu Qwen2.5 không khả dụng, sử dụng model thay thế
const FALLBACK_MODEL_ID = "qwen/qwen-2.5-72b-instruct:free"; // Fallback model (miễn phí)

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
    // Xác định model ID để sử dụng - thử Qwen trước, nếu không được thì dùng fallback
    const modelToUse =
      attempt <= maxRetries / 2 ? QWEN_MODEL_ID : FALLBACK_MODEL_ID;

    try {
      if (!OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key is missing");
      }

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
          timeout: 120000, // Tăng timeout lên 120 giây
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
      // Lưu lại model đang sử dụng cho việc báo lỗi
      const currentModel = modelToUse;

      // Chi tiết lỗi hơn để debug
      const statusCode = error.response?.status;
      const statusText = error.response?.statusText;
      const errorData = error.response?.data;

      // Kiểm tra lỗi timeout và lỗi network
      const isTimeout = error.message && error.message.includes("timeout");
      const isNetworkError =
        error.message &&
        (error.message.includes("network") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          !error.response);

      // Ghi log đầy đủ chi tiết lỗi
      console.error(
        `❌ Generation attempt ${attempt} failed with model ${currentModel}:`,
        {
          statusCode,
          statusText,
          message: error.message || "Unknown error",
          isTimeout: isTimeout,
          isNetworkError: isNetworkError,
          errorDetails: errorData ? JSON.stringify(errorData) : undefined,
          stack: error.stack
            ? error.stack.split("\n").slice(0, 3).join("\n")
            : undefined,
        }
      );

      if (attempt === maxRetries) {
        // Tạo thông báo lỗi cụ thể cho người dùng
        let userFriendlyMessage = "Không thể tạo nội dung do lỗi hệ thống AI";

        if (isTimeout) {
          userFriendlyMessage =
            "Hệ thống AI mất quá nhiều thời gian để phản hồi. Vui lòng thử lại sau ít phút.";
        } else if (isNetworkError) {
          userFriendlyMessage =
            "Lỗi kết nối với hệ thống AI. Vui lòng kiểm tra kết nối internet và thử lại.";
        } else if (statusCode === 401) {
          userFriendlyMessage =
            "Lỗi xác thực hệ thống AI. Vui lòng liên hệ admin.";
        } else if (statusCode === 429) {
          userFriendlyMessage =
            "Hệ thống AI đang quá tải. Vui lòng thử lại sau 1-2 phút.";
        } else if (statusCode === 500 || statusCode >= 500) {
          userFriendlyMessage =
            "Hệ thống AI gặp lỗi nội bộ. Vui lòng thử lại sau ít phút.";
        }

        const technicalDetails = `AI generation failed after ${maxRetries} attempts: ${
          error.message || "Unknown error"
        }. Status: ${statusCode || "N/A"}`;

        console.error(`❌ FINAL ERROR: ${technicalDetails}`);

        // Throw error với thông báo thân thiện người dùng
        const finalError = new Error(userFriendlyMessage);
        finalError.technicalDetails = technicalDetails;
        finalError.statusCode = statusCode || 500;
        finalError.isUserFriendly = true;
        throw finalError;
      }

      // Xử lý lỗi timeout hoặc network
      if ((isTimeout || isNetworkError) && attempt < maxRetries) {
        // Ngay lập tức chuyển sang model nhẹ nhất có thể
        console.log(
          `⚠️ ${
            isTimeout ? "Timeout" : "Network error"
          } detected, switching to fallback model...`
        );

        // Chuyển sang fallback model cho lần thử tiếp theo
        console.log(
          `🔄 Switching to fallback model ${FALLBACK_MODEL_ID} for next attempt`
        );
      }

      // Exponential backoff với jitter - tăng thời gian chờ
      const delayMs = Math.min(5000, attempt * 1500 + Math.random() * 1000);
      console.log(
        `⏳ Retrying in ${delayMs}ms with ${
          attempt < maxRetries / 2
            ? "another attempt using same model"
            : "fallback model"
        }...`
      );
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
- TỐI ĐA 10 câu hỏi trong mảng questions, KHÔNG ĐƯỢC vượt quá 10 câu
- Bắt đầu ngay bằng {, kết thúc bằng }
- Chỉ sử dụng dấu nháy kép " cho chuỗi
- Không có dấu phẩy ở cuối các phần tử
- Chỉ trả về JSON thuần túy, không có giải thích hoặc markdown

GENERATE JSON NOW:`;

    console.log("🎯 Generating JSON content via OpenRouter API...");
    console.log(`📝 Prompt length: ${jsonPrompt.length} characters`);

    let response;
    try {
      response = await generateContent(jsonPrompt, 3); // Tăng số lần thử lên 3

      if (!response) {
        console.error("❌ No response received from generateContent");
        throw new Error("No response received from AI generation service");
      }

      if (!response.success) {
        console.error(
          `❌ Generation unsuccessful: ${response.message || "Unknown error"}`
        );
        throw new Error(
          response.message ||
            "Unsuccessful AI generation with no specific error message"
        );
      }

      if (!response.content) {
        console.error("❌ Empty content in response", response);
        throw new Error("AI returned empty content");
      }
    } catch (genError) {
      console.error("❌ Error during content generation:", genError.message);
      throw genError; // Re-throw to be caught by the outer catch block
    }

    const result = response.content;
    const usedModel = response.model || QWEN_MODEL_ID;

    console.log(`🔧 Cleaning and parsing JSON from ${usedModel}...`);
    console.log(`📝 Raw content length: ${result.length} characters`);

    // Log a preview of the raw content for debugging
    if (result.length > 0) {
      console.log(
        `📄 Content preview: ${result.substring(
          0,
          Math.min(200, result.length)
        )}...`
      );
    } else {
      console.error("❌ Empty content received from AI");
      throw new Error("Empty content received from AI");
    }

    const cleanedJson = cleanAndRepairJson(result);
    console.log(`📝 Cleaned JSON length: ${cleanedJson.length} characters`);

    try {
      const parsedJson = JSON.parse(cleanedJson);
      console.log(`✅ JSON parsing successful from ${usedModel}`);

      // Kiểm tra cấu trúc JSON có đúng không
      if (!parsedJson) {
        throw new Error("JSON parsing resulted in null or undefined object");
      }

      if (!parsedJson.title) {
        console.warn("⚠️ Missing title in JSON - adding default title");
        parsedJson.title = "Bài học về triết học Mác-Lênin";
      }

      if (
        !parsedJson.questions ||
        !Array.isArray(parsedJson.questions) ||
        parsedJson.questions.length === 0
      ) {
        throw new Error(
          "Invalid JSON structure - missing questions array or empty array"
        );
      }

      // Kiểm tra và sửa số lượng câu hỏi nếu vượt quá 10
      if (parsedJson.questions.length > 10) {
        console.log(
          `⚠️ Question count exceeds limit: ${parsedJson.questions.length}/10. Truncating to 10 questions.`
        );
        // Chỉ giữ lại 10 câu hỏi đầu tiên
        parsedJson.questions = parsedJson.questions.slice(0, 10);
      }

      // Validate each question has the required structure
      const validQuestions = parsedJson.questions.filter((q) => {
        return (
          q.type &&
          q.content &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          typeof q.correctAnswer === "number" &&
          q.explanation
        );
      });

      if (validQuestions.length < parsedJson.questions.length) {
        console.warn(
          `⚠️ Some questions have invalid structure. Keeping ${validQuestions.length}/${parsedJson.questions.length} valid questions.`
        );
        parsedJson.questions = validQuestions;
      }

      if (validQuestions.length === 0) {
        throw new Error("No valid questions found in the generated content");
      }

      console.log(
        `✅ Final JSON structure valid with ${parsedJson.questions.length} questions`
      );
      return parsedJson;
    } catch (parseError) {
      console.error("❌ JSON parsing error:", parseError.message);
      console.error("Raw response length:", result.length);
      console.error(
        "Cleaned JSON preview:",
        cleanedJson.substring(0, 200) + "..."
      );

      // Attempt to fix common JSON issues
      try {
        console.log("🔄 Attempting additional JSON repair...");
        const additionalFixedJson = cleanedJson
          .replace(/\\n/g, " ")
          .replace(/\s+/g, " ")
          .replace(/"\s*:\s*"/g, '":"')
          .replace(/"\s*:\s*\[/g, '":[')
          .replace(/"\s*:\s*{/g, '":{');

        const reparsedJson = JSON.parse(additionalFixedJson);
        console.log("✅ Additional JSON repair successful");

        if (
          reparsedJson.questions &&
          Array.isArray(reparsedJson.questions) &&
          reparsedJson.questions.length > 0
        ) {
          console.log(
            `✅ Recovered ${reparsedJson.questions.length} questions after repair`
          );

          // Kiểm tra và sửa số lượng câu hỏi nếu vượt quá 10
          if (reparsedJson.questions.length > 10) {
            reparsedJson.questions = reparsedJson.questions.slice(0, 10);
          }

          return reparsedJson;
        }
      } catch (repairError) {
        console.error("❌ Additional JSON repair failed:", repairError.message);
      }

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
    console.error("❌ Error stack:", error.stack);

    // Tạo thông báo lỗi thân thiện với người dùng
    let userFriendlyMessage = "Không thể tạo bài học do lỗi hệ thống AI";

    if (error.isUserFriendly) {
      // Nếu lỗi đã được xử lý từ generateContent
      userFriendlyMessage = error.message;
    } else if (error.message.includes("timeout")) {
      userFriendlyMessage =
        "Hệ thống AI mất quá nhiều thời gian để phản hồi. Vui lòng thử lại sau ít phút.";
    } else if (
      error.message.includes("network") ||
      error.message.includes("ECONNREFUSED")
    ) {
      userFriendlyMessage =
        "Lỗi kết nối với hệ thống AI. Vui lòng kiểm tra kết nối internet.";
    } else if (error.message.includes("OpenRouter API key")) {
      userFriendlyMessage = "Lỗi cấu hình hệ thống AI. Vui lòng liên hệ admin.";
    }

    // Log detailed error information for debugging
    const errorDetails = {
      message: error.message,
      userMessage: userFriendlyMessage,
      type: error.name,
      statusCode: error.statusCode || 500,
      stack: error.stack
        ? error.stack.split("\n").slice(0, 5).join("\n")
        : "No stack trace",
      timestamp: new Date().toISOString(),
    };

    console.error("❌ DETAILED ERROR INFO:", JSON.stringify(errorDetails));

    // Ném lỗi với thông báo thân thiện thay vì trả về fallback JSON
    const friendlyError = new Error(userFriendlyMessage);
    friendlyError.statusCode = error.statusCode || 500;
    friendlyError.technicalDetails = error.message;
    throw friendlyError;
  }
};

/**
 * Kiểm tra kết nối với OpenRouter API và các model đã cấu hình
 */
const validateConnection = async () => {
  try {
    console.log("🔍 Testing OpenRouter API connection...");

    // Lấy danh sách các model có sẵn từ OpenRouter API
    console.log("📊 Fetching available models from OpenRouter...");
    let availableModels = [];
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.SITE_URL || "https://marx-edu.netlify.app",
        },
      });

      if (response.data && response.data.data) {
        availableModels = response.data.data.map((model) => model.id);
        console.log(`✅ Found ${availableModels.length} available models`);

        // Kiểm tra xem model chính và fallback có sẵn không
        const primaryAvailable = availableModels.includes(QWEN_MODEL_ID);
        const fallbackAvailable = availableModels.includes(FALLBACK_MODEL_ID);

        console.log(
          `Primary model ${QWEN_MODEL_ID}: ${
            primaryAvailable ? "✅ Available" : "❌ Not available"
          }`
        );
        console.log(
          `Fallback model ${FALLBACK_MODEL_ID}: ${
            fallbackAvailable ? "✅ Available" : "❌ Not available"
          }`
        );

        // Kiểm tra và gợi ý các model thay thế nếu cần
        if (!primaryAvailable) {
          const qwenModels = availableModels.filter((m) =>
            m.startsWith("qwen/")
          );
          if (qwenModels.length > 0) {
            console.log("🔄 Available Qwen models you could use instead:");
            qwenModels.slice(0, 5).forEach((m) => console.log(`   - ${m}`));
          }
        }

        if (!fallbackAvailable) {
          const googleModels = availableModels.filter((m) =>
            m.startsWith("google/")
          );
          if (googleModels.length > 0) {
            console.log("🔄 Available Google models you could use instead:");
            googleModels.slice(0, 5).forEach((m) => console.log(`   - ${m}`));
          }

          // Find free models as alternatives
          const freeModels = availableModels.filter((m) => m.includes(":free"));
          if (freeModels.length > 0) {
            console.log("🔄 Available free models you could use instead:");
            freeModels.slice(0, 5).forEach((m) => console.log(`   - ${m}`));
          }
        }
      }
    } catch (modelError) {
      console.warn("⚠️ Could not fetch model list:", modelError.message);
    }

    // Sử dụng prompt đơn giản và ngắn để kiểm tra kết nối với model
    const testPrompt = "Trả lời ngắn gọn (1-2 câu): Triết học Mác-LêNin là gì?";

    // Thử với model chính trước
    console.log(`🚀 Testing with primary model: ${QWEN_MODEL_ID}`);
    try {
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: QWEN_MODEL_ID,
          messages: [
            {
              role: "system",
              content: "Bạn là trợ lý AI chuyên về triết học Mác-Lênin.",
            },
            {
              role: "user",
              content: testPrompt,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.SITE_URL || "https://marx-edu.netlify.app",
          },
          timeout: 60000, // Tăng timeout lên 60 giây cho validation
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        console.log(`✅ Connection successful with model: ${QWEN_MODEL_ID}`);
        return {
          success: true,
          message: `OpenRouter API connection validated successfully using ${QWEN_MODEL_ID}`,
          model: QWEN_MODEL_ID,
          availableModels:
            availableModels.length > 0 ? availableModels : undefined,
          response: content.substring(0, 100) + "...",
        };
      }
    } catch (primaryError) {
      console.error(
        `❌ Primary model ${QWEN_MODEL_ID} failed: ${primaryError.message}`
      );
      console.log(`🔄 Trying fallback model: ${FALLBACK_MODEL_ID}`);

      try {
        // Thử với fallback model
        const fallbackResponse = await axios.post(
          OPENROUTER_API_URL,
          {
            model: FALLBACK_MODEL_ID,
            messages: [
              {
                role: "system",
                content: "Bạn là trợ lý AI chuyên về triết học Mác-Lênin.",
              },
              {
                role: "user",
                content: testPrompt,
              },
            ],
            max_tokens: 100,
            temperature: 0.7,
            stream: false,
          },
          {
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer":
                process.env.SITE_URL || "https://marx-edu.netlify.app",
            },
            timeout: 60000, // Tăng timeout lên 60 giây cho validation
          }
        );

        if (
          fallbackResponse.data &&
          fallbackResponse.data.choices &&
          fallbackResponse.data.choices[0]
        ) {
          const content = fallbackResponse.data.choices[0].message.content;
          console.log(
            `✅ Connection successful with fallback model: ${FALLBACK_MODEL_ID}`
          );
          return {
            success: true,
            message: `OpenRouter API connection validated successfully using ${FALLBACK_MODEL_ID}`,
            model: FALLBACK_MODEL_ID,
            availableModels:
              availableModels.length > 0 ? availableModels : undefined,
            response: content.substring(0, 100) + "...",
          };
        }
      } catch (fallbackError) {
        console.error(
          `❌ Fallback model ${FALLBACK_MODEL_ID} also failed: ${fallbackError.message}`
        );
        throw new Error(
          `Both primary and fallback models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        );
      }
    }

    throw new Error("Invalid response from OpenRouter API");
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
