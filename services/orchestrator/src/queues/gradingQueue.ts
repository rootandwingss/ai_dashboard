import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";

export interface GradingJobData {
  submissionId: string;
  gradeLevel: string;
  templateId: string;
  pageIndex: number;
  pageImageObjectName: string;
  /** Individual question to grade within this page */
  question: {
    questionId: string;
    questionType: number; // 1-14
    expectedAnswer: string;
    boundingBox: { x: number; y: number; w: number; h: number };
    answerKeyMeta?: Record<string, unknown>;
  };
}

export const gradingQueue = new Queue<GradingJobData>("grade-question", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

console.log("[Queue] grade-question queue initialized");
