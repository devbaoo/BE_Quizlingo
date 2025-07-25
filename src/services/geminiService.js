import axios from 'axios';

// Sử dụng environment variables với fallback values
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL; // Try gemini-pro instead
const GEMINI_BASE_URL = process.env.GEMINI_API_URL;

// Construct full API URL
const GEMINI_API_URL = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`;

/**
 * Sleep function for retry delays
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate content using Google Gemini API with simple retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Object} Response with generated content
 */
const generateContent = async (prompt, maxRetries = 3) => {
    console.log(`🤖 Using single stable model: ${GEMINI_MODEL}`);
    console.log(`🔑 API Key status: ${GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'MISSING'}`);
    console.log(`🔗 API URL: ${GEMINI_API_URL}`);

    // Check if should skip Gemini API
    if (process.env.SKIP_GEMINI === 'true') {
        console.log('🚫 Skipping Gemini API (SKIP_GEMINI=true)');
        return {
            success: false,
            message: 'Gemini API skipped - using demo content',
            data: null,
            error: {
                message: 'Gemini API disabled',
                code: 'GEMINI_DISABLED',
                model: GEMINI_MODEL,
                totalAttempts: 0
            }
        };
    }

    // Validate API key
    if (!GEMINI_API_KEY) {
        return {
            success: false,
            message: 'GEMINI_API_KEY is missing from environment variables. Please set it in .env file.',
            data: null,
            error: {
                message: 'Missing API key',
                code: 'MISSING_API_KEY',
                model: GEMINI_MODEL,
                totalAttempts: 0
            }
        };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const requestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            };

            console.log(`🔄 ${GEMINI_MODEL} attempt ${attempt}/${maxRetries}`);

            const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000 // 30 seconds timeout
            });

            if (response.data && response.data.candidates && response.data.candidates[0]) {
                const generatedText = response.data.candidates[0].content.parts[0].text;
                console.log(`✅ ${GEMINI_MODEL} success on attempt ${attempt}`);
                return {
                    success: true,
                    data: generatedText,
                    message: 'Content generated successfully',
                    model: GEMINI_MODEL,
                    attempt
                };
            } else {
                throw new Error('Invalid response structure from Gemini API');
            }

        } catch (error) {
            const isRetryableError =
                error.response?.status === 503 || // Service overloaded
                error.response?.status === 429 || // Rate limited  
                error.response?.status === 500 || // Internal server error
                error.code === 'ECONNRESET' ||   // Connection reset
                error.code === 'ETIMEDOUT' ||    // Timeout
                error.code === 'ECONNABORTED';   // Request timeout

            console.error(`❌ ${GEMINI_MODEL} Error (attempt ${attempt}/${maxRetries}):`, {
                message: error.message,
                status: error.response?.status,
                code: error.code,
                retryable: isRetryableError
            });

            // Nếu là attempt cuối hoặc lỗi không thể retry
            if (attempt === maxRetries || !isRetryableError) {
                return {
                    success: false,
                    message: `Gemini API failed after ${attempt} attempts: ${error.message}`,
                    data: null,
                    error: {
                        message: error.message,
                        status: error.response?.status,
                        code: error.code,
                        model: GEMINI_MODEL,
                        totalAttempts: attempt
                    }
                };
            }

            // Exponential backoff delay
            const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            console.log(`⏳ Retrying ${GEMINI_MODEL} in ${delayMs}ms...`);
            await sleep(delayMs);
        }
    }
};

/**
 * Generate JSON content using Gemini API  
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Object} Response with parsed JSON content
 */
const generateJsonContent = async (prompt) => {
    const result = await generateContent(prompt);

    if (!result.success) {
        return result;
    }

    try {
        // Clean và parse JSON response
        let jsonText = result.data.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsedData = JSON.parse(jsonText);

        return {
            success: true,
            data: parsedData,
            message: 'JSON content generated and parsed successfully',
            model: result.model,
            attempt: result.attempt
        };
    } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError.message);
        console.error('Raw response:', result.data);

        return {
            success: false,
            message: 'Failed to parse JSON from Gemini response',
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
 * Validate Gemini API connection
 * @returns {Object} Validation result
 */
const validateConnection = async () => {
    try {
        console.log('🔍 Testing Gemini API connection...');
        console.log(`🔑 Using API Key: ${GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'MISSING'}`);
        console.log(`🔗 API URL: ${GEMINI_API_URL}`);
        console.log(`🤖 Model: ${GEMINI_MODEL}`);

        const testPrompt = 'Test connection. Respond with: "Connection successful"';

        const result = await generateContent(testPrompt, 1); // Only 1 attempt for connection test

        if (result.success) {
            console.log('✅ Gemini API connection successful');
            return {
                success: true,
                connected: true,
                message: 'Gemini API connection successful',
                model: result.model,
                response: result.data,
                config: {
                    model: GEMINI_MODEL,
                    baseUrl: GEMINI_BASE_URL,
                    fullApiUrl: GEMINI_API_URL,
                    apiKeyStatus: GEMINI_API_KEY ? 'Present' : 'Missing',
                    source: 'Environment Variables'
                }
            };
        } else {
            console.error('❌ Gemini API connection failed:', result.message);
            return {
                success: false,
                connected: false,
                message: `Gemini API connection failed: ${result.message}`,
                error: result.error,
                config: {
                    model: GEMINI_MODEL,
                    baseUrl: GEMINI_BASE_URL,
                    fullApiUrl: GEMINI_API_URL,
                    apiKeyStatus: GEMINI_API_KEY ? 'Present' : 'Missing',
                    source: 'Environment Variables'
                }
            };
        }
    } catch (error) {
        console.error('❌ Gemini API connection error:', error);
        return {
            success: false,
            connected: false,
            message: 'Gemini API connection error',
            error: error.message,
            config: {
                model: GEMINI_MODEL,
                baseUrl: GEMINI_BASE_URL,
                fullApiUrl: GEMINI_API_URL,
                apiKeyStatus: GEMINI_API_KEY ? 'Present' : 'Missing',
                source: 'Environment Variables'
            }
        };
    }
};

export default {
    generateContent,
    generateJsonContent,
    validateConnection
}; 