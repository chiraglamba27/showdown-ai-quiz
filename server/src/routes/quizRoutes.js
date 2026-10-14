import express from "express";
import rateLimit from "express-rate-limit";
import { generateQuiz } from "../llm/generateQuiz.js";
import { generateSingleQuestion } from "../llm/generateSingleQuestion.js";
import { quizStore } from "../models/quizStore.js";
import { QuizSchema } from "../llm/schemas/quizSchema.js";

const router = express.Router();

/**
 * Rate Limiter for LLM Generation Endpoints.
 * Protects against accidental runaway costs, quota exhaustion, and denial-of-wallet.
 */
const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 quiz generations per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Generation rate limit exceeded. Please wait a few minutes before generating more quizzes.",
  },
});

import { streamQuiz } from "../llm/streamQuiz.js";
import { verifyQuiz } from "../llm/verifyQuiz.js";
import { parsePromptIntent } from "../llm/prompts/quizPrompt.v1.js";

/**
 * Helper to write SSE frame.
 */
function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Shared handler for progressive SSE question generation.
 */
const handleGenerateStream = async (req, res) => {
  const rawTopic = req.query.topic || req.body?.topic;
  const rawCount = req.query.count || req.body?.count;
  const rawDifficulty = req.query.difficulty || req.body?.difficulty;

  if (!rawTopic || typeof rawTopic !== "string" || rawTopic.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: "Topic is required and must be at least 2 characters.",
    });
  }

  // Parse prompt intent: extracts count & difficulty if present in prompt;
  // otherwise gracefully falls back to the manual button parameters.
  const parsedIntent = parsePromptIntent(rawTopic, rawCount, rawDifficulty);
  const topic = parsedIntent.cleanTopic;
  const questionCount = parsedIntent.count;
  const validDifficulty = parsedIntent.difficulty;

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let isClosed = false;
  req.on("close", () => {
    isClosed = true;
  });

  try {
    sendSSE(res, "start", {
      topic: topic.trim(),
      count: questionCount,
      difficulty: validDifficulty,
    });

    const result = await streamQuiz({
      topic: topic.trim(),
      count: questionCount,
      difficulty: validDifficulty,
      onQuestion: (question, index) => {
        if (!isClosed) {
          sendSSE(res, "question", {
            index,
            question,
            totalExpected: questionCount,
          });
        }
      },
      onToken: (token) => {
        if (!isClosed) {
          sendSSE(res, "token", { length: token.length });
        }
      },
    });

    if (!isClosed) {
      sendSSE(res, "complete", {
        success: true,
        data: {
          topic: result.topic,
          questions: result.questions,
          difficulty: result.difficulty,
        },
        metrics: result.metrics,
      });
      res.end();
    }
  } catch (error) {
    console.error("[Route Error /generate-stream]:", error);
    if (!isClosed) {
      sendSSE(res, "error", {
        error: error.message || "Streaming generation failed",
      });
      res.end();
    }
  }
};

/**
 * GET & POST /api/quizzes/generate-stream
 * Streams quiz questions progressively via Server-Sent Events (SSE).
 */
router.get("/generate-stream", generationLimiter, handleGenerateStream);
router.post("/generate-stream", generationLimiter, handleGenerateStream);

/**
 * POST /api/quizzes/generate
 * Generates a full quiz via Gemini + Zod validation loop.
 */
router.post("/generate", generationLimiter, async (req, res) => {
  try {
    const { topic: rawTopic, count: rawCount, difficulty: rawDifficulty, bypassCache } = req.body;

    if (!rawTopic || typeof rawTopic !== "string" || rawTopic.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Topic is required and must be at least 2 characters.",
      });
    }

    // Harmonize prompt text with manual button defaults
    const parsedIntent = parsePromptIntent(rawTopic, rawCount, rawDifficulty);
    const topic = parsedIntent.cleanTopic;
    const questionCount = parsedIntent.count;
    const validDifficulty = parsedIntent.difficulty;

    const result = await generateQuiz({
      topic,
      count: questionCount,
      difficulty: validDifficulty,
      bypassCache: bypassCache !== undefined ? Boolean(bypassCache) : true,
    });

    res.json({
      success: true,
      data: result.quiz,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error("[Route Error /generate]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate quiz",
    });
  }
});

/**
 * POST /api/quizzes/regenerate-question
 * Granular replacement of a single question within a quiz.
 */
router.post("/regenerate-question", generationLimiter, async (req, res) => {
  try {
    const { topic, difficulty, existingQuestions } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: "Topic is required for single question regeneration.",
      });
    }

    const result = await generateSingleQuestion({
      topic,
      difficulty: difficulty || "medium",
      existingQuestions: Array.isArray(existingQuestions) ? existingQuestions : [],
    });

    res.json({
      success: true,
      data: result.question,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error("[Route Error /regenerate-question]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to regenerate question",
    });
  }
});

/**
 * POST /api/quizzes/verify
 * Phase 4: Executes a blind LLM-as-a-Judge audit pass on questions.
 */
router.post("/verify", generationLimiter, async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Questions array is required for verification audit.",
      });
    }

    const report = await verifyQuiz(questions);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("[Route Error /verify]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "LLM verification audit failed",
    });
  }
});

/**
 * POST /api/quizzes
 * Persists a validated quiz to in-memory store.
 */
router.post("/", async (req, res) => {
  try {
    const { title, topic, difficulty, questions, metrics } = req.body;

    // Validate using Zod before allowing save
    const validation = QuizSchema.safeParse({ topic, questions });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Quiz payload failed schema validation",
        details: validation.error.errors,
      });
    }

    const savedQuiz = quizStore.create({
      title: title || `${topic} Quiz`,
      topic,
      difficulty: difficulty || "medium",
      questions: validation.data.questions,
      metrics: metrics || {},
    });

    res.status(201).json({ success: true, data: savedQuiz });
  } catch (error) {
    console.error("[Route Error POST /]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save quiz",
    });
  }
});

/**
 * GET /api/quizzes
 * Retrieves all saved quizzes.
 */
router.get("/", (req, res) => {
  try {
    const quizzes = quizStore.findAll();
    res.json({ success: true, data: quizzes });
  } catch (error) {
    console.error("[Route Error GET /]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve quizzes",
    });
  }
});

/**
 * GET /api/quizzes/:id
 * Retrieves a single quiz by ID.
 */
router.get("/:id", (req, res) => {
  try {
    const quiz = quizStore.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, error: "Quiz not found" });
    }
    res.json({ success: true, data: quiz });
  } catch (error) {
    console.error("[Route Error GET /:id]:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve quiz" });
  }
});

/**
 * PUT /api/quizzes/:id
 * Updates an existing quiz.
 */
router.put("/:id", (req, res) => {
  try {
    const { title, topic, difficulty, questions } = req.body;

    // Validate updated questions
    const validation = QuizSchema.safeParse({ topic, questions });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Updated quiz failed validation",
        details: validation.error.errors,
      });
    }

    const updated = quizStore.update(req.params.id, {
      title,
      topic,
      difficulty,
      questions: validation.data.questions,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: "Quiz not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Route Error PUT /:id]:", error);
    res.status(500).json({ success: false, error: "Failed to update quiz" });
  }
});

/**
 * DELETE /api/quizzes/:id
 * Deletes a quiz by ID.
 */
router.delete("/:id", (req, res) => {
  try {
    const deleted = quizStore.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Quiz not found" });
    }
    res.json({ success: true, message: "Quiz successfully deleted" });
  } catch (error) {
    console.error("[Route Error DELETE /:id]:", error);
    res.status(500).json({ success: false, error: "Failed to delete quiz" });
  }
});

export default router;
