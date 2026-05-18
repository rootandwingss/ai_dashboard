import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

/* ─── Upload Image ───────────────────────────────────────── */
export async function uploadImage(
  file: File,
  studentId: string,
  pageNumber: number,
  templateId?: string
) {
  const form = new FormData();
  form.append("file", file);
  form.append("student_id", studentId);
  form.append("page_number", pageNumber.toString());
  if (templateId) form.append("template_id", templateId);

  const { data } = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* ─── Templates ───────────────────────────────────────────── */
export async function getTemplates() {
  const { data } = await api.get("/templates");
  return data.templates || [];
}

export async function uploadTemplate(file: File, name: string, grade: string, answerKeyFile?: File) {
  const form = new FormData();
  form.append("file", file);
  if (answerKeyFile) form.append("answerKey", answerKeyFile);
  form.append("name", name);
  form.append("grade", grade);

  const { data } = await api.post("/templates", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getTemplatePages(templateId: string) {
  const { data } = await api.get(`/templates/${templateId}/pages`);
  return data.pages || [];
}

/* ─── Schools ─────────────────────────────────────────────── */
export async function getSchools() {
  const { data } = await api.get("/schools");
  return data.schools || [];
}

export async function createSchool(name: string, location?: string) {
  const { data } = await api.post("/schools", { name, location });
  return data;
}

/* ─── Students ────────────────────────────────────────────── */
export async function getStudents(schoolId?: string) {
  const { data } = await api.get("/students", { params: schoolId ? { school_id: schoolId } : {} });
  return data.students || [];
}

export async function createStudent(name: string, grade: string, schoolId: string, studentCode?: string) {
  const { data } = await api.post("/students", { name, grade, school_id: schoolId, student_code: studentCode });
  return data;
}

/* ─── Student Page Progress (20-slot grid) ───────────────── */
export async function getStudentPageProgress(studentId: string) {
  const { data } = await api.get(`/upload/students/${studentId}/pages`);
  return data.pages || [];
}

export async function getSubmissionImage(studentId: string, pageNumber: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/upload/students/${studentId}/pages/${pageNumber}/image`);
  if (!res.ok) throw new Error("Failed to fetch image");
  return res.blob();
}

export async function getPageDetails(studentId: string, pageNumber: number): Promise<any> {
  const res = await fetch(`${API_BASE}/upload/students/${studentId}/pages/${pageNumber}/details`);
  if (!res.ok) throw new Error("Failed to fetch details");
  return res.json();
}

/* ─── Results ───────────────────────────────────────────── */
export async function getSubmissions(page = 1, limit = 20) {
  const { data } = await api.get("/results", { params: { page, limit } });
  return data;
}

export async function getSubmission(id: string) {
  const { data } = await api.get(`/results/${id}`);
  return data;
}

export async function approveSubmission(id: string, score?: number) {
  const { data } = await api.post(`/results/${id}/approve`, { score });
  return data;
}

/* ─── Exceptions ────────────────────────────────────────── */
export async function getExceptions(status = "pending", page = 1) {
  const { data } = await api.get("/exceptions", { params: { status, page } });
  return data;
}

export async function resolveException(id: string, verdict: "approve" | "reject") {
  const { data } = await api.post(`/exceptions/${id}/resolve`, { verdict });
  return data;
}

export default api;
