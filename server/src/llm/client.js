import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// In-memory cache to store identical generation requests
// Map<hashKey, { text: string, usage: object, cachedAt: number }>
const promptCache = new Map();

/**
 * Creates an instance of GoogleGenAI client using the configured API key.
 */
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not defined. Please set it in your .env file."
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Computes a SHA-256 hash of the input parameters to use as a cache key.
 */
function computeCacheKey(model, systemInstruction, prompt, responseMimeType) {
  const payload = JSON.stringify({
    model,
    systemInstruction,
    prompt,
    responseMimeType,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Checks whether an error is transient (e.g. 503 high demand, 429 rate limit).
 */
function isTransientError(error) {
  const msg = (error?.message || "").toLowerCase();
  const status = error?.status || error?.code || "";
  return (
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("resource_exhausted") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    status === 503 ||
    status === 429 ||
    status === "ETIMEDOUT" ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED"
  );
}

/**
 * Helper to sleep for a specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core LLM generation wrapper with automatic exponential backoff for transient 503/429 errors.
 *
 * @param {Object} options
 * @param {string} options.prompt - The user prompt string
 * @param {string} [options.systemInstruction] - Optional system instructions
 * @param {string} [options.responseMimeType="application/json"] - Output format MIME type
 * @param {boolean} [options.bypassCache=false] - If true, ignores the cache and forces a fresh call
 * @param {number} [options.maxNetworkRetries=3] - Maximum retry attempts for transient network/server errors
 * @returns {Promise<{ text: string, usage: Object, cached: boolean }>}
 */
export async function generateText({
  prompt,
  systemInstruction,
  responseMimeType = "application/json",
  bypassCache = false,
  maxNetworkRetries = 3,
}) {
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const cacheKey = computeCacheKey(
    configuredModel,
    systemInstruction,
    prompt,
    responseMimeType
  );

  // 1. Check cache first
  if (!bypassCache && promptCache.has(cacheKey)) {
    const cachedEntry = promptCache.get(cacheKey);
    return {
      text: cachedEntry.text,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      cached: true,
    };
  }

  // 2. Prepare API call configuration
  const ai = getClient();
  const config = {
    responseMimeType,
    temperature: 0.7,
  };

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  // List of models to try: configured model first, followed by active fallbacks
  const candidateModels = [
    configuredModel,
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ];
  // Remove duplicates while keeping order
  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

  let lastError = null;

  for (const modelToUse of uniqueModels) {
    for (let attempt = 0; attempt <= maxNetworkRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: prompt,
          config,
        });

        const text = response.text || "";

        // Extract token metrics
        const usageMetadata = response.usageMetadata || {};
        const usage = {
          promptTokens: usageMetadata.promptTokenCount || 0,
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0,
        };

        // Save to cache
        promptCache.set(cacheKey, {
          text,
          usage,
          cachedAt: Date.now(),
        });

        return {
          text,
          usage,
          cached: false,
        };
      } catch (error) {
        lastError = error;

        const errMsg = (error?.message || "").toLowerCase();
        const isNotFound =
          errMsg.includes("not found") ||
          errMsg.includes("no longer available") ||
          error?.status === 404;

        if (isNotFound) {
          console.warn(
            `[Model 404] ${modelToUse} is unavailable or deprecated. Falling back to next candidate model...`
          );
          break; // Try next candidate model immediately without retrying deprecated model
        }

        if (isTransientError(error) && attempt < maxNetworkRetries) {
          // Exponential backoff with jitter: (2^attempt * 1000ms) + random jitter (0-500ms)
          const backoffMs =
            Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          console.warn(
            `[API 503/429 - ${modelToUse}] Server busy (attempt ${
              attempt + 1
            }/${maxNetworkRetries}). Retrying in ${backoffMs}ms...`
          );
          await sleep(backoffMs);
        } else if (isTransientError(error) && attempt === maxNetworkRetries) {
          console.warn(
            `[API 503 Exhausted] ${modelToUse} remained unavailable after ${maxNetworkRetries} retries. Attempting fallback model...`
          );
          break; // Break inner loop to try next model in candidateModels
        } else {
          // Non-transient error (e.g. invalid API key) -> break to next model or throw
          console.warn(
            `[API Error - ${modelToUse}] Error: ${error.message}. Attempting next model...`
          );
          break;
        }
      }
    }
  }

  throw lastError;
}

/**
 * Streams tokens from the LLM using generateContentStream.
 * Yields chunks of { text, model }.
 */
export async function* generateTextStream({
  prompt,
  systemInstruction,
  responseMimeType = "application/json",
}) {
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const ai = getClient();
  const config = {
    responseMimeType,
    temperature: 0.7,
  };

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  const candidateModels = [
    configuredModel,
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
  ];
  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

  let lastError = null;

  for (const modelToUse of uniqueModels) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelToUse,
        contents: prompt,
        config,
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        if (text) {
          yield { text, model: modelToUse };
        }
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[Stream Error - ${modelToUse}]: ${error.message}. Attempting fallback candidate model...`
      );
    }
  }

  throw lastError;
}

/**
 * Clears the in-memory cache (useful for testing or resetting).
 */
export function clearCache() {
  promptCache.clear();
}
