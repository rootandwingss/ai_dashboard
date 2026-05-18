import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { prisma, mockDb } from "../config/db";
import { env } from "../config/env";
import { minioClient } from "../config/storage";
import { validateTemplate } from "../services/visionClient";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export const uploadRouter = Router();

// ─── Get Schools ───────────────────────────────────────────
uploadRouter.get("/schools", async (_req: Request, res: Response): Promise<void> => {
  if (env.MOCK_MODE) {
    const schools = Array.from(mockDb.schools.values());
    res.json({ schools });
    return;
  }
  const schools = await prisma.school.findMany();
  res.json({ schools });
});

// ─── Get Students ──────────────────────────────────────────
uploadRouter.get("/students", async (req: Request, res: Response): Promise<void> => {
  const { school_id } = req.query;
  
  if (env.MOCK_MODE) {
    let students = Array.from(mockDb.students.values());
    if (school_id) {
      students = students.filter((s) => s.schoolId === school_id);
    }
    res.json({ students });
    return;
  }

  const where = school_id ? { schoolId: school_id as string } : {};
  const students = await prisma.student.findMany({ where });
  res.json({ students });
});

// ─── Get Student Page Progress (20-slot grid) ───────────────
uploadRouter.get("/students/:studentId/pages", async (req: Request, res: Response): Promise<void> => {
  const { studentId } = req.params;

  if (env.MOCK_MODE) {
    const pages: { pageNumber: number; status: string; aiConfidence: number | null }[] = [];
    for (let p = 1; p <= 20; p++) {
      const key = `${studentId}-${p}`;
      const sub = mockDb.submissions.get(key);
      pages.push({
        pageNumber: p,
        status: sub?.status || "Missing",
        aiConfidence: sub?.aiConfidence || null,
      });
    }
    res.json({ pages });
    return;
  }

  const submissions = await prisma.submission.findMany({
    where: { studentId },
    select: { pageNumber: true, status: true, aiConfidence: true },
  });

  const pages: any[] = [];
  for (let p = 1; p <= 20; p++) {
    const sub = submissions.find((s) => s.pageNumber === p);
    pages.push({
      pageNumber: p,
      status: sub?.status || "Missing",
      aiConfidence: sub?.aiConfidence || null,
    });
  }
  res.json({ pages });
});

// ─── Upload Page ───────────────────────────────────────────
uploadRouter.post("/", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const { student_id, page_number, template_id } = req.body;
    const pageNum = parseInt(page_number) || 1;
    const templateId = template_id || "nursery_worksheet_01";

    // Validate
    if (!student_id) {
      res.status(400).json({ error: "student_id is required" });
      return;
    }
    if (pageNum < 1 || pageNum > 20) {
      res.status(400).json({ error: "page_number must be between 1 and 20" });
      return;
    }

    if (env.MOCK_MODE) {
      const key = `${student_id}-${pageNum}`;
      // Remove duplicate check to allow re-uploads!

      // Validate student exists
      const student = mockDb.students.get(student_id);
      console.log("[Upload] student_id:", student_id);
      console.log("[Upload] student found:", student);
      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }

      // Get expected questions from template
      const template = mockDb.templates.get(templateId);
      if (!template) {
        res.status(400).json({ error: "Template not found" });
        return;
      }
      const expectedPage = template.pages.find((p: any) => p.pageNumber === pageNum);
      if (!expectedPage) {
        res.status(400).json({ error: `Page ${pageNum} not defined in template` });
        return;
      }

      const expectedType = expectedPage.questionType;
      const expectedDesc = expectedPage.description;
      const questions = expectedPage.questions || [];

      // 1. Structural Validation Gate (Feature Matching)
      let templateB64 = "";
      try {
        const templateObjectName = `templates/${templateId}/page-${pageNum}.png`;
        const stream = await minioClient.getObject(env.MINIO_BUCKET, templateObjectName);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        templateB64 = Buffer.concat(chunks).toString("base64");
      } catch (err) {
        console.log(`[Upload] Template image not found for validation (skipping structural check): templates/${templateId}/page-${pageNum}.png`);
      }
      
      let studentB64 = file.buffer.toString("base64");

      // Auto-align and Warp Perspective using Computer Vision markers
      try {
        const { alignWorksheetPerspective } = await import("../services/visionClient");
        studentB64 = await alignWorksheetPerspective(studentB64);
        console.log(`[Upload] Student sheet perspective warped and aligned successfully to 1248x1700 grid.`);
      } catch (err: any) {
        console.log(`[Upload] Alignment failed, falling back to original upload: ${err.message}`);
      }

      if (templateB64) {
        try {
          const { validateTemplate } = await import("../services/visionClient");
          const validation = await validateTemplate(templateB64, studentB64);
          
          if (!validation.match) {
             res.status(400).json({ 
               error: "Incorrect image detected. This does not match the expected template layout.",
               confidence: validation.confidence 
             });
             return;
          }
        } catch (error: any) {
          console.error("[Upload] Template Validation Error:", error.message);
          res.status(500).json({ error: "Validation failed: Make sure the master template is uploaded first! (" + error.message + ")" });
          return;
        }
      }

      // Real Grading using Vision API
      let minConfidence = 1.0;
      let totalScore = 0;
      let maxScore = 0;
      let forceHumanReview = false;
      const questionResults: any[] = [];
      
      const { callVisionEngine } = await import("../services/visionClient");

      if (questions.length === 0) {
        // Fallback dummy grading if no questions
        minConfidence = Math.random() * 0.4 + 0.6;
        totalScore = 2;
        maxScore = 2;
      } else {
        const N = questions.length;
        const maxScorePerQuestion = N > 0 ? (2.0 / N) : 2.0;

        for (const q of questions) {
          maxScore += maxScorePerQuestion;
          try {
            const visionRes = await callVisionEngine({
              image_b64: studentB64,
              question_type: q.type,
              grade_level: template.grade,
              expected_answer: String(q.expectedAnswer),
              bounding_box: q.boundingBox,
              answer_key_meta: {
                ...(q.meta || {}),
                mock_student_code: student?.studentCode || "",
                mock_student_name: student?.name || "",
              },
            });
            console.log("[Upload] callVisionEngine payload meta:", {
              mock_student_code: student?.studentCode || "",
              mock_student_name: student?.name || "",
            });
            console.log("[Upload] callVisionEngine response:", visionRes);
            
            const correctness = visionRes.score ?? 0.0;
            let qScore = 0;

            // Grading Rules:
            // 1. Correctness >= 80% (0.80) -> Full marks (maxScorePerQuestion)
            // 2. Correctness < 5% (0.05) -> 0.0 marks (wrong)
            // 3. Correctness >= 5% and < 80% -> 60% of maxScorePerQuestion and trigger human review
            if (correctness >= 0.80) {
              qScore = maxScorePerQuestion;
            } else if (correctness >= 0.05) {
              qScore = maxScorePerQuestion * 0.6; // 60% of marks
              forceHumanReview = true;
            } else {
              qScore = 0.0; // Completely wrong
              forceHumanReview = true;
            }

            totalScore += qScore;
            if (visionRes.confidence < minConfidence) {
              minConfidence = visionRes.confidence;
            }
            
            questionResults.push({
              questionId: q.id,
              questionType: q.type,
              engine: visionRes.engine || getEngineForType(q.type),
              score: qScore,
              maxScore: maxScorePerQuestion,
              confidence: visionRes.confidence,
              boundingBox: q.boundingBox
            });
          } catch (gradeErr) {
            console.error(`[Upload] Grading error for question ${q.id}:`, gradeErr);
            minConfidence = 0; // Force review
            forceHumanReview = true;
            questionResults.push({
              questionId: q.id,
              questionType: q.type,
              engine: getEngineForType(q.type),
              score: 0.0,
              maxScore: maxScorePerQuestion,
              confidence: 0,
              boundingBox: q.boundingBox
            });
          }
        }
      }

      const status = (minConfidence < 0.7 || forceHumanReview) ? "Human_Review" : "AI_Passed";

      // Save Student Upload to MinIO/Mock Storage
      const objectName = `submissions/${student_id}/page_${pageNum}_${Date.now()}.png`;
      const alignedBuffer = Buffer.from(studentB64, "base64");
      await minioClient.putObject(env.MINIO_BUCKET, objectName, alignedBuffer, alignedBuffer.length);

      const submissionId = `sub-${Date.now()}`;
      mockDb.submissions.set(key, {
        id: submissionId,
        studentId: student_id,
        pageNumber: pageNum,
        templateId: templateId,
        expectedQuestionType: expectedType,
        expectedDescription: expectedDesc,
        status,
        aiConfidence: Math.round(minConfidence * 100) / 100,
        totalScore,
        maxScore,
        fileUrl: objectName,
        questions: questionResults,
        createdAt: new Date().toISOString(),
      });

      res.status(201).json({
        submission_id: submissionId,
        page_number: pageNum,
        expected_type: expectedType,
        expected_description: expectedDesc,
        status,
        ai_confidence: Math.round(minConfidence * 100) / 100,
        needs_human_review: status === "Human_Review",
        message: `Page ${pageNum} uploaded and successfully validated. Expected: ${expectedDesc}`,
      });
      return;
    }

    // Real mode: check duplicate
    const existing = await prisma.submission.findUnique({
      where: { studentId_pageNumber: { studentId: student_id, pageNumber: pageNum } },
    });
    if (existing) {
      res.status(409).json({ error: `Page ${pageNum} already uploaded for this student` });
      return;
    }

    // Upload to storage
    const objectName = `submissions/${student_id}/page_${pageNum}_${uuidv4()}.pdf`;
    // await minioClient.putObject(env.MINIO_BUCKET, objectName, file.buffer, file.size);

    const aiConfidence = Math.random() * 0.4 + 0.6;
    const status = aiConfidence < 0.8 ? "Human_Review" : "AI_Passed";

    const submission = await prisma.submission.create({
      data: {
        studentId: student_id,
        pageNumber: pageNum,
        templateId,
        fileUrl: objectName,
        status,
        aiConfidence,
        totalScore: status === "AI_Passed" ? 2 : null,
        maxScore: 3,
      },
    });

    res.status(201).json({
      submission_id: submission.id,
      page_number: pageNum,
      status,
      ai_confidence: Math.round(aiConfidence * 100) / 100,
      needs_human_review: status === "Human_Review",
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Get Student Page Image ────────────────────────────────
uploadRouter.get("/students/:studentId/pages/:pageNumber/image", async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, pageNumber } = req.params;
    const pageNum = parseInt(pageNumber);

    let fileUrl: string | undefined;

    if (env.MOCK_MODE) {
      const key = `${studentId}-${pageNum}`;
      const sub = mockDb.submissions.get(key);
      if (!sub || !sub.fileUrl) {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      fileUrl = sub.fileUrl;
    } else {
      const sub = await prisma.submission.findUnique({
        where: { studentId_pageNumber: { studentId, pageNumber: pageNum } },
      });
      if (!sub || !sub.fileUrl) {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      fileUrl = sub.fileUrl;
    }

    const stream = await minioClient.getObject(env.MINIO_BUCKET, fileUrl);
    res.setHeader("Content-Type", "image/png");
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error("[Upload] Get Image Error:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// ─── Get Student Page Details ──────────────────────────────
uploadRouter.get("/students/:studentId/pages/:pageNumber/details", async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, pageNumber } = req.params;
    const pageNum = parseInt(pageNumber);

    if (env.MOCK_MODE) {
      const key = `${studentId}-${pageNum}`;
      const sub = mockDb.submissions.get(key);
      if (!sub) {
        res.status(404).json({ error: "Details not found" });
        return;
      }
      res.json({
        expectedDescription: sub.expectedDescription,
        aiConfidence: sub.aiConfidence,
        status: sub.status,
        totalScore: sub.totalScore,
        maxScore: sub.maxScore,
        questions: sub.questions || [],
      });
      return;
    }

    const sub = await prisma.submission.findUnique({
      where: { studentId_pageNumber: { studentId, pageNumber: pageNum } },
      include: { questions: true },
    });
    
    if (!sub) {
      res.status(404).json({ error: "Details not found" });
      return;
    }
    
    res.json({
      expectedDescription: "Page details",
      aiConfidence: sub.aiConfidence,
      status: sub.status,
      totalScore: sub.totalScore,
      maxScore: sub.maxScore,
      questions: sub.questions,
    });
  } catch (err) {
    console.error("[Upload] Get Details Error:", err);
    res.status(500).json({ error: "Failed to fetch details" });
  }
});

function generateQuestions(questionType: number, pageNum: number) {
  const count = questionType === 7 ? 3 : 2;
  return Array.from({ length: count }, (_, i) => ({
    question_id: `P${pageNum}_Q${i + 1}`,
    questionType,
    engine: getEngineForType(questionType),
    score: 1,
    maxScore: 1,
    confidence: 0.9,
  }));
}

function getEngineForType(type: number): string {
  const map: Record<number, string> = {
    1: "A", 2: "A", 3: "A", 12: "A",
    4: "B", 10: "B", 13: "B",
    5: "C", 6: "C", 9: "C",
    7: "D", 8: "D", 11: "D", 14: "D",
  };
  return map[type] || "A";
}