import { Router, Request, Response } from "express";
import { mockDb } from "../config/db";
import { env } from "../config/env";

export const schoolsRouter = Router();

// Get all schools
schoolsRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  if (env.MOCK_MODE) {
    const schools = Array.from(mockDb.schools.values());
    res.json({ schools });
    return;
  }
  res.json({ schools: [] });
});

// Create school
schoolsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { name, location } = req.body;
  if (!name) {
    res.status(400).json({ error: "School name is required" });
    return;
  }

  if (env.MOCK_MODE) {
    const id = `school-${Date.now()}`;
    mockDb.schools.set(id, { id, name, location: location || "", createdAt: new Date().toISOString() });
    res.json({ school: { id, name, location } });
    return;
  }
  res.json({ message: "School created" });
});