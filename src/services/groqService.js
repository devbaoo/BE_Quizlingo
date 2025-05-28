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

    const uploadResult = await cloudinaryService.uploadAudioBuffer(
      buffer,
      "tts.wav"
    );

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

const isInputValid = (input) => {
  // Kiểm tra nếu input quá ngắn, vô nghĩa, hoặc chứa toàn ký tự đặc biệt
  const cleanedInput = input.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return cleanedInput.length >= 5; // Tối thiểu 5 ký tự có nghĩa
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
              "Bạn là một giáo viên đánh giá phát âm tiếng Anh. Hãy so sánh văn bản gốc với bản ghi âm và đưa ra điểm số từ 0-100 cùng với nhận xét bằng tiếng Việt.",
          },
          {
            role: "user",
            content: `Văn bản gốc: "${referenceText}"\nBản ghi âm: "${transcriptionResult.transcription}"\nHãy đánh giá độ chính xác của phát âm, đưa ra điểm số từ 0-100, và đưa ra nhận xét.`,
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
  if (!isInputValid(userInput)) {
    return {
      success: true,
      score: 0,
      isCorrect: false,
      feedback: "Câu trả lời không hợp lệ hoặc không liên quan.",
    };
  }

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
            content: `
Bạn là giáo viên tiếng Anh nghiêm khắc. Hãy so sánh câu trả lời của học viên với bản ghi âm gốc:
- Nếu câu trả lời không liên quan hoặc vô nghĩa, hãy cho điểm thấp (dưới 30) và giải thích rõ.
- Đánh giá độ chính xác, bỏ qua lỗi chính tả nhỏ hoặc khác biệt ngữ pháp không đáng kể.
- Đưa ra điểm tổng (0-100) và nhận xét rõ ràng bằng tiếng Việt.
          `,
          },
          {
            role: "user",
            content: `
Bản ghi âm gốc: "${correctText}"
Câu trả lời của học viên: "${userInput}"

Hãy đánh giá:
- Độ chính xác (0-100)
- Điểm tổng (0-100)
- Nhận xét: (ngắn gọn, rõ ràng)
          `.trim(),
          },
        ],
        max_tokens: 512,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const scoreMatch = content.match(/tổng.*?(\d{1,3})/i) || content.match(/(\d{1,3})\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    return {
      success: true,
      score,
      isCorrect: score >= 70,
      feedback: content,
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
      const statusRes = await fetch(
        `${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`,
        {
          headers: { Authorization: ASSEMBLYAI_API_KEY },
        }
      );
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

    const evalRes = await evaluatePronunciationWithText(
      referenceText,
      transcription
    );
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
  if (!isInputValid(userTranscript)) {
    return {
      success: true,
      score: 0,
      feedback: "Nội dung câu trả lời không hợp lệ hoặc không liên quan.",
    };
  }

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
            content: `
Bạn là giáo viên tiếng Anh nghiêm khắc. Hãy kiểm tra câu trả lời của học viên so với câu hỏi. 
- Nếu câu trả lời không liên quan hoặc vô nghĩa, hãy cho điểm thấp (dưới 30) và giải thích rõ.
- Đánh giá độ rõ ràng của phát âm, ngữ pháp, từ vựng.
- Đưa ra điểm tổng (0-100) và nhận xét rõ ràng bằng tiếng Việt.
          `,
          },
          {
            role: "user",
            content: `
Câu hỏi: "${questionContent}"
Câu trả lời của học viên (bản ghi âm): "${userTranscript}"

Hãy đánh giá:
- Độ phù hợp với câu hỏi (0-100)
- Phát âm rõ ràng (0-100)
- Ngữ pháp (0-100)
- Từ vựng (0-100)
- Điểm tổng (0-100)
- Nhận xét: (ngắn gọn, rõ ràng)
          `.trim(),
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const scoreMatch = content.match(/tổng.*?(\d{1,3})/i) || content.match(/(\d{1,3})\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    return {
      success: true,
      score,
      feedback: content,
    };
  } catch (error) {
    return {
      success: false,
      score: 0,
      feedback: error.message,
    };
  }
};

const evaluateWritingTextInput = async (questionPrompt, userInput) => {
  if (!isInputValid(userInput)) {
    return {
      success: true,
      score: 0,
      isCorrect: false,
      feedback: "Nội dung bài viết không hợp lệ hoặc không liên quan.",
    };
  }

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
            content: `
Bạn là một giáo viên tiếng Anh nghiêm khắc. Hãy đánh giá bài viết của học viên dựa trên:
- Tính liên quan đến đề bài (rất quan trọng). Nếu bài viết không đúng đề bài hoặc vô nghĩa, cho điểm thấp (dưới 30) và giải thích rõ.
- Ngữ pháp & cấu trúc.
- Từ vựng.
Đưa ra điểm tổng trên thang điểm 100. Không dễ dãi. Chỉ cho điểm cao nếu học viên thực sự làm tốt.
Nhận xét bằng tiếng Việt.
          `,
          },
          {
            role: "user",
            content: `
Đề bài: "${questionPrompt}"
Bài viết của học viên: "${userInput}"

Hãy đánh giá:
- Độ phù hợp với đề bài (0-100)
- Ngữ pháp & cấu trúc (0-100)
- Từ vựng (0-100)
- Điểm tổng (0-100)
- Nhận xét: (ngắn gọn, rõ ràng)
            `.trim(),
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const scoreMatch = content.match(/tổng.*?(\d{1,3})/i) || content.match(/(\d{1,3})\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    return {
      success: true,
      score,
      isCorrect: score >= 70,
      feedback: content,
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
  evaluateWritingTextInput,
};
