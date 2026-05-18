import { Router, Request, Response } from "express";
import { mockDb } from "../config/db";
import { env } from "../config/env";

export const studentsRouter = Router();

// Get students
studentsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  const { school_id } = req.query;

  if (env.MOCK_MODE) {
    let students = Array.from(mockDb.students.values());
    if (school_id) {
      students = students.filter((s) => s.schoolId === school_id);
    }
    res.json({ students });
    return;
  }
  res.json({ students: [] });
});

// Create student
studentsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { name, grade, school_id, student_code } = req.body;

  if (!name || !grade || !school_id) {
    res.status(400).json({ error: "name, grade, and school_id are required" });
    return;
  }

  if (env.MOCK_MODE) {
    const id = `stu-${Date.now()}`;
    const code = student_code || `STU${String(mockDb.counter.students + 1).padStart(3, "0")}`;
    mockDb.students.set(id, { id, name, grade, schoolId: school_id, studentCode: code, createdAt: new Date().toISOString() });
    mockDb.counter.students++;
    res.json({ student: { id, name, grade, studentCode: code } });
    return;
  }
  res.json({ message: "Student created" });
});