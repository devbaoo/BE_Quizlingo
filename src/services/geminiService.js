import axios from 'axios';

const GEMINI_API_KEY = 'AIzaSyC-f4u4ZvfIOi1WReflo_aoQanP_Ilg6tM';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Generate content using Google Gemini API
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Object} Response with generated content
 */
const generateContent = async (prompt) => {
    try {
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout
        });

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const generatedText = response.data.candidates[0].content.parts[0].text;

            return {
                success: true,
                data: generatedText,
                message: 'Content generated successfully'
            };
        } else {
            return {
                success: false,
                message: 'No content generated from Gemini API',
                data: null
            };
        }
    } catch (error) {
        console.error('Gemini API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        return {
            success: false,
            message: `Gemini API Error: ${error.message}`,
            data: null
        };
    }
};

/**
 * Generate JSON content with specific prompt for structured data
 * @param {string} prompt - The prompt that requests JSON output
 * @returns {Object} Parsed JSON response
 */
const generateJsonContent = async (prompt) => {
    try {
        const result = await generateContent(prompt);

        if (!result.success) {
            return result;
        }

        // Try to parse JSON from the response
        let jsonData;
        try {
            // Remove any markdown code block markers if present
            let cleanedText = result.data.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            jsonData = JSON.parse(cleanedText);

            return {
                success: true,
                data: jsonData,
                message: 'JSON content generated and parsed successfully'
            };
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError.message);
            console.error('Raw response:', result.data);

            return {
                success: false,
                message: `Failed to parse JSON response: ${parseError.message}`,
                data: null,
                rawResponse: result.data
            };
        }
    } catch (error) {
        console.error('Generate JSON Content Error:', error);
        return {
            success: false,
            message: `Error generating JSON content: ${error.message}`,
            data: null
        };
    }
};

/**
 * Validate Gemini API connection
 * @returns {Object} Connection status
 */
const validateConnection = async () => {
    try {
        const testPrompt = "Hello, please respond with 'Connection successful'";
        const result = await generateContent(testPrompt);

        return {
            success: result.success,
            message: result.success ? 'Gemini API connection successful' : result.message,
            connected: result.success
        };
    } catch (error) {
        return {
            success: false,
            message: `Connection validation failed: ${error.message}`,
            connected: false
        };
    }
};

export default {
    generateContent,
    generateJsonContent,
    validateConnection
}; 