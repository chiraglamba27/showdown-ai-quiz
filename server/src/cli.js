import { generateQuiz } from "./llm/generateQuiz.js";

/**
 * Parses user input from CLI args.
 * Supports strings like "5 medium MCQs on DBMS normalization" or just "DBMS normalization".
 */
function parseArgs(args) {
  const fullInput = args.join(" ").trim() || "5 medium MCQs on DBMS normalization";

  let count = 5;
  let difficulty = "medium";
  let topic = fullInput;

  // Extract question count (e.g. "2 medium mcqs", "10 questions", "3 mcqs", or any number)
  const countMatch = fullInput.match(/\b(\d+)\s*(?:(?:easy|medium|hard)\s*)?(?:questions?|mcqs?)?/i);
  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      count = parsed;
    }
  }

  // Extract difficulty if present ("easy", "medium", "hard")
  const diffMatch = fullInput.match(/\b(easy|medium|hard)\b/i);
  if (diffMatch) {
    difficulty = diffMatch[1].toLowerCase();
  }

  // Extract topic after "on" or "about"
  const topicMatch = fullInput.match(/(?:on|about)\s+(.+)$/i);
  if (topicMatch) {
    topic = topicMatch[1].trim();
  } else {
    // Strip count/difficulty words to isolate topic
    topic = fullInput
      .replace(/\b\d+\b/g, "")
      .replace(/\b(easy|medium|hard)\b/gi, "")
      .replace(/\b(questions?|mcqs?)\b/gi, "")
      .trim();
  }

  return { topic: topic || "Computer Science Fundamentals", count, difficulty };
}

async function main() {
  const userArgs = process.argv.slice(2);
  const { topic, count, difficulty } = parseArgs(userArgs);

  console.log("==================================================");
  console.log("       AI QUIZ GENERATOR (PHASE 1 CLI)            ");
  console.log("==================================================");
  console.log(`Topic:      "${topic}"`);
  console.log(`Count:      ${count} questions`);
  console.log(`Difficulty: ${difficulty}`);
  console.log("--------------------------------------------------");
  console.log("Generating with Gemini + Zod Self-Correction...\n");

  try {
    const result = await generateQuiz({ topic, count, difficulty });
    const { quiz, metrics } = result;

    console.log(`SUCCESS! Generated ${quiz.questions.length} questions for: "${quiz.topic}"\n`);

    quiz.questions.forEach((q, idx) => {
      console.log(`Q${idx + 1}. [${q.difficulty.toUpperCase()}] ${q.question}`);
      const letters = ["A", "B", "C", "D"];
      q.options.forEach((opt, optIdx) => {
        const isCorrect = optIdx === q.correctIndex;
        const mark = isCorrect ? " [CORRECT]" : "";
        console.log(`   ${letters[optIdx]}) ${opt}${mark}`);
      });
      console.log(`   Explanation: ${q.explanation}\n`);
    });

    // Estimate cost: Flash 2.5 is ~$0.10 per 1M input, ~$0.40 per 1M output
    const promptCost = (metrics.tokens.promptTokens / 1_000_000) * 0.10;
    const completionCost = (metrics.tokens.completionTokens / 1_000_000) * 0.40;
    const totalCost = promptCost + completionCost;

    console.log("==================================================");
    console.log("               METRICS & TELEMETRY                ");
    console.log("==================================================");
    console.log(`Prompt Version:  ${metrics.promptVersion}`);
    console.log(`Latency:         ${metrics.latencyMs} ms (${(metrics.latencyMs / 1000).toFixed(2)}s)`);
    console.log(`Retries Needed:  ${metrics.retryCount} (0 = clean first pass)`);
    console.log(`Cache Status:    ${metrics.cached ? "HIT (0 tokens used)" : "MISS (fresh API call)"}`);
    console.log(`Prompt Tokens:   ${metrics.tokens.promptTokens}`);
    console.log(`Output Tokens:   ${metrics.tokens.completionTokens}`);
    console.log(`Total Tokens:    ${metrics.tokens.totalTokens}`);
    console.log(`Estimated Cost:  $${totalCost.toFixed(6)} USD`);
    console.log("==================================================\n");

  } catch (error) {
    console.error("\nERROR: Quiz generation failed!");
    console.error(error.message);
    process.exit(1);
  }
}

main();
