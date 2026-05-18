import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { mockDb } from "../config/db";
import { env } from "../config/env";
import { minioClient } from "../config/storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export const templatesRouter = Router();

// Get all templates
templatesRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const templates = Array.from(mockDb.templates.values()).map(t => ({
    id: t.id,
    name: t.name,
    grade: t.grade,
    pageCount: t.pageCount,
    createdAt: t.createdAt,
  }));
  res.json({ templates });
});

// Upload template PDF and optional JSON answer key
templatesRouter.post("/", upload.fields([{ name: "file", maxCount: 1 }, { name: "answerKey", maxCount: 1 }]), async (req: Request, res: Response): Promise<void> => {
  const { name, grade } = req.body;
  if (!name || !grade) {
    res.status(400).json({ error: "name and grade are required" });
    return;
  }
  
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.file?.[0];
  const answerKeyFile = files?.answerKey?.[0];

  if (!file) {
    res.status(400).json({ error: "No PDF file provided" });
    return;
  }

  const templateId = `template-${Date.now()}`;
  
  try {
    const tmpDir = path.join(os.tmpdir(), `template-${templateId}`);
    await fs.mkdir(tmpDir, { recursive: true });
    
    // 1. Save PDF to temp dir
    const pdfPath = path.join(tmpDir, "input.pdf");
    await fs.writeFile(pdfPath, file.buffer);
    
    // 2. Upload original template PDF to MinIO
    await minioClient.putObject(env.MINIO_BUCKET, `templates/${templateId}.pdf`, file.buffer, file.size, {
      "Content-Type": "application/pdf",
    });

    // 3. Convert PDF pages to PNG
    const pdfPoppler = await import("pdf-poppler");
    const opts = {
      format: "png" as const,
      out_dir: tmpDir,
      out_prefix: "page",
      scale: 2048,
    };

    await pdfPoppler.convert(pdfPath, opts);

    // 4. Upload each page
    const files = await fs.readdir(tmpDir);
    const pageFiles = files
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    for (let i = 0; i < pageFiles.length; i++) {
      const pageBuffer = await fs.readFile(path.join(tmpDir, pageFiles[i]));
      const pageObjectName = `templates/${templateId}/page-${i + 1}.png`; // 1-indexed
      await minioClient.putObject(env.MINIO_BUCKET, pageObjectName, pageBuffer, pageBuffer.length, {
        "Content-Type": "image/png",
      });
    }
    
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  } catch (err: any) {
    console.error("[TemplatesRoute] Error processing template:", err);
    res.status(500).json({ error: "Failed to process template PDF: " + (err.message || String(err)) });
    return;
  }

  let pages: any[] = [];
  let parsedPageCount = 20;

  if (answerKeyFile) {
    try {
      const answerKeyData = JSON.parse(answerKeyFile.buffer.toString("utf-8"));
      if (answerKeyData.pages && Array.isArray(answerKeyData.pages)) {
        pages = answerKeyData.pages.map((p: any) => ({
          pageNumber: p.pageIndex + 1,
          questions: p.questions || [],
          // Keep backwards compatibility for UI
          questionType: p.questions?.[0]?.type || 1,
          description: p.questions?.[0]?.description || `Page ${p.pageIndex + 1}`
        }));
        parsedPageCount = pages.length;
      }
    } catch (e) {
      console.error("[TemplatesRoute] Error parsing answer key JSON:", e);
    }
  }

  // Fallback to generic 20 pages if no valid answer key provided
  if (pages.length === 0) {
    const pageConfigs: Record<number, { type: number; desc: string }> = {
      1: { type: 7, desc: "Count and Write" },
      2: { type: 1, desc: "Circle Correct Answer" },
      3: { type: 4, desc: "Color the Image (Balloons/Stars)" },
      4: { type: 5, desc: "Trace Dotted Line" },
      5: { type: 8, desc: "Encircle Beginning Letter" },
      6: { type: 6, desc: "Draw a Shape" },
      7: { type: 2, desc: "Tick or Cross" },
      8: { type: 3, desc: "Match the Following" },
      9: { type: 9, desc: "Complete Pattern" },
      10: { type: 10, desc: "Color N of M Shapes" },
      11: { type: 11, desc: "Fill Missing Letter" },
      12: { type: 12, desc: "Match Picture to Letter" },
      13: { type: 13, desc: "Color Words by Rule" },
      14: { type: 1, desc: "Circle Letter C" },
      15: { type: 14, desc: "Rearrange Letters" },
      16: { type: 7, desc: "Count and Write" },
      17: { type: 8, desc: "Write Letter/Word" },
      18: { type: 4, desc: "Color the Image" },
      19: { type: 6, desc: "Draw Shape" },
      20: { type: 4, desc: "Colour the Image" },
    };

    for (let i = 1; i <= 20; i++) {
      const config = pageConfigs[i] || { type: 1, desc: `Page ${i}` };
      
      let expectedAnswer = "Unknown";
      if ([7, 8].includes(config.type)) expectedAnswer = "3"; // Count/Write
      if ([1, 2, 12, 14].includes(config.type)) expectedAnswer = "A"; // Multiple choice / Text
      if ([11].includes(config.type)) expectedAnswer = "c"; // Fill in the blank
      
      pages.push({
        pageNumber: i,
        questionType: config.type,
        description: config.desc,
        questions: [
          {
            id: `q${i}`,
            type: config.type,
            expectedAnswer,
            boundingBox: { x: 100, y: 150, w: 1248, h: 1700 },
            meta: {}
          }
        ]
      });
    }
  }

  mockDb.templates.set(templateId, {
    id: templateId,
    name,
    grade,
    pageCount: parsedPageCount,
    pages,
    createdAt: new Date().toISOString(),
  });

  res.json({ template: { id: templateId, name, grade, pageCount: parsedPageCount } });
});

// Get template pages
templatesRouter.get("/:templateId/pages", async (req: Request, res: Response): Promise<void> => {
  const { templateId } = req.params;
  const template = mockDb.templates.get(templateId);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json({ pages: template.pages });
});

// Helper to generate the custom 'nur1' template config with user's specific answer keys
function getNur1TemplateConfig(id: string) {
  const pagesConfigs = [
    {
      pageNumber: 1,
      questionType: 8,
      description: "Q1. Count and write the alphabet",
      questions: [
        { id: "q1_1", type: 8, expectedAnswer: "C", boundingBox: { x: 780, y: 400, w: 200, h: 150 }, meta: {} },
        { id: "q1_2", type: 8, expectedAnswer: "D", boundingBox: { x: 780, y: 720, w: 200, h: 150 }, meta: {} },
        { id: "q1_3", type: 8, expectedAnswer: "B", boundingBox: { x: 780, y: 1050, w: 200, h: 150 }, meta: {} },
        { id: "q1_4", type: 8, expectedAnswer: "A", boundingBox: { x: 800, y: 1390, w: 200, h: 170 }, meta: {} },
      ],
    },
    {
      pageNumber: 2,
      questionType: 1,
      description: "Q2. Circle the odd one",
      questions: [
        { id: "q2", type: 1, expectedAnswer: "umbrella", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 3,
      questionType: 4,
      description: "Q3. Colouring",
      questions: [
        { id: "q3_1", type: 4, expectedAnswer: "4 balloons", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q3_2", type: 4, expectedAnswer: "2 stars", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 4,
      questionType: 7,
      description: "Q4. Count the fingers",
      questions: [
        { id: "q4_A", type: 7, expectedAnswer: "2", boundingBox: { x: 100, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q4_B", type: 7, expectedAnswer: "5", boundingBox: { x: 650, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q4_C", type: 7, expectedAnswer: "6", boundingBox: { x: 100, y: 900, w: 450, h: 650 }, meta: {} },
        { id: "q4_D", type: 7, expectedAnswer: "3", boundingBox: { x: 650, y: 900, w: 450, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 5,
      questionType: 8,
      description: "Q5. Encircle the beginning letter",
      questions: [
        { id: "q5_cup", type: 8, expectedAnswer: "C", boundingBox: { x: 100, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q5_grapes", type: 8, expectedAnswer: "G", boundingBox: { x: 650, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q5_lion", type: 8, expectedAnswer: "L", boundingBox: { x: 100, y: 900, w: 450, h: 650 }, meta: {} },
        { id: "q5_ball", type: 8, expectedAnswer: "B", boundingBox: { x: 650, y: 900, w: 450, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 6,
      questionType: 5,
      description: "Q6. Join the numbers",
      questions: [
        { id: "q6", type: 5, expectedAnswer: "crab", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 7,
      questionType: 4,
      description: "Q7. Starting letters",
      questions: [
        { id: "q7_rocket", type: 4, expectedAnswer: "R", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q7_mango", type: 4, expectedAnswer: "M", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 8,
      questionType: 2,
      description: "Q8. Tick the good habits",
      questions: [
        { id: "q8_brush", type: 2, expectedAnswer: "tick", boundingBox: { x: 50, y: 150, w: 350, h: 1400 }, meta: {} },
        { id: "q8_wash", type: 2, expectedAnswer: "tick", boundingBox: { x: 450, y: 150, w: 350, h: 1400 }, meta: {} },
        { id: "q8_kind", type: 2, expectedAnswer: "tick", boundingBox: { x: 850, y: 150, w: 350, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 9,
      questionType: 11,
      description: "Q9. Missing alphabets",
      questions: [
        { id: "q9", type: 11, expectedAnswer: "A B C D E F G H I J K L", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 10,
      questionType: 10,
      description: "Q10. Long and Short",
      questions: [
        { id: "q10_short", type: 10, expectedAnswer: "color", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q10_long", type: 10, expectedAnswer: "tick", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 11,
      questionType: 1,
      description: "Q11. Before and After",
      questions: [
        { id: "q11_before", type: 1, expectedAnswer: "before", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q11_after", type: 1, expectedAnswer: "after", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 12,
      questionType: 12,
      description: "Q12. Count the stars",
      questions: [
        { id: "q12", type: 12, expectedAnswer: "four stars", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 13,
      questionType: 7,
      description: "Q13. Animal (A) or Bird (B)",
      questions: [
        { id: "q13_giraffe", type: 7, expectedAnswer: "A", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q13_bird", type: 7, expectedAnswer: "B", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 14,
      questionType: 14,
      description: "Q14. Rainbow Colours",
      questions: [
        { id: "q14_violet", type: 14, expectedAnswer: "Violet", boundingBox: { x: 100, y: 150, w: 1048, h: 150 }, meta: {} },
        { id: "q14_indigo", type: 14, expectedAnswer: "Indigo", boundingBox: { x: 100, y: 350, w: 1048, h: 150 }, meta: {} },
        { id: "q14_blue", type: 14, expectedAnswer: "Blue", boundingBox: { x: 100, y: 550, w: 1048, h: 150 }, meta: {} },
        { id: "q14_green", type: 14, expectedAnswer: "Green", boundingBox: { x: 100, y: 750, w: 1048, h: 150 }, meta: {} },
        { id: "q14_yellow", type: 14, expectedAnswer: "Yellow", boundingBox: { x: 100, y: 950, w: 1048, h: 150 }, meta: {} },
        { id: "q14_orange", type: 14, expectedAnswer: "Orange", boundingBox: { x: 100, y: 1150, w: 1048, h: 150 }, meta: {} },
        { id: "q14_red", type: 14, expectedAnswer: "Red", boundingBox: { x: 100, y: 1350, w: 1048, h: 150 }, meta: {} },
      ],
    },
    {
      pageNumber: 15,
      questionType: 1,
      description: "Q15. Find the letter 'C'",
      questions: [
        { id: "q15", type: 1, expectedAnswer: "C", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 16,
      questionType: 8,
      description: "Q16. Spelling Search",
      questions: [
        { id: "q16_ant", type: 8, expectedAnswer: "ANT", boundingBox: { x: 100, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q16_tap", type: 8, expectedAnswer: "TAP", boundingBox: { x: 650, y: 150, w: 450, h: 650 }, meta: {} },
        { id: "q16_hat", type: 8, expectedAnswer: "HAT", boundingBox: { x: 100, y: 900, w: 450, h: 650 }, meta: {} },
        { id: "q16_cat", type: 8, expectedAnswer: "CAT", boundingBox: { x: 650, y: 900, w: 450, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 17,
      questionType: 1,
      description: "Page 17",
      questions: [
        { id: "q17", type: 1, expectedAnswer: "A", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 18,
      questionType: 4,
      description: "Q18. Colour the emojis",
      questions: [
        { id: "q18_happy", type: 4, expectedAnswer: "yellow", boundingBox: { x: 100, y: 150, w: 1048, h: 650 }, meta: {} },
        { id: "q18_angry", type: 4, expectedAnswer: "red", boundingBox: { x: 100, y: 900, w: 1048, h: 650 }, meta: {} },
      ],
    },
    {
      pageNumber: 19,
      questionType: 4,
      description: "Page 19",
      questions: [
        { id: "q19", type: 4, expectedAnswer: "color", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
    {
      pageNumber: 20,
      questionType: 4,
      description: "Page 20",
      questions: [
        { id: "q20", type: 4, expectedAnswer: "color", boundingBox: { x: 100, y: 150, w: 1048, h: 1400 }, meta: {} },
      ],
    },
  ];

  return {
    id,
    name: "nur1",
    grade: "nursery",
    pageCount: 20,
    pages: pagesConfigs,
    createdAt: new Date().toISOString(),
  };
}

// Seed the custom 'nur1' templates
if (!mockDb.templates.has("nur1")) {
  mockDb.templates.set("nur1", getNur1TemplateConfig("nur1"));
}
if (!mockDb.templates.has("template-1779097394290")) {
  mockDb.templates.set("template-1779097394290", getNur1TemplateConfig("template-1779097394290"));
}

// Initialize default template
if (!mockDb.templates.has("nursery_worksheet_01")) {
  mockDb.templates.set("nursery_worksheet_01", {
    id: "nursery_worksheet_01",
    name: "Nursery Worksheet 2024",
    grade: "nursery",
    pageCount: 20,
    pages: Array.from({ length: 20 }, (_, i) => {
      const configs = [7, 1, 4, 5, 8, 6, 2, 3, 9, 10, 11, 12, 13, 1, 14, 7, 8, 4, 6, 4];
      const descs = ["Count and Write", "Circle Correct Answer", "Color the Image", "Trace Dotted Line", "Encircle Beginning Letter", "Draw a Shape", "Tick or Cross", "Match the Following", "Complete Pattern", "Color N of M", "Fill Missing Letter", "Match Picture to Letter", "Color Words by Rule", "Circle Letter C", "Rearrange Letters", "Count and Write", "Write Letter/Word", "Color the Image", "Draw Shape", "Colour the Image"];
      
      const type = configs[i];
      let expectedAnswer = "A";
      if ([7, 8].includes(type)) expectedAnswer = "3";
      if ([11].includes(type)) expectedAnswer = "c";

      return { 
        pageNumber: i + 1, 
        questionType: type, 
        description: descs[i],
        questions: [
          {
            id: `q${i + 1}`,
            type,
            expectedAnswer,
            boundingBox: { x: 100, y: 150, w: 1248, h: 1700 },
            meta: {}
          }
        ]
      };
    }),
    createdAt: new Date().toISOString(),
  });
}