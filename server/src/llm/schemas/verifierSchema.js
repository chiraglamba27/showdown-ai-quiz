import { z } from "zod";

/**
 * Zod Schema for the Verifier Output.
 * The Verifier evaluates each question by blind-solving it and auditing options.
 */
export const QuestionAuditSchema = z.object({
  questionIndex: z.number().int().min(0),
  solvedIndex: z.number().int().min(0).max(3),
  confidence: z.number().min(0).max(1),
  isAmbiguous: z.boolean(),
  verdict: z.enum(["PASSED", "WARNING", "FAILED"]),
  reasoning: z.string().trim().min(5),
});

export const QuizAuditReportSchema = z.object({
  audits: z.array(QuestionAuditSchema),
  overallConfidence: z.number().min(0).max(1),
  summary: z.string().trim(),
});
