import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Lazy load Prisma only when not in mock mode
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export const prisma = env.MOCK_MODE ? ({} as any) : new Proxy({}, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  }
}) as unknown as PrismaClient;

export const mockDb = {
  schools: new Map<string, any>(),
  students: new Map<string, any>(),
  templates: new Map<string, any>(),
  templatePages: new Map<string, any>(),
  submissions: new Map<string, any>(),
  exceptions: new Map<string, any>(),
  counter: { schools: 0, students: 0, submissions: 0, exceptions: 0, templates: 0 },
};

function initMockData() {
  const school1Id = "school-001";
  const school2Id = "school-002";
  mockDb.schools.set(school1Id, { id: school1Id, name: "Green Valley Public School", location: "Delhi" });
  mockDb.schools.set(school2Id, { id: school2Id, name: "Sunrise Academy", location: "Mumbai" });

  const students = [
    { id: "stu-001", name: "Aarav Sharma", grade: "nursery", schoolId: school1Id, studentCode: "GVS001" },
    { id: "stu-002", name: "Sia Gupta", grade: "nursery", schoolId: school1Id, studentCode: "GVS002" },
    { id: "stu-003", name: "Reyansh Patel", grade: "nursery", schoolId: school1Id, studentCode: "GVS003" },
    { id: "stu-004", name: "Ananya Singh", grade: "nursery", schoolId: school2Id, studentCode: "SUN001" },
    { id: "stu-005", name: "Vihaan Kumar", grade: "nursery", schoolId: school2Id, studentCode: "SUN002" },
    { id: "stu-006", name: "Myra Shah", grade: "lkg", schoolId: school2Id, studentCode: "SUN003" },
  ];
  students.forEach((s) => mockDb.students.set(s.id, s));

  for (let page = 1; page <= 20; page++) {
    const pageConfig: Record<number, { type: number; desc: string }> = {
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
      20: { type: 1, desc: "Circle Correct Answer" },
    };
    const config = pageConfig[page] || { type: 1, desc: `Page ${page}` };
    mockDb.templatePages.set(`nursery_worksheet_01-${page}`, {
      templateId: "nursery_worksheet_01",
      pageNumber: page,
      expectedQuestionType: config.type,
      description: config.desc,
    });
  }

  const existingSubmissions = [
    { studentId: "stu-001", pageNumber: 1, status: "AI_Passed", aiConfidence: 0.92, totalScore: 3, maxScore: 3 },
    { studentId: "stu-001", pageNumber: 2, status: "AI_Passed", aiConfidence: 0.88, totalScore: 2, maxScore: 2 },
    { studentId: "stu-001", pageNumber: 3, status: "Human_Review", aiConfidence: 0.65, totalScore: null, maxScore: null },
    { studentId: "stu-002", pageNumber: 1, status: "AI_Passed", aiConfidence: 0.95, totalScore: 3, maxScore: 3 },
  ];
  existingSubmissions.forEach((sub, i) => {
    const id = `sub-${i + 1}`;
    const key = `${sub.studentId}-${sub.pageNumber}`;
    mockDb.submissions.set(key, { ...sub, id, templateId: "nursery_worksheet_01", createdAt: new Date().toISOString() });
  });

  console.log("[Mock] Loaded 2 schools, 6 students, 20 template pages");
}

initMockData();