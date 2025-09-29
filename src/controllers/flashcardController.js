import flashcardService from "../services/flashcardService.js";

const listFlashcards = async (req, res) => {
  try {
    const { tag, search, page, limit } = req.query;
    const result = await flashcardService.listFlashcards({
      tag,
      search,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("listFlashcards error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách flashcard",
      error: error.message,
    });
  }
};

const getFlashcardDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const card = await flashcardService.getFlashcardById(id);

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy flashcard",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy flashcard thành công",
      data: card,
    });
  } catch (error) {
    console.error("getFlashcardDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy flashcard",
      error: error.message,
    });
  }
};

const getFlashcardTags = async (req, res) => {
  try {
    const result = await flashcardService.getTags();
    return res.status(200).json(result);
  } catch (error) {
    console.error("getFlashcardTags error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách tag",
      error: error.message,
    });
  }
};

const getRandomFlashcards = async (req, res) => {
  try {
    const { tag, limit } = req.query;
    const result = await flashcardService.getRandomFlashcards({ tag, limit });

    return res.status(200).json(result);
  } catch (error) {
    console.error("getRandomFlashcards error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy flashcard ngẫu nhiên",
      error: error.message,
    });
  }
};

export default {
  listFlashcards,
  getFlashcardDetails,
  getFlashcardTags,
  getRandomFlashcards,
};

