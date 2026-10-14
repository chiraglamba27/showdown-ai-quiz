import { generateText } from "./client.js";
import { QuestionSchema } from "./schemas/quizSchema.js";
import {
  SYSTEM_INSTRUCTION,
  buildSingleQuestionPrompt,
  buildCorrectionPrompt,
  PROMPT_VERSION,
} from "./prompts/quizPrompt.v1.js";

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
 * Generates a single validated replacement question for granular quiz editing.
 *
 * @param {Object} options
 * @param {string} options.topic - Quiz topic
 * @param {string} [options.difficulty="medium"] - Difficulty
 * @param {Array<string>} [options.existingQuestions=[]] - Existing questions to avoid duplicating
 * @param {number} [options.maxRetries=3]
 * @returns {Promise<{ question: Object, metrics: Object }>}
 */
export async function generateSingleQuestion({
  topic,
  difficulty = "medium",
  existingQuestions = [],
  maxRetries = 3,
}) {
  const startTime = Date.now();
  let retryCount = 0;
  let cumulativeTokens = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  const prompt = buildSingleQuestionPrompt({
    topic,
    difficulty,
    existingQuestions,
  });

  let response = await generateText({
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    bypassCache: true, // Granular regeneration should be fresh
  });

  cumulativeTokens.promptTokens += response.usage.promptTokens;
  cumulativeTokens.completionTokens += response.usage.completionTokens;
  cumulativeTokens.totalTokens += response.usage.totalTokens;

  let currentRawText = response.text;
  let validatedQuestion = null;

  while (retryCount <= maxRetries) {
    let parsed = null;
    try {
      const cleaned = cleanJsonString(currentRawText);
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      if (retryCount >= maxRetries) {
        throw new Error(
          `Failed to parse replacement question JSON after ${maxRetries} retries.`
        );
      }
      retryCount++;
      response = await generateText({
        prompt: `Your output was not valid JSON. Parse error: ${parseError.message}. Return ONLY valid JSON.`,
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

    const validation = QuestionSchema.safeParse(parsed);
    if (validation.success) {
      validatedQuestion = validation.data;
      break;
    }

    if (retryCount >= maxRetries) {
      throw new Error(
        `Replacement question failed validation: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    retryCount++;
    const correctionPrompt = buildCorrectionPrompt(
      currentRawText,
      validation.error.errors
    );
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
  }

  return {
    question: validatedQuestion,
    metrics: {
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startTime,
      retryCount,
      tokens: cumulativeTokens,
    },
  };
}
