import fetch from 'node-fetch';
import { File } from 'formdata-node';
import { fileTypeFromBuffer } from 'file-type';

const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ASSEMBLYAI_API_KEY = '59e96f99d045459b93ce7fcfd1286b11';
const ASSEMBLYAI_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const ASSEMBLYAI_TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';

// Step 1: Upload audio to AssemblyAI
const uploadAudio = async (audioBuffer) => {
    const response = await fetch(ASSEMBLYAI_UPLOAD_URL, {
        method: 'POST',
        headers: {
            'Authorization': ASSEMBLYAI_API_KEY,
            'Transfer-Encoding': 'chunked'
        },
        body: audioBuffer
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.upload_url;
};

// Text to Speech
const textToSpeech = async (text, voice = 'female') => {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: `You are a text-to-speech system. Convert the following text to a format that can be used for speech synthesis. The voice should be a ${voice} voice.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            audioContent: data.choices[0].message.content,
            metadata: {
                model: data.model,
                usage: data.usage
            }
        };
    } catch (error) {
        console.error('Text to speech error:', error);
        return {
            success: false,
            message: `Lỗi khi chuyển đổi text sang speech: ${error.message}`
        };
    }
};

// Speech to Text
const speechToText = async (audioBuffer) => {
    try {
        const fileType = await fileTypeFromBuffer(audioBuffer);
        const extension = fileType?.ext || 'mp3';
        const mimeType = fileType?.mime || 'audio/mpeg';
        console.log('Detected file type:', { extension, mimeType });

        const uploadUrl = await uploadAudio(audioBuffer);
        console.log('Uploaded audio URL:', uploadUrl);

        const transcriptResponse = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
            method: 'POST',
            headers: {
                'Authorization': ASSEMBLYAI_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ audio_url: uploadUrl })
        });

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            throw new Error(`Transcription request failed: ${transcriptResponse.status} ${errorText}`);
        }

        const transcriptData = await transcriptResponse.json();
        const transcriptId = transcriptData.id;

        let transcription;
        let attempts = 0;
        const maxAttempts = 45;

        while (attempts < maxAttempts) {
            const statusResponse = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`, {
                headers: { 'Authorization': ASSEMBLYAI_API_KEY }
            });

            const statusData = await statusResponse.json();
            console.log(`Polling attempt ${attempts + 1}:`, statusData.status);

            if (statusData.status === 'completed') {
                transcription = statusData.text;
                break;
            } else if (statusData.status === 'failed') {
                throw new Error(`Transcription failed: ${statusData.error || 'Unknown error'}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }

        console.log('Final transcription result:', transcription);

        if (typeof transcription !== 'string' || transcription.trim() === '') {
            throw new Error('Transcription failed or returned empty result');
        }

        return {
            success: true,
            transcription,
            metadata: {
                transcriptId
            }
        };
    } catch (error) {
        console.error('Speech to text error:', error);
        return {
            success: false,
            message: `Lỗi khi chuyển đổi speech sang text: ${error.message}`
        };
    }
};

// Evaluate Pronunciation
const evaluatePronunciation = async (referenceText, audioBuffer) => {
    try {
        const transcriptionResult = await speechToText(audioBuffer);
        if (!transcriptionResult.success) {
            return transcriptionResult;
        }

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a language pronunciation coach. Compare the reference text with the transcribed speech and provide a score from 0-100 and feedback.'
                    },
                    {
                        role: 'user',
                        content: `Reference text: "${referenceText}"\nTranscribed speech: "${transcriptionResult.transcription}"\nPlease evaluate the pronunciation accuracy, provide a score from 0-100, and give feedback.`
                    }
                ],
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const evaluationText = data.choices[0].message.content;

        const scoreMatch = evaluationText.match(/score\s*:\s*(\d+)/i) || evaluationText.match(/(\d+)\/100/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

        return {
            success: true,
            score,
            feedback: evaluationText,
            transcription: transcriptionResult.transcription,
            metadata: {
                model: data.model,
                usage: data.usage,
                transcriptId: transcriptionResult.metadata.transcriptId
            }
        };
    } catch (error) {
        console.error('Pronunciation evaluation error:', error);
        return {
            success: false,
            message: `Lỗi khi đánh giá phát âm: ${error.message}`
        };
    }
};

export default {
    textToSpeech,
    speechToText,
    evaluatePronunciation
};
