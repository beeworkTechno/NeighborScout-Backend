const DEFAULT_BLOCKED_WORDS = [
  // Add default blocked words here if you want.
  // Example:
  "Fuck",
  // "word2",
];

const getBlockedWords = () => {
  const envWords = process.env.BLOCKED_REVIEW_WORDS || "";

  const wordsFromEnv = envWords
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  return [...DEFAULT_BLOCKED_WORDS, ...wordsFromEnv];
};

const normalizeText = (text = "") => {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t");
};

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const containsBlockedWords = (comment = "") => {
  const blockedWords = getBlockedWords();

  if (!comment || blockedWords.length === 0) {
    return false;
  }

  const normalizedComment = normalizeText(comment);

  return blockedWords.some((word) => {
    const normalizedWord = normalizeText(word);

    if (!normalizedWord) {
      return false;
    }

    const pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, "i");

    return pattern.test(normalizedComment);
  });
};

module.exports = {
  containsBlockedWords,
};