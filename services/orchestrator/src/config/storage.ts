import * as Minio from "minio";
import { env } from "./env";
import fs from "fs/promises";
import path from "path";
import os from "os";

// In mock mode, we use a local directory to simulate MinIO storage
const MOCK_STORAGE_DIR = path.join(os.tmpdir(), "olympiad_mock_storage");

const mockMinioClient = {
  putObject: async (bucket: string, objectName: string, stream: Buffer | string | any, size?: number, meta?: any) => {
    const filePath = path.join(MOCK_STORAGE_DIR, bucket, objectName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, stream);
  },
  getObject: async (bucket: string, objectName: string) => {
    const filePath = path.join(MOCK_STORAGE_DIR, bucket, objectName);
    const buffer = await fs.readFile(filePath);
    // Return an async iterable buffer to simulate a stream
    return [buffer];
  },
  bucketExists: async (bucket: string) => {
    try {
      await fs.access(path.join(MOCK_STORAGE_DIR, bucket));
      return true;
    } catch {
      return false;
    }
  },
  makeBucket: async (bucket: string) => {
    await fs.mkdir(path.join(MOCK_STORAGE_DIR, bucket), { recursive: true });
  }
} as any;

export const minioClient = env.MOCK_MODE
  ? mockMinioClient
  : new Minio.Client({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(env.MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(env.MINIO_BUCKET);
    console.log(`[MinIO] Created bucket: ${env.MINIO_BUCKET}`);
  }
}