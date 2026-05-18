import { Router, Request, Response } from "express";
import { prisma, mockDb } from "../config/db";
import { env } from "../config/env";

export const resultsRouter = Router();

resultsRouter.get("/:submissionId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params;

    if (env.MOCK_MODE) {
      const submission = mockDb.submissions.get(submissionId);
      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }
      res.json({
        submission_id: submission.id,
        grade_level: submission.gradeLevel,
        template_id: submission.templateId,
        status: submission.status,
        total_score: submission.totalScore,
        max_score: submission.maxScore,
        questions: submission.questions || [],
        exceptions: [],
      });
      return;
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        questions: { orderBy: { questionId: "asc" } },
        exceptions: { where: { status: "pending" }, select: { id: true, questionId: true } },
      },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({
      submission_id: submission.id,
      grade_level: submission.gradeLevel,
      template_id: submission.templateId,
      status: submission.status,
      total_score: submission.totalScore,
      max_score: submission.maxScore,
      questions: submission.questions.map((q) => ({
        question_id: q.questionId,
        type: q.questionType,
        engine: q.engine,
        score: q.score,
        max_score: q.maxScore,
        confidence: q.confidence,
      })),
      exceptions: submission.exceptions.map((e) => e.id),
    });
  } catch (error) {
    console.error("[Results] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

resultsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (env.MOCK_MODE) {
      const allSubmissions = Array.from(mockDb.submissions.values());
      const total = allSubmissions.length;
      const items = allSubmissions.slice((page - 1) * limit, page * limit).map((s) => ({
        id: s.id,
        studentId: s.studentId,
        gradeLevel: s.gradeLevel,
        templateId: s.templateId,
        status: s.status,
        totalScore: s.totalScore,
        maxScore: s.maxScore,
        createdAt: s.createdAt,
      }));
      res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
      return;
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, studentId: true, gradeLevel: true, templateId: true, status: true, totalScore: true, maxScore: true, createdAt: true },
      }),
      prisma.submission.count(),
    ]);

    res.json({ items: submissions, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("[Results] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

resultsRouter.post("/:submissionId/approve", async (req: Request, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params;
    const { score } = req.body;

    if (env.MOCK_MODE) {
      const submission = mockDb.submissions.get(submissionId);
      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }
      submission.status = "completed";
      if (score !== undefined) submission.totalScore = score;
      mockDb.submissions.set(submissionId, submission);
      res.json({ success: true, submission_id: submissionId });
      return;
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        status: "completed",
        totalScore: score !== undefined ? score : undefined
      },
    });

    res.json({ success: true, submission_id: submissionId });
  } catch (error) {
    console.error("[Results] Approve Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});