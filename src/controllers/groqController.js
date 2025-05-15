import groqService from '../services/groqService.js';

const textToSpeech = async (req, res) => {
    try {
        const { text, voice } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Văn bản là bắt buộc'
            });
        }

        const result = await groqService.textToSpeech(text, voice);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Chuyển đổi text sang speech thành công',
            audioContent: result.audioContent,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Text to speech controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const speechToText = async (req, res) => {
    try {
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({
                success: false,
                message: 'File audio là bắt buộc'
            });
        }

        const result = await groqService.speechToText(audioFile.buffer);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Chuyển đổi speech sang text thành công',
            transcription: result.transcription,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Speech to text controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const evaluatePronunciation = async (req, res) => {
    try {
        const { referenceText } = req.body;
        const audioFile = req.file;

        if (!referenceText || !audioFile) {
            return res.status(400).json({
                success: false,
                message: 'Văn bản tham chiếu và file audio là bắt buộc'
            });
        }

        const result = await groqService.evaluatePronunciation(referenceText, audioFile.buffer);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Đánh giá phát âm thành công',
            score: result.score,
            feedback: result.feedback,
            transcription: result.transcription,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Evaluate pronunciation controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

export default {
    textToSpeech,
    speechToText,
    evaluatePronunciation
};