import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GROK_MODEL = 'x-ai/grok-4-fast:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Làm sạch và sửa chữa JSON bị lỗi từ Grok4
 */
const cleanAndRepairJson = (jsonText) => {
    try {
        console.log('🔧 Original response preview:', jsonText.substring(0, 200));

        // Step 1: Loại bỏ markdown code blocks nếu có
        let cleaned = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Step 2: Tìm JSON object đầu tiên
        const jsonStart = cleaned.indexOf('{');
        if (jsonStart === -1) {
            throw new Error('No JSON object found in response');
        }

        cleaned = cleaned.substring(jsonStart);

        // Step 3: Tìm vị trí kết thúc JSON hợp lệ
        let braceCount = 0;
        let lastValidIndex = -1;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        lastValidIndex = i;
                        break;
                    }
                }
            }
        }

        // Step 4: Cắt JSON tại vị trí hợp lệ hoặc sửa chữa
        if (lastValidIndex !== -1) {
            cleaned = cleaned.substring(0, lastValidIndex + 1);
        } else {
            // Thêm các dấu } còn thiếu
            const openBraces = (cleaned.match(/{/g) || []).length;
            const closeBraces = (cleaned.match(/}/g) || []).length;
            const missingBraces = openBraces - closeBraces;

            console.log(`🔧 Adding ${missingBraces} missing closing braces`);
            for (let i = 0; i < missingBraces; i++) {
                cleaned += '}';
            }
        }

        // Step 5: Làm sạch và chuẩn hóa
        cleaned = cleaned
            // Xóa dấu phẩy thừa trước } và ]
            .replace(/,(\s*[}\]])/g, '$1')
            // Chuẩn hóa spaces
            .replace(/\s+/g, ' ')
            // Xóa spaces không cần thiết trong JSON
            .replace(/{\s+/g, '{')
            .replace(/\s+}/g, '}')
            .replace(/\[\s+/g, '[')
            .replace(/\s+\]/g, ']')
            .replace(/:\s+/g, ':')
            .replace(/,\s+/g, ',');

        console.log('🔧 Cleaned JSON preview:', cleaned.substring(0, 200));
        return cleaned;

    } catch (error) {
        console.error('❌ JSON repair failed:', error.message);
        console.error('❌ Input preview:', jsonText.substring(0, 300));
        throw new Error(`JSON repair failed: ${error.message}`);
    }
};

/**
 * Tạo nội dung với Grok4
 */
const generateContent = async (prompt, maxRetries = 2) => {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🤖 Grok4 generation attempt ${attempt}/${maxRetries}...`);

            const response = await axios.post(OPENROUTER_BASE_URL, {
                model: GROK_MODEL,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.7,
                top_p: 0.9,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.SITE_URL || 'https://marx-edu.netlify.app',
                    'X-Title': process.env.SITE_NAME || 'Marx-Edu - Marxist Philosophy Learning'
                },
                timeout: 30000 // 30 seconds timeout
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                const content = response.data.choices[0].message.content;
                console.log(`✅ Grok4 generation successful (attempt ${attempt})`);
                return content;
            } else {
                throw new Error('Invalid response structure from Grok4');
            }

        } catch (error) {
            console.error(`❌ Grok4 generation attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                throw new Error(`Grok4 generation failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Exponential backoff với jitter
            const delayMs = attempt * 1000 + Math.random() * 1000;
            console.log(`⏳ Retrying Grok4 in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};

/**
 * Tạo nội dung JSON với Grok4
 */
const generateJsonContent = async (prompt) => {
    try {
        // Tăng cường prompt để Grok4 tạo JSON hợp lệ
        const jsonPrompt = `${prompt}

🚨 CRITICAL JSON FORMATTING RULES:
1. Return ONLY pure JSON - NO markdown, NO explanations
2. Start immediately with { and end with }
3. Use ONLY double quotes " for strings
4. NO trailing commas anywhere
5. Escape special characters properly: \" \\ \n \t
6. Close ALL brackets and braces correctly
7. Focus ONLY on Vietnamese Marxist-Leninist philosophy
8. Each question about "triết học Mác-Lê-Nin" (NOT economics)

EXAMPLE FORMAT:
{"title":"Bài học","questions":[{"type":"multiple_choice","content":"Câu hỏi?","options":["A","B","C","D"],"correctAnswer":0,"explanation":"Giải thích"}]}

NOW GENERATE VALID JSON:`;

        console.log('🎯 Generating JSON content with Grok4...');
        const result = await generateContent(jsonPrompt, 2);

        if (!result) {
            throw new Error('Empty response from Grok4');
        }

        console.log('🔧 Cleaning and parsing JSON from Grok4...');
        const cleanedJson = cleanAndRepairJson(result);

        try {
            const parsedJson = JSON.parse(cleanedJson);
            console.log('✅ Grok4 JSON parsing successful');
            return parsedJson;
        } catch (parseError) {
            console.error('❌ Grok4 JSON parsing error:', parseError.message);
            console.error('Raw response length:', result.length);
            console.error('Cleaned JSON preview:', cleanedJson.substring(0, 200) + '...');
            throw new Error(`Grok4 JSON parsing error: ${parseError.message}`);
        }

    } catch (error) {
        console.error('❌ Grok4 JSON generation failed:', error.message);
        throw error;
    }
};

/**
 * Kiểm tra kết nối với Grok4
 */
const validateConnection = async () => {
    try {
        console.log('🔍 Testing Grok4 connection...');

        const testPrompt = "Hãy trả lời ngắn gọn: Triết học Mác-Lê-Nin là gì?";
        const result = await generateContent(testPrompt, 1);

        if (result && result.length > 10) {
            console.log('✅ Grok4 connection successful');
            return {
                success: true,
                message: 'Grok4 connection validated successfully',
                response: result.substring(0, 100) + '...'
            };
        } else {
            throw new Error('Invalid response from Grok4');
        }

    } catch (error) {
        console.error('❌ Grok4 connection failed:', error.message);
        return {
            success: false,
            message: `Grok4 connection failed: ${error.message}`,
            error: error.message
        };
    }
};

export default {
    generateContent,
    generateJsonContent,
    validateConnection
};
