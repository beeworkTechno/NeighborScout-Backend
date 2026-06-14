const BLOCKED_WORDS = [
  // Add vulgar/inappropriate words here.
  // Keep them lowercase.
  // Example:
  "fuck",
  "sex",
  "shit",
  
  // "bad phrase",
];

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
    .replace(/[7]/g, "t")
    .replace(/\s+/g, " ")
    .trim();
};

const makeCompactText = (text = "") => {
  return normalizeText(text).replace(/[^a-z0-9]/g, "");
};

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const containsBlockedWords = (comment = "") => {
  if (!comment || BLOCKED_WORDS.length === 0) {
    return false;
  }

  const normalizedComment = normalizeText(comment);
  const compactComment = makeCompactText(comment);

  return BLOCKED_WORDS.some((word) => {
    const normalizedWord = normalizeText(word);
    const compactWord = makeCompactText(word);

    if (!normalizedWord || !compactWord) {
      return false;
    }

    const wordPattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegex(normalizedWord)}([^a-z0-9]|$)`,
      "i"
    );

    const normalMatch = wordPattern.test(normalizedComment);
    const compactMatch = compactComment.includes(compactWord);

    return normalMatch || compactMatch;
  });
};

module.exports = {
  containsBlockedWords,
};