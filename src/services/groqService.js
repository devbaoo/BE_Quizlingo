import fetch from "node-fetch";
import { fileTypeFromBuffer } from "file-type";
import { Groq } from "groq-sdk";
import cloudinaryService from "./cloudinaryService.js";


const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_UPLOAD_URL = process.env.ASSEMBLYAI_UPLOAD_URL;
const ASSEMBLYAI_TRANSCRIPT_URL = process.env.ASSEMBLYAI_TRANSCRIPT_URL;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// Step 1: Upload audio to AssemblyAI
const uploadAudio = async (audioBuffer) => {
  const response = await fetch(ASSEMBLYAI_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: ASSEMBLYAI_API_KEY,
      "Transfer-Encoding": "chunked",
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.upload_url;
};

// Text to Speech
const textToSpeech = async (text, voice = "female") => {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `You are a text-to-speech system. Convert the following text to a format that can be used for speech synthesis. The voice should be a ${voice} voice.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      success: true,
      audioContent: data.choices[0].message.content,
      metadata: {
        model: data.model,
        usage: data.usage,
      },
    };
  } catch (error) {
    console.error("Text to speech error:", error);
    return {
      success: false,
      message: `Lỗi khi chuyển đổi text sang speech: ${error.message}`,
    };
  }
};

const textToSpeechAndUpload = async (text, voice = "Fritz-PlayAI") => {
  try {
    const response = await groq.audio.speech.create({
      model: "playai-tts",
      voice,
      input: text,
      response_format: "wav",
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    const uploadResult = await cloudinaryService.uploadAudioBuffer(buffer, "tts.wav");

    if (!uploadResult.success) {
      return { success: false, message: uploadResult.message };
    }

    return {
      success: true,
      audioUrl: uploadResult.audioUrl,
    };
  } catch (error) {
    console.error("TTS + Upload error:", error);
    return { success: false, message: error.message };
  }
};

// Speech to Text
const speechToText = async (audioBuffer) => {
  try {
    const fileType = await fileTypeFromBuffer(audioBuffer);
    const extension = fileType?.ext || "mp3";
    const mimeType = fileType?.mime || "audio/mpeg";

    const uploadUrl = await uploadAudio(audioBuffer);

    const transcriptResponse = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: uploadUrl }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(
        `Transcription request failed: ${transcriptResponse.status} ${errorText}`
      );
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    let transcription;
    let attempts = 0;
    const maxAttempts = 45;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(
        `${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`,
        {
          headers: { Authorization: ASSEMBLYAI_API_KEY },
        }
      );

      const statusData = await statusResponse.json();

      if (statusData.status === "completed") {
        transcription = statusData.text;
        break;
      } else if (statusData.status === "failed") {
        throw new Error(
          `Transcription failed: ${statusData.error || "Unknown error"}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }


    if (typeof transcription !== "string" || transcription.trim() === "") {
      throw new Error("Transcription failed or returned empty result");
    }

    return {
      success: true,
      transcription,
      metadata: {
        transcriptId,
      },
    };
  } catch (error) {
    console.error("Speech to text error:", error);
    return {
      success: false,
      message: `Lỗi khi chuyển đổi speech sang text: ${error.message}`,
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
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a language pronunciation coach. Compare the reference text with the transcribed speech and provide a score from 0-100 and feedback.",
          },
          {
            role: "user",
            content: `Reference text: "${referenceText}"\nTranscribed speech: "${transcriptionResult.transcription}"\nPlease evaluate the pronunciation accuracy, provide a score from 0-100, and give feedback.`,
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const evaluationText = data.choices[0].message.content;

    const scoreMatch =
      evaluationText.match(/score\s*:\s*(\d+)/i) ||
      evaluationText.match(/(\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

    return {
      success: true,
      score,
      feedback: evaluationText,
      transcription: transcriptionResult.transcription,
      metadata: {
        model: data.model,
        usage: data.usage,
        transcriptId: transcriptionResult.metadata.transcriptId,
      },
    };
  } catch (error) {
    console.error("Pronunciation evaluation error:", error);
    return {
      success: false,
      message: `Lỗi khi đánh giá phát âm: ${error.message}`,
    };
  }
};

const evaluateListeningTextInput = async (correctText, userInput) => {
  try {
    const response = await fetch(process.env.GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `You are a listening comprehension evaluator. Compare the student's response with the original transcript and return a score from 0 to 100, with feedback. Minor typos and grammatical differences should be tolerated.`
          },
          {
            role: "user",
            content: `Correct transcript: \"${correctText}\"\nStudent response: \"${userInput}\"\nPlease rate the accuracy, give a score out of 100, and explain the differences.`
          }
        ],
        max_tokens: 512
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const scoreMatch = content.match(/score\s*[:\-]?\s*(\d+)/i) || content.match(/(\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

    return {
      success: true,
      score,
      isCorrect: score >= 70,
      feedback: content,
    };
  } catch (error) {
    console.error("evaluateListeningTextInput error:", error);
    return {
      success: false,
      score: 0,
      isCorrect: false,
      feedback: error.message,
    };
  }
};

// Transcribe from Cloudinary audio URL
const transcribeFromAudioUrl = async (audioUrl) => {
  try {
    const res = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    });

    const data = await res.json();
    const transcriptId = data.id;

    let transcription;
    let attempts = 0;
    const maxAttempts = 45;

    while (attempts < maxAttempts) {
      const statusRes = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`, {
        headers: { Authorization: ASSEMBLYAI_API_KEY },
      });
      const statusData = await statusRes.json();

      if (statusData.status === "completed") {
        transcription = statusData.text;
        break;
      } else if (statusData.status === "failed") {
        throw new Error(statusData.error || "Unknown error");
      }

      await new Promise((res) => setTimeout(res, 2000));
      attempts++;
    }

    return {
      success: true,
      transcription,
      metadata: {
        transcriptId,
        audioUrl,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: `Lỗi transcription: ${err.message}`,
    };
  }
};

// Transcribe từ buffer (upload + transcribe)
const transcribeAudioBuffer = async (buffer) => {
  const uploadResult = await cloudinaryService.uploadAudioBuffer(buffer);
  if (!uploadResult.success) return uploadResult;

  return await transcribeFromAudioUrl(uploadResult.audioUrl);
};

// Evaluate pronunciation từ buffer
const evaluatePronunciationFromAudio = async (buffer, referenceText) => {
  try {
    const transcriptionRes = await transcribeAudioBuffer(buffer);
    if (!transcriptionRes.success) return transcriptionRes;

    const { transcription, metadata } = transcriptionRes;

    const evalRes = await evaluatePronunciationWithText(referenceText, transcription);
    if (!evalRes.success) return evalRes;

    return {
      success: true,
      score: evalRes.score,
      feedback: evalRes.feedback,
      transcription,
      audioUrl: metadata.audioUrl,
      transcriptId: metadata.transcriptId,
    };
  } catch (err) {
    return {
      success: false,
      message: `Lỗi đánh giá phát âm: ${err.message}`,
    };
  }
};

const evaluatePronunciationWithText = async (questionContent, userTranscript) => {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "You are an English speaking coach. Evaluate the learner's response to an open-ended speaking prompt.",
        },
        {
          role: "user",
          content: `
Prompt: "${questionContent}"
Student's spoken response (transcribed): "${userTranscript}"

Evaluate:
1. Relevance to the prompt (0-100)
2. Pronunciation clarity (0-100)
3. Grammar (0-100)
4. Vocabulary richness (0-100)

Return an overall score (0-100), and provide feedback on what was good and what can be improved.
          `.trim(),
        },
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;

  const scoreMatch = content.match(/score\s*[:\-]?\s*(\d+)/i) || content.match(/(\d+)\/100/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

  return {
    success: true,
    score,
    feedback: content,
  };
};

const evaluateWritingTextInput = async (questionPrompt, userInput) => {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are an English writing teacher. Evaluate student writing for correctness and relevance.",
          },
          {
            role: "user",
            content: `
Prompt: "${questionPrompt}"
Student's writing: "${userInput}"

Please rate the response on:
- Relevance to the prompt (0-100)
- Grammar & structure (0-100)
- Vocabulary (0-100)

Return an overall score out of 100, a short summary, and constructive feedback.
            `.trim(),
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    const scoreMatch = content.match(/score\s*[:\-]?\s*(\d+)/i) || content.match(/(\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

    return {
      success: true,
      score,
      feedback: content,
      isCorrect: score >= 70,
    };
  } catch (error) {
    return {
      success: false,
      score: 0,
      isCorrect: false,
      feedback: error.message,
    };
  }
};


export default {
  textToSpeech,
  speechToText,
  evaluatePronunciation,
  textToSpeechAndUpload,
  evaluateListeningTextInput,
  transcribeFromAudioUrl,
  transcribeAudioBuffer,
  evaluatePronunciationFromAudio,
  evaluateWritingTextInput
};
