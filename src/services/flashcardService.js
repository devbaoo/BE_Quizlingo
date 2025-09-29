import fs from "fs";
import path from "path";

const DEFAULT_JSON_PATH = path.resolve(
  process.env.FLASHCARD_JSON_PATH || "flashcards_triet_hoc_MLN.json"
);

let cachedFlashcards = null;
let cachedTimestamp = 0;

const normalizeString = (value) => (value || "").toString().trim();

const normalizeCard = (rawCard) => ({
  id: normalizeString(rawCard.id),
  front: normalizeString(rawCard.front),
  back: normalizeString(rawCard.back),
  tags: Array.isArray(rawCard.tags)
    ? rawCard.tags.map((tag) => normalizeString(tag)).filter(Boolean)
    : [],
});

const readFlashcardsFromFile = async () => {
  try {
    const stats = await fs.promises.stat(DEFAULT_JSON_PATH);
    if (cachedFlashcards && cachedTimestamp === stats.mtimeMs) {
      return cachedFlashcards;
    }

    const fileContent = await fs.promises.readFile(DEFAULT_JSON_PATH, "utf8");
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      throw new Error("Flashcard JSON phải là một mảng");
    }

    cachedFlashcards = parsed.map(normalizeCard).filter((card) => card.id);
    cachedTimestamp = stats.mtimeMs;

    return cachedFlashcards;
  } catch (error) {
    throw new Error(
      `Không thể đọc dữ liệu flashcard: ${error.message}. Đường dẫn: ${DEFAULT_JSON_PATH}`
    );
  }
};

const listFlashcards = async ({ tag, search, page = 1, limit = 20 } = {}) => {
  const flashcards = await readFlashcardsFromFile();

  const normalizedTag = tag ? tag.trim().toLowerCase() : null;
  const normalizedSearch = search ? search.trim().toLowerCase() : null;

  let filtered = flashcards;

  if (normalizedTag) {
    filtered = filtered.filter((card) =>
      card.tags.some((cardTag) => cardTag.toLowerCase() === normalizedTag)
    );
  }

  if (normalizedSearch) {
    filtered = filtered.filter((card) => {
      const haystack = `${card.front} ${card.back}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const startIndex = (safePage - 1) * safeLimit;
  const paginated = filtered.slice(startIndex, startIndex + safeLimit);

  return {
    success: true,
    message: "Lấy danh sách flashcard thành công",
    data: paginated,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / safeLimit) || 1,
    },
  };
};

const getFlashcardById = async (id) => {
  const flashcards = await readFlashcardsFromFile();
  const normalizedId = (id || "").trim();
  return flashcards.find((card) => card.id === normalizedId) || null;
};

const getTags = async () => {
  const flashcards = await readFlashcardsFromFile();
  const tagMap = new Map();

  flashcards.forEach((card) => {
    card.tags.forEach((tag) => {
      const key = tag.toLowerCase();
      const entry = tagMap.get(key) || { tag, count: 0 };
      entry.count += 1;
      tagMap.set(key, entry);
    });
  });

  return {
    success: true,
    message: "Lấy danh sách tag thành công",
    tags: Array.from(tagMap.values()).sort((a, b) => b.count - a.count),
  };
};

const getRandomFlashcards = async ({ tag, limit = 10 } = {}) => {
  const listResult = await listFlashcards({ tag, limit: 1000, page: 1 });
  const source = listResult.data;

  if (!source.length) {
    return {
      success: true,
      message: "Không có flashcard phù hợp",
      data: [],
    };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), source.length);

  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return {
    success: true,
    message: "Lấy flashcard ngẫu nhiên thành công",
    data: shuffled.slice(0, safeLimit),
  };
};

export default {
  listFlashcards,
  getFlashcardById,
  getTags,
  getRandomFlashcards,
  __internal: {
    readFlashcardsFromFile,
  },
};

