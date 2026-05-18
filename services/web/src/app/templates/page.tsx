"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { getTemplates, uploadTemplate } from "@/lib/api";

interface Template {
  id: string;
  name: string;
  grade: string;
  pageCount: number;
  createdAt: string;
}

interface TemplatePage {
  pageNumber: number;
  questionType: number;
  description: string;
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templatePages, setTemplatePages] = useState<TemplatePage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newGrade, setNewGrade] = useState("nursery");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) setFile(accepted[0]);
    },
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const { getRootProps: getKeyRootProps, getInputProps: getKeyInputProps, isDragActive: isKeyDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) setAnswerKeyFile(accepted[0]);
    },
    accept: { "application/json": [".json"] },
    maxFiles: 1,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) loadTemplatePages(selectedTemplate.id);
  }, [selectedTemplate]);

  async function loadTemplates() {
    try {
      const data = await getTemplates();
      setTemplates(data);
      if (data.length > 0) setSelectedTemplate(data[0]);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  async function loadTemplatePages(templateId: string) {
    try {
      const data = await getTemplatePages(templateId);
      setTemplatePages(data);
    } catch (err) {
      setTemplatePages([]);
    }
  }

  async function handleUpload() {
    if (!file || !newTemplateName) {
      alert("Please provide template name and upload a PDF");
      return;
    }
    setUploading(true);
    try {
      await uploadTemplate(file, newTemplateName, newGrade, answerKeyFile || undefined);
      alert("Template uploaded! Splitting into pages...");
      loadTemplates();
      setFile(null);
      setAnswerKeyFile(null);
      setNewTemplateName("");
    } catch (err: any) {
      alert(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const questionTypeLabels: Record<number, string> = {
    1: "Circle Correct Answer",
    2: "Tick or Cross",
    3: "Match the Following",
    4: "Color the Image",
    5: "Trace Dotted Line",
    6: "Draw a Shape",
    7: "Count & Write",
    8: "Write Letter/Word",
    9: "Complete Pattern",
    10: "Color N of M",
    11: "Fill Missing Letter",
    12: "Match Pic to Letter",
    13: "Color Words by Rule",
    14: "Rearrange Letters",
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Template Manager</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Upload master PDFs and map grading logic for each page</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24 }}>
        {/* Left - Upload New Template */}
        <div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Upload Master PDF</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Template Name</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Nursery Worksheet 2024"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Grade Level</label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              >
                <option value="nursery">Nursery</option>
                <option value="lkg">LKG</option>
                <option value="ukg">UKG</option>
              </select>
            </div>

            <div
              {...getRootProps()}
              style={{
                padding: 32,
                textAlign: "center",
                border: "2px dashed var(--border-subtle)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              <input {...getInputProps()} />
              <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 600 }}>{file ? file.name : "Drop Master PDF here"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>or click to browse</div>
            </div>

            <div
              {...getKeyRootProps()}
              style={{
                padding: 16,
                textAlign: "center",
                border: "2px dashed var(--border-subtle)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                marginBottom: 16,
                background: isKeyDragActive ? "var(--accent-glow)" : "transparent",
              }}
            >
              <input {...getKeyInputProps()} />
              <div style={{ fontSize: 24, marginBottom: 8 }}>{answerKeyFile ? "✅" : "🔑"}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{answerKeyFile ? answerKeyFile.name : "Drop JSON Answer Key (Optional)"}</div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || !newTemplateName || uploading}
              style={{ width: "100%", padding: "12px", borderRadius: "var(--radius)", background: "var(--accent-primary)", color: "white", border: "none", fontWeight: 600, cursor: !file || !newTemplateName ? "not-allowed" : "pointer", opacity: !file || !newTemplateName ? 0.5 : 1 }}
            >
              {uploading ? "⏳ Processing..." : "🚀 Upload & Split to 20 Pages"}
            </button>
          </div>

          {/* Existing Templates List */}
          <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Existing Templates</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "var(--radius)",
                    background: selectedTemplate?.id === t.id ? "var(--accent-glow)" : "var(--bg-secondary)",
                    border: selectedTemplate?.id === t.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12, marginTop: 4 }}>
                    <span>{t.grade.toUpperCase()}</span>
                    <span>{t.pageCount} pages</span>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No templates yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Page Mapping Grid */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {selectedTemplate ? `${selectedTemplate.name} - Page Mapping` : "Select a Template"}
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
            Configure the grading logic for each of the 20 pages
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {templatePages.map((page) => (
              <div
                key={page.pageNumber}
                style={{
                  padding: 16,
                  borderRadius: "var(--radius)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--accent-primary)" }}>Page {page.pageNumber}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{questionTypeLabels[page.questionType] || `Type ${page.questionType}`}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{page.description}</div>
              </div>
            ))}
            {templatePages.length === 0 && selectedTemplate && (
              <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                No page mapping configured yet
              </div>
            )}
          </div>

          {!selectedTemplate && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div>Select a template to view its page mapping</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}