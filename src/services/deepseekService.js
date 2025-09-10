import axios from 'axios';

// DeepSeek via OpenRouter configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = 'deepseek/deepseek-r1-distill-llama-70b:free'; // R1 distilled model
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Sleep function for retry delays
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean and repair malformed JSON responses
 * @param {string} jsonText - Raw JSON text to clean
 * @returns {string} Cleaned JSON text
 */
const cleanAndRepairJson = (jsonText) => {
    console.log('🔧 Starting JSON repair...');

    try {
        // First, try to parse as-is
        JSON.parse(jsonText);
        console.log('✅ JSON is already valid');
        return jsonText;
    } catch (error) {
        console.log('⚠️ JSON needs repair:', error.message);
    }

    let cleaned = jsonText;

    // Step 1: Remove problematic characters
    cleaned = cleaned
        .replace(/[\r\n\t]/g, ' ')  // Replace line breaks and tabs with spaces
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();

    // Step 2: Handle truncated responses
    if (!cleaned.endsWith('}') && !cleaned.endsWith(']') && !cleaned.endsWith('"')) {
        console.log('🔧 Detected truncated response');

        // Find the last complete structure
        let lastCompleteIndex = -1;
        let braceCount = 0;
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
                        lastCompleteIndex = i;
                    }
                }
            }
        }

        if (lastCompleteIndex > 0) {
            cleaned = cleaned.substring(0, lastCompleteIndex + 1);
            console.log('🔧 Truncated to last complete object');
        } else if (braceCount > 0) {
            // Add missing closing braces
            cleaned += '}'.repeat(braceCount);
            console.log(`🔧 Added ${braceCount} missing closing braces`);
        }
    }

    // Step 3: Final validation attempt
    try {
        JSON.parse(cleaned);
        console.log('✅ JSON repair successful');
        return cleaned;
    } catch (finalError) {
        console.log('❌ JSON repair failed:', finalError.message);
        // Return original if repair fails
        return jsonText;
    }
};

/**
 * Generate content using DeepSeek V3.1 via OpenRouter
 * @param {string} prompt - The prompt to send to DeepSeek
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Object} Response with generated content
 */
const generateContent = async (prompt, maxRetries = 2) => { // Reduced retries for speed
    console.log(`🤖 Using DeepSeek V3.1 via OpenRouter`);
    console.log(`🔑 API Key status: ${DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 10)}...` : 'MISSING'}`);
    console.log(`🔗 API URL: ${OPENROUTER_BASE_URL}`);

    // Check if should skip DeepSeek API
    if (process.env.SKIP_DEEPSEEK === 'true') {
        console.log('🚫 Skipping DeepSeek API (SKIP_DEEPSEEK=true)');
        return {
            success: false,
            message: 'DeepSeek API skipped - using fallback',
            data: null,
            error: {
                message: 'DeepSeek API disabled',
                code: 'DEEPSEEK_DISABLED',
                model: DEEPSEEK_MODEL,
                totalAttempts: 0
            }
        };
    }

    // Validate API key
    if (!DEEPSEEK_API_KEY) {
        return {
            success: false,
            message: 'DEEPSEEK_API_KEY is missing from environment variables.',
            data: null,
            error: {
                message: 'Missing API key',
                code: 'MISSING_API_KEY',
                model: DEEPSEEK_MODEL,
                totalAttempts: 0
            }
        };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const requestBody = {
                model: DEEPSEEK_MODEL,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000, // Increased for R1 model to avoid truncation
                top_p: 0.9, // Slightly more focused
                frequency_penalty: 0,
                presence_penalty: 0
            };

            console.log(`🔄 DeepSeek attempt ${attempt}/${maxRetries}`);

            const response = await axios.post(OPENROUTER_BASE_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://quizlingo.com',
                    'X-Title': 'QuizLingo AI Learning'
                },
                timeout: 25000 // 25 seconds timeout (optimized for speed)
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                const generatedText = response.data.choices[0].message.content;
                console.log(`✅ DeepSeek success on attempt ${attempt}`);

                return {
                    success: true,
                    data: generatedText,
                    message: 'Content generated successfully',
                    model: DEEPSEEK_MODEL,
                    attempt,
                    usage: response.data.usage || {}
                };
            } else {
                throw new Error('Invalid response structure from DeepSeek API');
            }

        } catch (error) {
            const isRetryableError =
                error.response?.status === 503 || // Service overloaded
                error.response?.status === 429 || // Rate limited  
                error.response?.status === 500 || // Internal server error
                error.response?.status === 502 || // Bad gateway
                error.code === 'ECONNRESET' ||   // Connection reset
                error.code === 'ETIMEDOUT' ||    // Timeout
                error.code === 'ECONNABORTED';   // Request timeout

            console.error(`❌ DeepSeek Error (attempt ${attempt}/${maxRetries}):`, {
                message: error.message,
                status: error.response?.status,
                code: error.code,
                retryable: isRetryableError,
                data: error.response?.data
            });

            // Nếu là attempt cuối hoặc lỗi không thể retry
            if (attempt === maxRetries || !isRetryableError) {
                return {
                    success: false,
                    message: `DeepSeek API failed after ${attempt} attempts: ${error.message}`,
                    data: null,
                    error: {
                        message: error.message,
                        status: error.response?.status,
                        code: error.code,
                        model: DEEPSEEK_MODEL,
                        totalAttempts: attempt,
                        responseData: error.response?.data
                    }
                };
            }

            // Reduced backoff delay for speed
            const delayMs = attempt * 500; // 0.5s, 1s, 1.5s (faster than exponential)
            console.log(`⏳ Retrying DeepSeek in ${delayMs}ms...`);
            await sleep(delayMs);
        }
    }
};

/**
 * Generate JSON content using DeepSeek API  
 * @param {string} prompt - The prompt to send to DeepSeek
 * @returns {Object} Response with parsed JSON content
 */
const generateJsonContent = async (prompt) => {
    // Enhanced JSON prompt for R1 model
    const jsonPrompt = `${prompt}

CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
1. Respond ONLY with valid, complete JSON
2. NO markdown, NO explanations, NO extra text
3. Ensure all strings are properly quoted and escaped
4. Complete the entire JSON structure before stopping
5. Validate JSON syntax before responding

Format: {"key": "value"} - pure JSON only.`;

    const result = await generateContent(jsonPrompt, 2); // Reduced retries for speed

    if (!result.success) {
        return result;
    }

    try {
        // Clean và parse JSON response
        let jsonText = result.data.trim();
        console.log('🔍 Raw DeepSeek response length:', jsonText.length);

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        // Advanced JSON cleaning and repair
        jsonText = cleanAndRepairJson(jsonText);

        console.log('🧹 Cleaned JSON length:', jsonText.length);
        const parsedData = JSON.parse(jsonText);

        return {
            success: true,
            data: parsedData,
            message: 'JSON content generated and parsed successfully',
            model: result.model,
            attempt: result.attempt,
            usage: result.usage
        };
    } catch (parseError) {
        console.error('❌ DeepSeek JSON parsing error:', parseError.message);
        console.error('Raw response:', result.data);

        return {
            success: false,
            message: 'Failed to parse JSON from DeepSeek response',
            data: null,
            error: {
                message: parseError.message,
                rawResponse: result.data,
                model: result.model
            }
        };
    }
};

/**
 * Validate DeepSeek API connection
 * @returns {Object} Validation result
 */
const validateConnection = async () => {
    try {
        console.log('🔍 Testing DeepSeek API connection...');
        console.log(`🔑 Using API Key: ${DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 10)}...` : 'MISSING'}`);
        console.log(`🔗 API URL: ${OPENROUTER_BASE_URL}`);
        console.log(`🤖 Model: ${DEEPSEEK_MODEL}`);

        const testPrompt = 'Test connection. Respond with: "DeepSeek connection successful"';

        const result = await generateContent(testPrompt, 1); // Only 1 attempt for connection test

        if (result.success) {
            console.log('✅ DeepSeek API connection successful');
            return {
                success: true,
                connected: true,
                message: 'DeepSeek API connection successful',
                model: result.model,
                response: result.data,
                usage: result.usage,
                config: {
                    model: DEEPSEEK_MODEL,
                    baseUrl: OPENROUTER_BASE_URL,
                    apiKeyStatus: DEEPSEEK_API_KEY ? 'Present' : 'Missing',
                    source: 'OpenRouter'
                }
            };
        } else {
            console.error('❌ DeepSeek API connection failed:', result.message);
            return {
                success: false,
                connected: false,
                message: `DeepSeek API connection failed: ${result.message}`,
                error: result.error,
                config: {
                    model: DEEPSEEK_MODEL,
                    baseUrl: OPENROUTER_BASE_URL,
                    apiKeyStatus: DEEPSEEK_API_KEY ? 'Present' : 'Missing',
                    source: 'OpenRouter'
                }
            };
        }
    } catch (error) {
        console.error('❌ DeepSeek API connection error:', error);
        return {
            success: false,
            connected: false,
            message: `DeepSeek API connection error: ${error.message}`,
            error: {
                message: error.message,
                code: error.code,
                model: DEEPSEEK_MODEL
            },
            config: {
                model: DEEPSEEK_MODEL,
                baseUrl: OPENROUTER_BASE_URL,
                apiKeyStatus: DEEPSEEK_API_KEY ? 'Present' : 'Missing',
                source: 'OpenRouter'
            }
        };
    }
};

export default {
    generateContent,
    generateJsonContent,
    validateConnection
};
