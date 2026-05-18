import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { prisma, mockDb } from "./config/db";
import { ensureBucket } from "./config/storage";
import { uploadRouter } from "./routes/upload.routes";
import { resultsRouter } from "./routes/results.routes";
import { exceptionsRouter } from "./routes/exceptions.routes";
import { templatesRouter } from "./routes/templates.routes";
import { schoolsRouter } from "./routes/schools.routes";
import { studentsRouter } from "./routes/students.routes";

if (!env.MOCK_MODE) {
  import("./queues/workers/pdfSplitWorker");
  import("./queues/workers/gradingWorker");
}

const app = express();

// ─── Middleware ─────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:3000", "https://mural-ipod-unpaired.ngrok-free.dev"],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));

// ─── Routes ────────────────────────────────────────────
app.use("/api/upload", uploadRouter);
app.use("/api/results", resultsRouter);
app.use("/api/exceptions", exceptionsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/schools", schoolsRouter);
app.use("/api/students", studentsRouter);

// ─── Health check ──────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "orchestrator" });
});

// ─── Startup ───────────────────────────────────────────
async function main() {
  if (env.MOCK_MODE) {
    console.log("[Mock Mode] Running without Redis/PostgreSQL");
  } else {
    await prisma.$connect();
    console.log("[DB] Connected to PostgreSQL");
    await ensureBucket();
    console.log("[MinIO] Storage ready");
  }

  app.listen(env.PORT, () => {
    console.log(`[Orchestrator] Listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[Orchestrator] Fatal startup error:", err);
  process.exit(1);
});
