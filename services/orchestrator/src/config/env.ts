import dotenv from "dotenv";
dotenv.config({ path: "../../.env.example" });

export const env = {
  // Server
  PORT: parseInt(process.env.ORCHESTRATOR_PORT || "4000", 10),

  // Mock Mode (runs without Redis/Postgres)
  MOCK_MODE: process.env.MOCK_MODE === "true",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://olympiad:olympiad_secret@localhost:5432/olympiad_db",

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),

  // MinIO
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || "localhost",
  MINIO_PORT: parseInt(process.env.MINIO_PORT || "9000", 10),
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || "minioadmin",
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || "minioadmin123",
  MINIO_BUCKET: process.env.MINIO_BUCKET || "olympiad-uploads",
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === "true",

  // Vision Engine
  VISION_ENGINE_URL: process.env.VISION_ENGINE_URL || "http://localhost:8000",
};
