import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";

export interface PdfSplitJobData {
  submissionId: string;
  pdfObjectName: string;
  gradeLevel: string;
  templateId: string;
}

export const pdfSplitQueue = new Queue<PdfSplitJobData>("pdf-split", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

console.log("[Queue] pdf-split queue initialized");
