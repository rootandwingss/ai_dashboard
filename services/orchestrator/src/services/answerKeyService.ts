import path from "path";
import fs from "fs";

/**
 * Answer Key Schema
 * Each template has a JSON file describing the questions on each page.
 */
export interface AnswerKeyQuestion {
  id: string;
  type: number; // 1-14
  expectedAnswer: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  meta?: Record<string, unknown>;
}

export interface AnswerKeyPage {
  pageIndex: number;
  questions: AnswerKeyQuestion[];
}

export interface AnswerKey {
  templateId: string;
  gradeLevel: string;
  totalPages: number;
  pages: AnswerKeyPage[];
}

const ANSWER_KEYS_DIR = path.resolve(__dirname, "../../../../shared/answer-keys");

/**
 * Load an answer-key JSON file by template ID.
 * Files are expected at: shared/answer-keys/<templateId>.json
 */
export function loadAnswerKey(templateId: string): AnswerKey {
  const filePath = path.join(ANSWER_KEYS_DIR, `${templateId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Answer key not found for template: ${templateId} (looked at ${filePath})`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed: AnswerKey = JSON.parse(raw);

  // Basic validation
  if (!parsed.pages || !Array.isArray(parsed.pages)) {
    throw new Error(`Invalid answer key format for template: ${templateId}`);
  }

  return parsed;
}

/**
 * List all available template IDs.
 */
export function listTemplates(): string[] {
  if (!fs.existsSync(ANSWER_KEYS_DIR)) return [];
  return fs
    .readdirSync(ANSWER_KEYS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
