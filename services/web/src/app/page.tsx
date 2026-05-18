"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { uploadImage, getSchools, getStudents, getStudentPageProgress, getTemplates, getSubmissionImage, getPageDetails } from "@/lib/api";

interface Template { id: string; name: string; grade: string; pageCount: number; }
interface School { id: string; name: string; location?: string }
interface Student { id: string; name: string; studentCode: string; grade: string }
interface PageSlot { pageNumber: number; status: string; aiConfidence: number | null }

const PAGE_TYPE_MAP: Record<number, string> = {
  1: "Count and Write",
  2: "Circle Correct Answer",
  3: "Color the Image (Balloons/Stars)",
  4: "Trace Dotted Line",
  5: "Encircle Beginning Letter",
  6: "Draw a Shape",
  7: "Tick or Cross",
  8: "Match the Following",
  9: "Complete Pattern",
  10: "Color N of M Shapes",
  11: "Fill Missing Letter",
  12: "Match Picture to Letter",
  13: "Color Words by Rule",
  14: "Circle Letter C",
  15: "Rearrange Letters",
  16: "Count and Write",
  17: "Write Letter/Word",
  18: "Color the Image",
  19: "Draw Shape",
  20: "Circle Correct Answer",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [pageSlots, setPageSlots] = useState<PageSlot[]>([]);
  const [pageDetails, setPageDetails] = useState<any>(null);
  const router = useRouter();

  const { getRootProps, getInputProps, isDragActive, isDragAccept } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        const imageFile = accepted[0];
        setFile(imageFile);
        setError("");
        setResult(null);
        // Create preview
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(imageFile);
      }
    },
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB for images
  });

  useEffect(() => {
    loadSchools();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedSchool) loadStudents(selectedSchool);
  }, [selectedSchool]);

  useEffect(() => {
    if (selectedStudent) loadPageProgress();
  }, [selectedStudent]);

  async function loadSchools() {
    try {
      const data = await getSchools();
      setSchools(data);
      if (data.length > 0) setSelectedSchool(data[0].id);
    } catch (err) {
      console.error("Failed to load schools:", err);
    }
  }

  async function loadStudents(schoolId: string) {
    try {
      const data = await getStudents(schoolId);
      setStudents(data);
      if (data.length > 0) setSelectedStudent(data[0].id);
    } catch (err) {
      console.error("Failed to load students:", err);
    }
  }

  async function loadTemplates() {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  const currentStudentObj = students.find((s) => s.id === selectedStudent);
  const filteredTemplates = templates.filter((t) => !currentStudentObj || t.grade === currentStudentObj.grade);

  useEffect(() => {
    if (filteredTemplates.length > 0 && (!selectedTemplate || !filteredTemplates.find(t => t.id === selectedTemplate))) {
      setSelectedTemplate(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplate]);

  async function loadPageProgress() {
    try {
      const data = await getStudentPageProgress(selectedStudent);
      setPageSlots(data);
    } catch (err) {
      setPageSlots(Array.from({ length: 20 }, (_, i) => ({ pageNumber: i + 1, status: "Missing", aiConfidence: null })));
    }
  }

  async function handleUpload() {
    if (!file || !selectedStudent) {
      setError("Please select a student and image");
      return;
    }
    setUploading(true);
    setError("");

    try {
      const res = await uploadImage(file, selectedStudent, pageNumber, selectedTemplate);
      setResult(res);
      setFile(null);
      setPreview(null);
      loadPageProgress();
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setFile(null);
    setPreview(null);
    setPageDetails(null);
  }

  async function handleSlotClick(pageNum: number) {
    setPageNumber(pageNum);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setPageDetails(null);

    const slot = pageSlots.find((s) => s.pageNumber === pageNum);
    if (slot && slot.status !== "Missing" && selectedStudent) {
      try {
        const [blob, details] = await Promise.all([
          getSubmissionImage(selectedStudent, pageNum),
          getPageDetails(selectedStudent, pageNum)
        ]);
        const url = URL.createObjectURL(blob);
        setPreview(url);
        setPageDetails(details);
      } catch (err) {
        console.error("Failed to load previous submission details:", err);
      }
    }
  }

  const filledSlots = pageSlots.filter((s) => s.status !== "Missing").length;
  const humanReviewCount = pageSlots.filter((s) => s.status === "Human_Review").length;
  const currentPageSlot = pageSlots.find(s => s.pageNumber === pageNumber);
  const isUpdating = currentPageSlot && currentPageSlot.status !== "Missing";

  const getSlotStyle = (slot: PageSlot) => {
    if (slot.status === "Missing") return { bg: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" };
    if (slot.status === "Human_Review") return { bg: "rgba(34, 197, 94, 0.8)", color: "white", border: "2px solid var(--success)" };
    if (slot.status === "AI_Passed") return { bg: "var(--success)", color: "white", border: "2px solid var(--success)" };
    return { bg: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" };
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>Upload Worksheets</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Snap a photo of the worksheet — 20-page Nursery template</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* Left Column */}
        <div>
          {/* School & Student Selection */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>School</label>
                <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 14 }}>
                  {schools.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Student</label>
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 14 }}>
                  {students.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.studentCode})</option>))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>Template (Ground Truth)</label>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} disabled={filteredTemplates.length === 0} style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, outline: "none" }}>
                {filteredTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.grade})</option>
                ))}
                {filteredTemplates.length === 0 && <option value="">No templates available for this grade</option>}
              </select>
            </div>
          </div>

          {/* Image Upload Zone */}
          <div className="glass-card" style={{ padding: 32 }}>
            {!preview ? (
              <div {...getRootProps()} style={{ padding: 50, textAlign: "center", border: "2px dashed var(--border-subtle)", borderRadius: "var(--radius)", cursor: "pointer", background: isDragActive ? "var(--accent-glow)" : "transparent" }}>
                <input {...getInputProps()} />
                <div style={{ fontSize: 56, marginBottom: 16 }}>📷</div>
                <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Take a Photo / Select Image</div>
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Drag & drop or click to browse</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Supports: JPG, PNG, WebP (max 50MB)</div>
              </div>
            ) : (
              <div style={{ position: "relative", width: "100%", maxHeight: 800, textAlign: "center" }}>
                <div style={{ display: "inline-block", position: "relative", maxWidth: "100%" }}>
                  <img src={preview} alt="Preview" style={{ width: "100%", borderRadius: "var(--radius)", maxHeight: 800, objectFit: "contain", display: "block" }} />
                  
                  {/* Overlay Bounding Boxes */}
                  {pageDetails?.questions?.map((q: any) => {
                    const isCorrect = q.score > 0 && q.score === q.maxScore;
                    const isPartial = q.score > 0 && q.score < q.maxScore;
                    const colorCode = isCorrect ? "34, 197, 94" : isPartial ? "245, 158, 11" : "239, 68, 68";
                    const colorVar = isCorrect ? "var(--success)" : isPartial ? "var(--warning)" : "var(--danger)";
                    return (
                      <div
                        key={q.questionId || q.id}
                        title={`Score: ${q.score}/${q.maxScore}\nConfidence: ${(q.confidence * 100).toFixed(0)}%`}
                        style={{
                          position: "absolute",
                          left: `${(q.boundingBox.x / 1248) * 100}%`,
                          top: `${(q.boundingBox.y / 1700) * 100}%`,
                          width: `${(q.boundingBox.w / 1248) * 100}%`,
                          height: `${(q.boundingBox.h / 1700) * 100}%`,
                          border: `3px solid ${colorVar}`,
                          backgroundColor: `rgba(${colorCode}, 0.2)`,
                          pointerEvents: "auto",
                          cursor: "help",
                          borderRadius: 6
                        }}
                      />
                    );
                  })}
                </div>
                <button onClick={clearImage} style={{ position: "absolute", top: 10, right: 10, padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(0,0,0,0.7)", color: "white", cursor: "pointer", fontSize: 14 }}>✕ Clear</button>
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 16, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Page Number (1-20)</label>
                <input type="number" min={1} max={20} value={pageNumber} onChange={(e) => setPageNumber(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))} style={{ width: "100%", padding: "12px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontSize: 16, fontWeight: 600, textAlign: "center" }} />
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>Expected: </span>
                  <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{PAGE_TYPE_MAP[pageNumber]}</span>
                </div>
              </div>
              <button onClick={handleUpload} disabled={!file || uploading || !selectedStudent} style={{ padding: "12px 32px", fontSize: 15, fontWeight: 600, borderRadius: "var(--radius)", background: "var(--accent-primary)", color: "white", border: "none", cursor: !file || uploading ? "not-allowed" : "pointer", opacity: !file || uploading ? 0.5 : 1 }}>
                {uploading ? "⏳ Uploading..." : isUpdating ? `🔄 Update Page ${pageNumber}` : `📤 Upload Page ${pageNumber}`}
              </button>
            </div>
          </div>

          {result && (
            <div className="glass-card animate-fade-in" style={{ marginTop: 24, padding: 24, borderColor: result.needs_human_review ? "rgba(34, 197, 94, 0.5)" : "rgba(34, 197, 94, 0.3)", background: result.needs_human_review ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>{result.needs_human_review ? "⚠️" : "✅"}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{result.needs_human_review ? "Flagged for Human Review" : "Auto-Graded"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>AI Confidence: {(result.ai_confidence * 100).toFixed(0)}%</div>
                  {result.expected_description && (
                    <div style={{ fontSize: 12, color: "var(--accent-primary)", marginTop: 4 }}>Expected: {result.expected_description}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="glass-card animate-fade-in" style={{ marginTop: 24, padding: 24, borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>❌</span>
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - 20-Slot Grid */}
        <div>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Page Progress</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{filledSlots}/20 uploaded</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {pageSlots.map((slot) => {
                const style = getSlotStyle(slot);
                return (
                  <div key={slot.pageNumber} onClick={() => handleSlotClick(slot.pageNumber)} style={{ aspectRatio: "1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", background: style.bg, border: pageNumber === slot.pageNumber ? "2px solid var(--accent-primary)" : style.border, color: style.color }}>
                    {slot.status === "Missing" ? slot.pageNumber : slot.status === "Human_Review" ? "⚠️" : "✓"}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }} /> Missing</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--success)" }} /> AI Passed</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(34, 197, 94, 0.8)", border: "2px solid var(--success)" }} /> Human Review ({humanReviewCount})</div>
            </div>

            {selectedStudent && (
              <div style={{ marginTop: 20, padding: 16, borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Selected Student</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{students.find((s) => s.id === selectedStudent)?.name || "-"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Code: {students.find((s) => s.id === selectedStudent)?.studentCode || "-"}</div>
              </div>
            )}

            {filledSlots === 20 && (
              <button 
                onClick={() => router.push("/results")} 
                style={{ width: "100%", marginTop: 24, padding: "16px 20px", fontSize: 16, fontWeight: 700, borderRadius: "var(--radius)", background: "var(--success)", color: "white", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(34,197,94,0.3)" }}
              >
                Submit Final Evaluation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}