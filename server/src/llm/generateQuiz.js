import { generateText } from "./client.js";
import { QuizSchema } from "./schemas/quizSchema.js";
import {
  SYSTEM_INSTRUCTION,
  buildQuizPrompt,
  buildCorrectionPrompt,
  PROMPT_VERSION,
} from "./prompts/quizPrompt.v1.js";

/**
 * Strips markdown code fences if the model happens to return them despite instructions.
 */
function cleanJsonString(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "");
  }
  return cleaned.trim();
}

/**
 * Generates and validates a complete quiz using a self-correction retry loop.
 *
 * @param {Object} options
 * @param {string} options.topic - Topic for the quiz
 * @param {number} [options.count=5] - Number of questions
 * @param {string} [options.difficulty="medium"] - "easy" | "medium" | "hard"
 * @param {number} [options.maxRetries=3] - Maximum retry attempts if validation fails
 * @returns {Promise<{ quiz: Object, metrics: Object }>}
 */
export async function generateQuiz({
  topic,
  count = 5,
  difficulty = "medium",
  maxRetries = 3,
  bypassCache = false,
}) {
  const startTime = Date.now();
  let retryCount = 0;
  let cumulativeTokens = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Turn 1: Initial Generation
  const initialPrompt = buildQuizPrompt({ topic, count, difficulty });
  let response = await generateText({
    prompt: initialPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    bypassCache,
  });

  // Accumulate token usage
  cumulativeTokens.promptTokens += response.usage.promptTokens;
  cumulativeTokens.completionTokens += response.usage.completionTokens;
  cumulativeTokens.totalTokens += response.usage.totalTokens;

  let currentRawText = response.text;
  let validatedData = null;

  // Validation & Retry Loop
  while (retryCount <= maxRetries) {
    let parsedJson = null;

    // 1. Syntactic check: Is it valid JSON?
    try {
      const cleaned = cleanJsonString(currentRawText);
      parsedJson = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn(
        `[Retry ${retryCount + 1}/${maxRetries}] Failed to parse JSON: ${parseError.message}`
      );
      if (retryCount >= maxRetries) {
        throw new Error(
          `Failed to parse LLM response as JSON after ${maxRetries} retries: ${parseError.message}`
        );
      }

      // Prepare correction for invalid JSON syntax
      retryCount++;
      const correctionPrompt = `Your previous output was not valid JSON. Parse error: ${parseError.message}.\n\nOutput only raw, valid JSON.`;
      response = await generateText({
        prompt: correctionPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        bypassCache: true,
      });

      cumulativeTokens.promptTokens += response.usage.promptTokens;
      cumulativeTokens.completionTokens += response.usage.completionTokens;
      cumulativeTokens.totalTokens += response.usage.totalTokens;
      currentRawText = response.text;
      continue;
    }

    // 2. Semantic check: Does it satisfy the Zod QuizSchema?
    const validationResult = QuizSchema.safeParse(parsedJson);

    if (validationResult.success) {
      validatedData = validationResult.data;
      break; // Successfully validated!
    }

    // 3. Validation failed: Prepare correction prompt with exact errors
    const errors = validationResult.error.errors;
    console.warn(
      `[Validation Failed - Attempt ${retryCount + 1}/${maxRetries}] Violations detected:`
    );
    errors.forEach((err) => {
      console.warn(`  - [${err.path.join(".")}] ${err.message}`);
    });

    if (retryCount >= maxRetries) {
      throw new Error(
        `Quiz generation failed schema validation after ${maxRetries} retries. Issues:\n` +
          errors.map((e) => `• ${e.path.join(".")}: ${e.message}`).join("\n")
      );
    }

    // Execute Self-Correction Turn
    retryCount++;
    const correctionPrompt = buildCorrectionPrompt(currentRawText, errors);
    response = await generateText({
      prompt: correctionPrompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      bypassCache: true, // Always bypass cache when correcting an error
    });

    cumulativeTokens.promptTokens += response.usage.promptTokens;
    cumulativeTokens.completionTokens += response.usage.completionTokens;
    cumulativeTokens.totalTokens += response.usage.totalTokens;
    currentRawText = response.text;
  }

  const durationMs = Date.now() - startTime;

  return {
    quiz: validatedData,
    metrics: {
      promptVersion: PROMPT_VERSION,
      latencyMs: durationMs,
      retryCount,
      cached: response.cached,
      tokens: cumulativeTokens,
    },
  };
}
