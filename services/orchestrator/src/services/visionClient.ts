import axios from "axios";
import { env } from "../config/env";

export interface VisionRequest {
  image_b64: string;
  question_type: number;
  grade_level: string;
  expected_answer: string;
  bounding_box: { x: number; y: number; w: number; h: number };
  answer_key_meta: Record<string, unknown>;
}

export interface VisionResponse {
  score: number;
  max_score: number;
  confidence: number;
  engine: string;
  details: Record<string, unknown>;
  flag_exception: boolean;
  cropped_b64?: string;
}

const client = axios.create({
  baseURL: env.VISION_ENGINE_URL,
  timeout: 30_000, // 30s per question — generous for OCR calls
  headers: { "Content-Type": "application/json" },
});

/**
 * Call the Python Vision Engine's /grade endpoint.
 */
export async function callVisionEngine(payload: VisionRequest): Promise<VisionResponse> {
  try {
    const { data } = await client.post<VisionResponse>("/grade", payload);
    return data;
  } catch (error: any) {
    if (error.response) {
      console.error(`[VisionClient] Engine returned ${error.response.status}:`, error.response.data);
      throw new Error(`Vision Engine error: ${error.response.status}`);
    }
    console.error("[VisionClient] Network error:", error.message);
    throw new Error(`Vision Engine unreachable: ${error.message}`);
  }
}

/**
 * Check if the Vision Engine is healthy.
 */
export async function checkVisionHealth(): Promise<boolean> {
  try {
    const { data } = await client.get("/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Validates that a student's uploaded image matches the expected template.
 */
export async function validateTemplate(templateB64: string, studentB64: string): Promise<{ match: boolean; confidence: number; message: string }> {
  try {
    const { data } = await client.post("/validate-template", {
      template_b64: templateB64,
      student_b64: studentB64
    });
    return data;
  } catch (error: any) {
    if (error.response) {
      console.error(`[VisionClient] validateTemplate returned ${error.response.status}:`, error.response.data);
      throw new Error(`Vision Engine validation error: ${error.response.status}`);
    }
    console.error("[VisionClient] Network error during validation:", error.message);
    throw new Error(`Vision Engine validation unreachable: ${error.message}`);
  }
}

/**
 * Automatically align a student worksheet photo using perspective homography warp.
 */
export async function alignWorksheetPerspective(studentB64: string): Promise<string> {
  try {
    const { data } = await client.post<{ success: boolean; warped_b64: string }>("/align-perspective", {
      image_b64: studentB64
    });
    return data.warped_b64;
  } catch (error: any) {
    console.error("[VisionClient] Network error during worksheet perspective alignment:", error.message);
    throw new Error(`Vision Engine perspective warping unreachable: ${error.message}`);
  }
}

/**
 * Automatically detect all rectangular answer boxes inside a blank template sheet using computer vision contours.
 */
export async function detectTemplateBoxes(templateB64: string): Promise<{ x: number; y: number; w: number; h: number }[]> {
  try {
    const { data } = await client.post<{ success: boolean; boxes: { x: number; y: number; w: number; h: number }[] }>("/detect-template-boxes", {
      image_b64: templateB64
    });
    return data.boxes;
  } catch (error: any) {
    console.error("[VisionClient] Network error during template box detection:", error.message);
    throw new Error(`Vision Engine template box detection unreachable: ${error.message}`);
  }
}
