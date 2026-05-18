import { Worker, Job } from "bullmq";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { createRedisConnection } from "../../config/redis";
import { prisma } from "../../config/db";
import { minioClient } from "../../config/storage";
import { env } from "../../config/env";
import { gradingQueue, GradingJobData } from "../gradingQueue";
import { PdfSplitJobData } from "../pdfSplitQueue";
import { loadAnswerKey, AnswerKey } from "../../services/answerKeyService";

/**
 * PDF Split Worker
 * 1. Downloads the PDF from MinIO
 * 2. Converts each page to a PNG image using pdf-poppler
 * 3. Uploads page images back to MinIO
 * 4. Reads the answer-key JSON for the template
 * 5. Enqueues one grade-question job per question
 */
const pdfSplitWorker = new Worker<PdfSplitJobData>(
  "pdf-split",
  async (job: Job<PdfSplitJobData>) => {
    const { submissionId, pdfObjectName, gradeLevel, templateId } = job.data;

    console.log(`[PdfSplitWorker] Processing submission ${submissionId}`);

    // Update status to "splitting"
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "splitting" },
    });

    // Create temp directory for processing
    const tmpDir = path.join(os.tmpdir(), `olympiad-${submissionId}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      // 1. Download PDF from MinIO
      const pdfPath = path.join(tmpDir, "input.pdf");
      const stream = await minioClient.getObject(env.MINIO_BUCKET, pdfObjectName);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      await fs.writeFile(pdfPath, Buffer.concat(chunks));

      // 2. Convert PDF pages to PNG images using pdf-poppler
      const pdfPoppler = await import("pdf-poppler");
      const opts = {
        format: "png" as const,
        out_dir: tmpDir,
        out_prefix: "page",
        scale: 2048, // High-resolution for better OCR/CV
      };

      await pdfPoppler.convert(pdfPath, opts);

      // 3. Find generated page images
      const files = await fs.readdir(tmpDir);
      const pageFiles = files
        .filter((f) => f.startsWith("page") && f.endsWith(".png"))
        .sort();

      // Update page count
      await prisma.submission.update({
        where: { id: submissionId },
        data: { pageCount: pageFiles.length, status: "grading" },
      });

      // 4. Load answer key for this template
      const answerKey: AnswerKey = loadAnswerKey(templateId);

      // 5. Upload each page and enqueue grading jobs
      for (let i = 0; i < pageFiles.length; i++) {
        const pageBuffer = await fs.readFile(path.join(tmpDir, pageFiles[i]));
        const pageObjectName = `pages/${submissionId}/page-${i}.png`;

        await minioClient.putObject(env.MINIO_BUCKET, pageObjectName, pageBuffer, pageBuffer.length, {
          "Content-Type": "image/png",
        });

        // Get questions for this page from the answer key
        const pageQuestions = answerKey.pages[i]?.questions || [];

        for (const question of pageQuestions) {
          const jobData: GradingJobData = {
            submissionId,
            gradeLevel,
            templateId,
            pageIndex: i,
            pageImageObjectName: pageObjectName,
            question: {
              questionId: question.id,
              questionType: question.type,
              expectedAnswer: question.expectedAnswer,
              boundingBox: question.boundingBox,
              answerKeyMeta: question.meta,
            },
          };

          await gradingQueue.add(`grade-${submissionId}-${question.id}`, jobData);
        }
      }

      console.log(`[PdfSplitWorker] Enqueued ${pageFiles.length} pages for submission ${submissionId}`);
    } finally {
      // Cleanup temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 3,
  }
);

pdfSplitWorker.on("failed", (job, err) => {
  console.error(`[PdfSplitWorker] Job ${job?.id} failed:`, err.message);
});

pdfSplitWorker.on("completed", (job) => {
  console.log(`[PdfSplitWorker] Job ${job.id} completed`);
});

export { pdfSplitWorker };
