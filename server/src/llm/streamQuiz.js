import { generateTextStream } from "./client.js";
import { QuestionSchema, QuizSchema } from "./schemas/quizSchema.js";
import {
  SYSTEM_INSTRUCTION,
  buildQuizPrompt,
  PROMPT_VERSION,
} from "./prompts/quizPrompt.v1.js";

/**
 * Extracts completed and Zod-valid Question objects from a progressively accumulating JSON buffer.
 *
 * @param {string} jsonBuffer - The raw JSON string accumulated so far
 * @param {number} alreadyExtractedCount - Number of questions already extracted
 * @returns {Array<Object>} Newly completed questions
 */
export function extractCompletedQuestions(jsonBuffer, alreadyExtractedCount = 0) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let objStartIndex = -1;
  const found = [];

  for (let i = 0; i < jsonBuffer.length; i++) {
    const char = jsonBuffer[i];

    if (inString) {
      if (char === "\\" && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === '"' && !isEscaped) {
          inString = false;
        }
        isEscaped = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth++;
      if (depth === 2) {
        objStartIndex = i;
      }
    } else if (char === "}") {
      if (depth === 2 && objStartIndex !== -1) {
        const candidate = jsonBuffer.slice(objStartIndex, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          const validated = QuestionSchema.safeParse(parsed);
          if (validated.success) {
            found.push(validated.data);
          }
        } catch {
          // JSON substring not yet fully formed
        }
        objStartIndex = -1;
      }
      depth--;
    }
  }

  return found.slice(alreadyExtractedCount);
}

/**
 * Streams quiz questions progressively from the Gemini API.
 * Emits individual questions as soon as they are generated and validated,
 * without waiting for the full deck to finish.
 *
 * @param {Object} options
 * @param {string} options.topic - Topic string
 * @param {number} [options.count=5] - Number of questions
 * @param {string} [options.difficulty="medium"] - Difficulty
 * @param {Function} options.onQuestion - Callback when a question is ready: (question, index) => void
 * @param {Function} [options.onToken] - Callback for raw tokens: (token) => void
 * @returns {Promise<{ topic: string, questions: Array, metrics: Object }>}
 */
export async function streamQuiz({
  topic,
  count = 5,
  difficulty = "medium",
  onQuestion,
  onToken,
}) {
  const startTime = Date.now();
  const prompt = buildQuizPrompt({ topic, count, difficulty });

  let accumulatedText = "";
  const questions = [];
  let tokenCountEstimate = 0;

  const stream = generateTextStream({
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    accumulatedText += text;
    tokenCountEstimate += Math.ceil(text.length / 4); // Approximate tokens

    if (onToken) {
      onToken(text);
    }

    // Check for newly completed questions
    const newQuestions = extractCompletedQuestions(accumulatedText, questions.length);
    for (const q of newQuestions) {
      questions.push(q);
      if (onQuestion) {
        onQuestion(q, questions.length - 1);
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    topic,
    difficulty,
    questions,
    metrics: {
      promptVersion: PROMPT_VERSION,
      latencyMs: durationMs,
      streamed: true,
      questionsGenerated: questions.length,
      estimatedTokens: tokenCountEstimate,
    },
  };
}
