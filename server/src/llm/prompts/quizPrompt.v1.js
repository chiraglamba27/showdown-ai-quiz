/**
 * Quiz Prompt - Version 1
 * Versioned prompt module for generating multiple-choice questions.
 */

export const PROMPT_VERSION = "v1";

export const SYSTEM_INSTRUCTION = `You are an expert technical educator and quiz master.
Your task is to generate high-quality, technically accurate multiple-choice questions (MCQs) for interactive competitive quizzes.

Follow these strict rules:
1. Each question must have EXACTLY 4 options.
2. Exactly ONE option must be unequivocally correct.
3. Distractors (wrong options) must be plausible, common misconceptions, and not obviously absurd.
4. "correctIndex" must be the 0-based integer index (0, 1, 2, or 3) pointing to the correct option in the "options" array.
5. All 4 options must be distinct. Never repeat an option.
6. NEVER use phrases like "all of the above", "none of the above", or "both A and B", because option order will be randomized in live gameplay.
7. Explanations must be educational, concise, and explain why the correct option is right.
8. Output MUST be valid JSON strictly matching the requested schema. Do not include markdown code fences or conversational text.`;

export const DIFFICULTY_SYNONYMS = [
  { level: "easy", regex: /\b(easy|simple|beginner|basics?|introductory|intro|elementary|novice)\b/i },
  { level: "hard", regex: /\b(hard|tough|difficult|advanced|expert|complex|challenging)\b/i },
  { level: "medium", regex: /\b(medium|intermediate|moderate|normal|average|standard)\b/i },
];

export const ALL_DIFFICULTY_WORDS_REGEX =
  "easy|simple|beginner|basics?|introductory|intro|elementary|novice|hard|tough|difficult|advanced|expert|complex|challenging|medium|intermediate|moderate|normal|average|standard";

/**
 * Cleans topic strings by removing conversational command prefixes, quantities, and difficulty phrases
 * that contradict UI parameters (e.g. "200 questions on Computer Networks tough" -> "Computer Networks").
 */
export function cleanTopicName(raw) {
  if (!raw || typeof raw !== "string") return "General Knowledge";
  let cleaned = raw.trim();
  cleaned = cleaned
    .replace(/^(?:please\s+)?(?:generate|give\s+me|create|make|write|provide)?\s*/i, "")
    // Match "10 easy questions", "200 questions", "5 hard mcqs", "15 tough questions"
    .replace(/\b\d+\s*(?:easy|simple|beginner|hard|tough|difficult|advanced|medium|intermediate)?\s*(?:questions?|mcqs?|qs\b|items?)\b/gi, "")
    // Match lone numbers at beginning: "10 on computer networks", "200 on..."
    .replace(/^\s*\d+\s+(?:on|about|for)?\s*/i, "")
    // Remove "questions on", "quiz on", "mcqs about", etc.
    .replace(/\b(?:questions?|mcqs?|quiz)\s+(?:on|about|for|regarding|in)\b/gi, " ")
    .replace(/\b(?:questions?|mcqs?|quiz)\b/gi, " ")
    // Remove difficulty adjectives and modifiers (tough, advanced level, hard difficulty)
    .replace(new RegExp(`\\b(?:${ALL_DIFFICULTY_WORDS_REGEX})\\s*(?:difficulty|level|grade)?\\b`, "gi"), " ")
    // Strip leading/dangling prepositions
    .replace(/^(?:on|about|for|regarding|in)\s+/i, "")
    .replace(/\s+(?:on|about|for|regarding|in)\s+/gi, " ")
    // Strip trailing/leading punctuation (e.g. trailing hyphens, commas, colons)
    .replace(/[-–—,:;.\s]+$/, "")
    .replace(/^[-–—,:;.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || raw.trim();
}

/**
 * Parses user prompt intent: extracts embedded question counts and difficulties if present,
 * falling back to the manual button settings when omitted.
 *
 * @param {string} rawText - User-provided prompt text
 * @param {number} [defaultCount=5] - Fallback count from manual button
 * @param {string} [defaultDifficulty="medium"] - Fallback difficulty from manual button
 * @returns {{ cleanTopic: string, count: number, difficulty: string, detectedCount: number|null, detectedDifficulty: string|null, rawCount: number|null }}
 */
export function parsePromptIntent(rawText, defaultCount = 5, defaultDifficulty = "medium") {
  if (!rawText || typeof rawText !== "string") {
    return {
      cleanTopic: "General Knowledge",
      count: defaultCount,
      difficulty: defaultDifficulty,
      detectedCount: null,
      detectedDifficulty: null,
      rawCount: null,
    };
  }

  const text = rawText.trim();
  let detectedDifficulty = null;
  for (const { level, regex } of DIFFICULTY_SYNONYMS) {
    if (regex.test(text)) {
      detectedDifficulty = level;
      break;
    }
  }

  let detectedCount = null;
  let rawCount = null;
  const countMatch =
    text.match(/\b(\d+)\s*(?:easy|simple|beginner|hard|tough|difficult|advanced|medium|intermediate)?\s*(?:questions?|mcqs?|qs\b|items?)/i) ||
    text.match(/^(?:generate|give\s+me|create|make|write)?\s*(\d+)\b/i);

  if (countMatch) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      rawCount = parsed;
      // Allow up to 20 questions for interactive quizzes while guarding against LLM output token timeouts
      detectedCount = Math.min(Math.max(parsed, 1), 20);
    }
  }

  const cleanSubject = cleanTopicName(text);

  return {
    cleanTopic: cleanSubject,
    count: detectedCount !== null ? detectedCount : Math.min(Math.max(Number(defaultCount) || 5, 1), 20),
    difficulty: detectedDifficulty !== null ? detectedDifficulty : defaultDifficulty,
    detectedCount,
    detectedDifficulty,
    rawCount,
  };
}

/**
 * Builds the user prompt given user requirements.
 *
 * @param {Object} params
 * @param {string} params.topic - Topic or subject matter (e.g. "DBMS normalization")
 * @param {number} params.count - Number of questions to generate (default 5)
 * @param {string} params.difficulty - "easy" | "medium" | "hard"
 * @returns {string} The formatted prompt string
 */
export function buildQuizPrompt({ topic, count = 5, difficulty = "medium" }) {
  const sanitizedTopic = cleanTopicName(topic);

  return `Generate an interactive multiple-choice quiz with the following strict parameters:
- Core Topic / Subject: "${sanitizedTopic}"
- AUTHORITATIVE Question Count: ${count}
- Difficulty Level: ${difficulty}

CRITICAL INSTRUCTIONS:
1. You MUST generate EXACTLY ${count} questions in the "questions" array.
2. If the user prompt mentions conflicting quantities (like "100 questions" or "10 questions"), IGNORE IT. The authoritative count is ${count}.
3. Every question must be technically rigorous and strictly tailored to "${difficulty}" difficulty.

Return a single JSON object with this exact structure:
{
  "topic": "${sanitizedTopic}",
  "questions": [
    {
      "question": "string (at least 10 characters)",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0,
      "explanation": "Educational explanation of why the correct option is right (at least 10 characters)",
      "difficulty": "${difficulty}"
    }
  ]
};`;
}

/**
 * Builds a correction prompt to feed Zod validation errors back to the model.
 *
 * @param {string} originalOutput - The raw output the model previously returned
 * @param {Array<Object>} validationErrors - Array of Zod issue objects
 * @returns {string} The follow-up correction prompt
 */
export function buildCorrectionPrompt(originalOutput, validationErrors) {
  const formattedErrors = validationErrors
    .map((err, i) => `${i + 1}. At path "${err.path.join(".")}": ${err.message}`)
    .join("\n");

  return `Your previous JSON output failed validation against our strict schema.

VALIDATION ERRORS:
${formattedErrors}

PREVIOUS OUTPUT (THAT FAILED):
${originalOutput}

INSTRUCTIONS:
Fix the issues listed above. Ensure all 4 options are distinct, valid 0-3 correctIndex, no "all of the above", and valid JSON.
Return ONLY the corrected, complete JSON object.`;
}

/**
 * Builds a prompt to regenerate a SINGLE replacement question.
 * Supplies existing questions so the LLM avoids duplicate topics.
 *
 * @param {Object} params
 * @param {string} params.topic - Quiz topic
 * @param {string} params.difficulty - Difficulty level
 * @param {Array<string>} [params.existingQuestions=[]] - List of question strings to avoid duplicating
 * @returns {string} The formatted prompt string
 */
export function buildSingleQuestionPrompt({
  topic,
  difficulty = "medium",
  existingQuestions = [],
}) {
  const existingList =
    existingQuestions.length > 0
      ? `\nAvoid repeating concepts or phrasing from these existing questions in the quiz:\n` +
        existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
      : "";

  return `Generate ONE replacement multiple-choice question on the topic: "${topic}".
Difficulty level: ${difficulty}.${existingList}

Return a single JSON object for this question with this exact structure:
{
  "question": "string (at least 10 characters)",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctIndex": 0,
  "explanation": "Educational explanation of why the correct option is right (at least 10 characters)",
  "difficulty": "${difficulty}"
}`;
}

