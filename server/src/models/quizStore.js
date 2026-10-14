import crypto from "crypto";

/**
 * In-memory repository for quizzes.
 * Provides instant persistence without external database dependencies or connection failures.
 */
class QuizStore {
  constructor() {
    this.quizzes = new Map();
  }

  create({ title, topic, difficulty, questions, metrics }) {
    const id = crypto.randomUUID();
    const doc = {
      _id: id,
      id,
      title: title || `${topic} Quiz`,
      topic,
      difficulty: difficulty || "medium",
      questions,
      metrics: metrics || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.quizzes.set(id, doc);
    return doc;
  }

  findAll() {
    return Array.from(this.quizzes.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  findById(id) {
    return this.quizzes.get(id) || null;
  }

  update(id, { title, topic, difficulty, questions }) {
    const existing = this.quizzes.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      title: title ?? existing.title,
      topic: topic ?? existing.topic,
      difficulty: difficulty ?? existing.difficulty,
      questions: questions ?? existing.questions,
      updatedAt: new Date().toISOString(),
    };
    this.quizzes.set(id, updated);
    return updated;
  }

  delete(id) {
    return this.quizzes.delete(id);
  }
}

export const quizStore = new QuizStore();
