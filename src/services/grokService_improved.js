import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GROK_MODEL = "x-ai/grok-4-fast:free";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Enhanced JSON cleaning and repair with better validation
 */
const cleanAndRepairJson = (jsonText) => {
  try {
    console.log("🔧 Original response preview:", jsonText.substring(0, 200));

    // Step 1: Loại bỏ markdown code blocks nếu có
    let cleaned = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // Step 2: Tìm JSON object đầu tiên với better pattern matching
    const jsonStart = cleaned.search(/\s*\{/);
    if (jsonStart === -1) {
      throw new Error("No JSON object found in response");
    }

    cleaned = cleaned.substring(jsonStart);

    // Step 3: Enhanced JSON structure validation and repair
    let braceCount = 0;
    let bracketCount = 0;
    let lastValidIndex = -1;
    let inString = false;
    let escapeNext = false;
    let hasValidQuestions = false;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            lastValidIndex = i;
            break;
          }
        } else if (char === "[") {
          bracketCount++;
        } else if (char === "]") {
          bracketCount--;
        }
      }

      // Check for questions array
      if (
        !hasValidQuestions &&
        cleaned.substring(Math.max(0, i - 10), i + 10).includes('"questions"')
      ) {
        hasValidQuestions = true;
      }
    }

    // Step 4: Validate and repair structure
    if (lastValidIndex !== -1) {
      cleaned = cleaned.substring(0, lastValidIndex + 1);
    } else {
      // More intelligent brace repair
      const openBraces = (cleaned.match(/\{/g) || []).length;
      const closeBraces = (cleaned.match(/\}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;

      console.log(
        `🔧 Structure analysis: {${openBraces}/${closeBraces}} [${openBrackets}/${closeBrackets}]`
      );

      // Add missing brackets first
      const missingBrackets = openBrackets - closeBrackets;
      for (let i = 0; i < missingBrackets; i++) {
        cleaned += "]";
      }

      // Add missing braces
      const missingBraces = openBraces - closeBraces;
      for (let i = 0; i < missingBraces; i++) {
        cleaned += "}";
      }
    }

    // Step 5: Enhanced cleaning with philosophy-specific fixes
    cleaned = cleaned
      // Remove trailing commas before closing brackets/braces
      .replace(/,(\s*[}\]])/g, "$1")
      // Fix malformed correctAnswer field
      .replace(/"correctAnswer":\s*([0-9]+)\s*,/g, '"correctAnswer":"$1",')
      // Fix missing quotes around string values
      .replace(/:\s*([A-Za-z][^,}\]]*[^",}\]])\s*([,}\]])/g, ':"$1"$2')
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .replace(/{\s+/g, "{")
      .replace(/\s+}/g, "}")
      .replace(/\[\s+/g, "[")
      .replace(/\s+\]/g, "]")
      .replace(/:\s+/g, ":")
      .replace(/,\s+/g, ",");

    // Step 6: Validate basic structure requirements
    if (!cleaned.includes('"questions"') || !cleaned.includes('"title"')) {
      throw new Error("Missing required fields: title or questions");
    }

    // Step 7: Additional validation for philosophy content
    const questionsMatch = cleaned.match(/"questions"\s*:\s*\[(.*?)\]/s);
    if (!questionsMatch) {
      throw new Error("Invalid questions array structure");
    }

    console.log("🔧 Cleaned JSON preview:", cleaned.substring(0, 200));

    // Step 8: Pre-parse validation
    try {
      const testParse = JSON.parse(cleaned);
      if (!testParse.questions || !Array.isArray(testParse.questions)) {
        throw new Error("Questions field is not a valid array");
      }
      if (testParse.questions.length === 0) {
        throw new Error("No questions found in the array");
      }
    } catch (preParseError) {
      console.warn("⚠️ Pre-parse validation failed:", preParseError.message);
      // Continue with cleaned JSON, let the main parser handle it
    }

    return cleaned;
  } catch (error) {
    console.error("❌ JSON repair failed:", error.message);
    console.error("❌ Input preview:", jsonText.substring(0, 300));
    throw new Error(`JSON repair failed: ${error.message}`);
  }
};

/**
 * Enhanced content generation with better error handling
 */
const generateContent = async (prompt, maxRetries = 3) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in environment variables"
    );
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🤖 Grok4 generation attempt ${attempt}/${maxRetries}...`);

      const response = await axios.post(
        OPENROUTER_BASE_URL,
        {
          model: GROK_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are an expert in Vietnamese Marxist-Leninist philosophy. Always respond in Vietnamese. Focus strictly on philosophy, not economics or politics.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 4000, // Increased for more complete responses
          temperature: 0.3, // Reduced for more consistent results
          top_p: 0.9,
          stream: false,
          response_format: { type: "json_object" }, // Request JSON format when possible
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.SITE_URL || "https://marx-edu.netlify.app",
            "X-Title":
              process.env.SITE_NAME || "Marx-Edu - Marxist Philosophy Learning",
          },
          timeout: 45000, // Increased timeout for complex questions
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;

        // Validate content length and quality
        if (!content || content.trim().length < 50) {
          throw new Error("Response too short or empty");
        }

        // Check for philosophy-related content
        const philosophyKeywords = [
          "triết",
          "mác",
          "lenin",
          "duy vật",
          "biện chứng",
          "nhận thức",
        ];
        const hasPhilosophyContent = philosophyKeywords.some((keyword) =>
          content.toLowerCase().includes(keyword)
        );

        if (!hasPhilosophyContent) {
          console.warn("⚠️ Response may not contain philosophy content");
        }

        console.log(`✅ Grok4 generation successful (attempt ${attempt})`);
        return content;
      } else {
        throw new Error("Invalid response structure from Grok4");
      }
    } catch (error) {
      console.error(
        `❌ Grok4 generation attempt ${attempt} failed:`,
        error.message
      );

      if (attempt === maxRetries) {
        throw new Error(
          `Grok4 generation failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Exponential backoff với jitter
      const delayMs = Math.min(10000, attempt * 2000 + Math.random() * 1000);
      console.log(`⏳ Retrying Grok4 in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/**
 * Enhanced JSON content generation with strict validation
 */
const generateJsonContent = async (prompt) => {
  try {
    // Enhanced prompt với stricter JSON requirements
    const jsonPrompt = `${prompt}

🚨 CRITICAL JSON FORMATTING REQUIREMENTS - READ CAREFULLY:

1. RETURN PURE JSON ONLY - NO markdown blocks, NO explanations, NO extra text
2. START immediately with { and END with }
3. Use ONLY double quotes " for all strings
4. NO trailing commas anywhere in the JSON
5. Escape special characters: \" for quotes, \\\\ for backslashes
6. EVERY correctAnswer must be ONE of the 4 options EXACTLY
7. Format options as: ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"]
8. correctAnswer must match exactly: "A. Option 1" (not just "A")

MANDATORY STRUCTURE:
{
  "title": "Lesson title in Vietnamese",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "Question in Vietnamese about Marxist philosophy",
      "options": ["A. Correct answer", "B. Wrong answer", "C. Wrong answer", "D. Wrong answer"],
      "correctAnswer": "A. Correct answer",
      "score": 100,
      "timeLimit": 30
    }
  ]
}

VALIDATION CHECKLIST BEFORE RESPONDING:
✓ Exactly 10 questions about Vietnamese Marxist philosophy
✓ Each question has exactly 4 options starting with A., B., C., D.
✓ correctAnswer matches one option exactly
✓ Answer distribution: ~2-3 A, ~2-3 B, ~2-3 C, ~2-3 D
✓ Valid JSON syntax (no trailing commas, proper quotes)
✓ All content in Vietnamese

GENERATE NOW:`;

    console.log("🎯 Generating enhanced JSON content with Grok4...");
    const result = await generateContent(jsonPrompt, 3);

    if (!result) {
      throw new Error("Empty response from Grok4");
    }

    // Enhanced validation before parsing
    if (!result.includes('"questions"') || !result.includes('"title"')) {
      throw new Error("Response missing required JSON structure");
    }

    console.log("🔧 Cleaning and parsing JSON from Grok4...");
    const cleanedJson = cleanAndRepairJson(result);

    try {
      const parsedJson = JSON.parse(cleanedJson);

      // Post-parse validation
      if (!parsedJson.questions || !Array.isArray(parsedJson.questions)) {
        throw new Error("Invalid questions array");
      }

      if (parsedJson.questions.length !== 10) {
        console.warn(
          `⚠️ Expected 10 questions, got ${parsedJson.questions.length}`
        );
      }

      // Validate each question structure
      parsedJson.questions.forEach((q, index) => {
        if (
          !q.content ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          !q.correctAnswer
        ) {
          throw new Error(`Question ${index + 1} has invalid structure`);
        }

        // Check if correctAnswer exists in options
        const hasMatchingOption = q.options.some(
          (option) => option === q.correctAnswer
        );
        if (!hasMatchingOption) {
          console.warn(
            `⚠️ Question ${index + 1}: correctAnswer "${
              q.correctAnswer
            }" not found in options`
          );
        }
      });

      console.log("✅ Grok4 JSON parsing and validation successful");
      return parsedJson;
    } catch (parseError) {
      console.error("❌ Grok4 JSON parsing error:", parseError.message);
      console.error("Raw response length:", result.length);
      console.error(
        "Cleaned JSON preview:",
        cleanedJson.substring(0, 300) + "..."
      );

      // Try one more time with a simpler repair
      try {
        const simplifiedJson = result
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .replace(/^[^{]*/, "")
          .replace(/[^}]*$/, "}");

        const lastAttempt = JSON.parse(simplifiedJson);
        console.log("✅ Backup parsing successful");
        return lastAttempt;
      } catch (backupError) {
        throw new Error(
          `All JSON parsing attempts failed: ${parseError.message}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Grok4 JSON generation failed:", error.message);
    throw error;
  }
};

/**
 * Enhanced connection validation
 */
const validateConnection = async () => {
  try {
    console.log("🔍 Testing Grok4 connection...");

    const testPrompt = `Trả lời ngắn gọn trong 1 câu: Triết học Mác-LêNin nghiên cứu về điều gì?

Yêu cầu: Chỉ trả lời về TRIẾT HỌC, không về kinh tế.`;

    const result = await generateContent(testPrompt, 1);

    if (result && result.length > 10) {
      // Check if response is about philosophy
      const isPhilosophyResponse =
        result.toLowerCase().includes("triết") ||
        result.toLowerCase().includes("duy vật") ||
        result.toLowerCase().includes("biện chứng");

      console.log("✅ Grok4 connection successful");
      return {
        success: true,
        message: "Grok4 connection validated successfully",
        response: result.substring(0, 100) + "...",
        isPhilosophyContent: isPhilosophyResponse,
      };
    } else {
      throw new Error("Invalid response from Grok4");
    }
  } catch (error) {
    console.error("❌ Grok4 connection failed:", error.message);
    return {
      success: false,
      message: `Grok4 connection failed: ${error.message}`,
      error: error.message,
    };
  }
};

export default {
  generateContent,
  generateJsonContent,
  validateConnection,
  cleanAndRepairJson, // Export for testing
};
