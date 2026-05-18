import { Router, Request, Response } from "express";
import { prisma, mockDb } from "../config/db";
import { env } from "../config/env";

export const exceptionsRouter = Router();

exceptionsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || "pending";

    if (env.MOCK_MODE) {
      const allExceptions = Array.from(mockDb.exceptions.values());
      const filtered = allExceptions.filter((e) => e.status === status);
      res.json({
        items: filtered,
        total: filtered.length,
        page: 1,
        pages: 1,
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.exception.findMany({
        where: { status },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          submission: { select: { gradeLevel: true, templateId: true, studentId: true } },
        },
      }),
      prisma.exception.count({ where: { status } }),
    ]);

    res.json({
      items: items.map((e) => ({
        exception_id: e.id,
        submission_id: e.submissionId,
        question_id: e.questionId,
        cropped_image_url: e.croppedImgUrl,
        ocr_text: e.ocrText,
        expected: e.expected,
        confidence: e.confidence,
        engine: e.engine,
        grade_level: e.submission.gradeLevel,
        status: e.status,
        created_at: e.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Exceptions] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

exceptionsRouter.post("/:id/resolve", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { verdict } = req.body;

    if (!verdict || !["approve", "reject"].includes(verdict)) {
      res.status(400).json({ error: "verdict must be 'approve' or 'reject'" });
      return;
    }

    if (env.MOCK_MODE) {
      const exception = mockDb.exceptions.get(id);
      if (!exception) {
        res.status(404).json({ error: "Exception not found" });
        return;
      }
      exception.status = verdict === "approve" ? "approved" : "rejected";
      mockDb.exceptions.set(id, exception);
      res.json({ exception_id: id, resolved: true, score_awarded: verdict === "approve" ? 1.0 : 0.0 });
      return;
    }

    const exception = await prisma.exception.findUnique({ where: { id } });
    if (!exception) {
      res.status(404).json({ error: "Exception not found" });
      return;
    }

    if (exception.status !== "pending") {
      res.status(409).json({ error: "Exception already resolved" });
      return;
    }

    const scoreAwarded = verdict === "approve" ? 1.0 : 0.0;

    await prisma.exception.update({
      where: { id },
      data: { status: verdict === "approve" ? "approved" : "rejected", scoreAwarded, resolvedAt: new Date() },
    });

    await prisma.questionResult.updateMany({
      where: { submissionId: exception.submissionId, questionId: exception.questionId },
      data: { score: scoreAwarded },
    });

    const results = await prisma.questionResult.findMany({ where: { submissionId: exception.submissionId } });
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = results.reduce((sum, r) => sum + r.maxScore, 0);

    const pendingCount = await prisma.exception.count({ where: { submissionId: exception.submissionId, status: "pending" } });

    await prisma.submission.update({
      where: { id: exception.submissionId },
      data: { totalScore, maxScore, status: pendingCount === 0 ? "completed" : "has_exceptions" },
    });

    res.json({ exception_id: id, resolved: true, score_awarded: scoreAwarded });
  } catch (error) {
    console.error("[Exceptions] Resolve error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});