/**
 * LLM Verifier Prompt Module (Version 1)
 * Prompts the secondary model to independently blind-solve questions
 * and verify technical precision, distractor plausibility, and answer consensus.
 */

export const VERIFIER_SYSTEM_INSTRUCTION = `You are a Principal Technical Auditor and Examiner Judge.
Your mission is to perform a rigorous quality assurance audit on a set of generated multiple-choice questions.

For each question:
1. Blindly solve it yourself based ONLY on the question stem and the 4 options.
2. Determine which option (0, 1, 2, or 3) is objectively, scientifically correct.
3. Assess whether the question is ambiguous (e.g. multiple defensible answers or unclear terminology).
4. Assign a verdict:
   - "PASSED": The question has exactly ONE unequivocally correct answer.
   - "WARNING": Minor phrasing ambiguity exists, but one answer is clearly superior.
   - "FAILED": Multiple answers could be argued, or none of the options are correct.
5. Provide concise rationale for your verdict.

Output MUST be valid JSON strictly matching the requested schema. No markdown fences, no conversational prose.`;

export function buildVerifierPrompt(questions) {
  // Strip correctIndex and explanation so the Verifier acts as a true independent blind judge!
  const blindQuestions = questions.map((q, idx) => ({
    questionIndex: idx,
    question: q.question,
    options: q.options,
  }));

  return `AUDIT THE FOLLOWING TECHNICAL QUESTIONS:

${JSON.stringify(blindQuestions, null, 2)}

Produce a JSON object with this exact structure:
{
  "audits": [
    {
      "questionIndex": 0,
      "solvedIndex": 1,
      "confidence": 0.98,
      "isAmbiguous": false,
      "verdict": "PASSED",
      "reasoning": "Option B is mathematically and logically sound according to RFC specifications."
    }
  ],
  "overallConfidence": 0.98,
  "summary": "All questions have clear, unambiguous consensus keys."
}`;
}
