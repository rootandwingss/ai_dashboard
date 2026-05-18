import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../../config/redis";
import { prisma } from "../../config/db";
import { minioClient } from "../../config/storage";
import { env } from "../../config/env";
import { GradingJobData } from "../gradingQueue";
import { callVisionEngine, VisionResponse } from "../../services/visionClient";

/**
 * Grading Worker
 * 1. Downloads the page image from MinIO
 * 2. Crops the question region using the bounding box
 * 3. Sends the cropped image to the Python Vision Engine
 * 4. Stores the result or creates an Exception if confidence is low
 */
const gradingWorker = new Worker<GradingJobData>(
  "grade-question",
  async (job: Job<GradingJobData>) => {
    const { submissionId, gradeLevel, pageImageObjectName, question } = job.data;

    console.log(`[GradingWorker] Grading ${question.questionId} for submission ${submissionId}`);

    try {
      // 1. Download the page image from MinIO
      const stream = await minioClient.getObject(env.MINIO_BUCKET, pageImageObjectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const imageBuffer = Buffer.concat(chunks);
      const imageB64 = imageBuffer.toString("base64");

      // 2. Call the Vision Engine
      const visionResult: VisionResponse = await callVisionEngine({
        image_b64: imageB64,
        question_type: question.questionType,
        grade_level: gradeLevel,
        expected_answer: question.expectedAnswer,
        bounding_box: question.boundingBox,
        answer_key_meta: question.answerKeyMeta || {},
      });

      // 3. Store cropped image for reference (if the vision engine returns one)
      let croppedImgUrl: string | null = null;
      if (visionResult.cropped_b64) {
        const croppedObjectName = `cropped/${submissionId}/${question.questionId}.png`;
        const croppedBuffer = Buffer.from(visionResult.cropped_b64, "base64");
        await minioClient.putObject(env.MINIO_BUCKET, croppedObjectName, croppedBuffer, croppedBuffer.length, {
          "Content-Type": "image/png",
        });
        croppedImgUrl = croppedObjectName;
      }

      // 4. Create QuestionResult
      await prisma.questionResult.create({
        data: {
          submissionId,
          questionId: question.questionId,
          questionType: question.questionType,
          engine: visionResult.engine,
          score: visionResult.flag_exception ? 0 : visionResult.score,
          maxScore: visionResult.max_score,
          confidence: visionResult.confidence,
          details: visionResult.details as any,
          croppedImgUrl,
        },
      });

      // 5. If confidence is below gate, create an Exception
      if (visionResult.flag_exception) {
        await prisma.exception.create({
          data: {
            submissionId,
            questionId: question.questionId,
            croppedImgUrl: croppedImgUrl || pageImageObjectName,
            ocrText: visionResult.details?.ocr_raw as string || null,
            expected: question.expectedAnswer,
            confidence: visionResult.confidence,
            engine: visionResult.engine,
          },
        });

        console.log(`[GradingWorker] Exception flagged for ${question.questionId} (confidence: ${visionResult.confidence})`);
      }

      // 6. Check if all questions for this submission are done
      await updateSubmissionStatus(submissionId);
    } catch (error) {
      console.error(`[GradingWorker] Error grading ${question.questionId}:`, error);
      throw error; // Let BullMQ retry
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 10,
  }
);

/**
 * After each question is graded, check if the submission is complete.
 */
async function updateSubmissionStatus(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { questions: true, exceptions: true },
  });

  if (!submission) return;

  // Count expected total questions from answer key (we track via queued jobs)
  // For now, we check if grading queue has pending jobs for this submission
  const results = submission.questions;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.reduce((sum, r) => sum + r.maxScore, 0);
  const pendingExceptions = submission.exceptions.filter((e) => e.status === "pending").length;

  const status = pendingExceptions > 0 ? "has_exceptions" : "completed";

  await prisma.submission.update({
    where: { id: submissionId },
    data: { totalScore, maxScore, status },
  });
}

gradingWorker.on("failed", (job, err) => {
  console.error(`[GradingWorker] Job ${job?.id} failed:`, err.message);
});

gradingWorker.on("completed", (job) => {
  console.log(`[GradingWorker] Job ${job.id} completed`);
});

export { gradingWorker };
