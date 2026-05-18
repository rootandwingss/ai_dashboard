"use client";

import { useState, useEffect } from "react";
import { getExceptions, resolveException } from "@/lib/api";

interface ExceptionItem {
  exception_id: string;
  submission_id: string;
  question_id: string;
  cropped_image_url: string;
  ocr_text: string | null;
  expected: string | null;
  confidence: number;
  engine: string;
  grade_level: string;
  status: string;
  created_at: string;
}

const ENGINE_LABELS: Record<string, string> = {
  A: "Contour Detection",
  B: "Color Analysis",
  C: "Shape Analysis",
  D: "OCR + Fuzzy",
};

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    loadExceptions();
  }, [filter]);

  async function loadExceptions() {
    setLoading(true);
    try {
      const data = await getExceptions(filter);
      setExceptions(data.items || []);
    } catch {
      // Orchestrator not running
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id: string, verdict: "approve" | "reject") {
    setResolving(id);
    try {
      await resolveException(id, verdict);
      setExceptions((prev) => prev.filter((e) => e.exception_id !== id));
    } catch (err) {
      console.error("Failed to resolve:", err);
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Exception Review
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
            Review low-confidence grading results that need human verification
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: "var(--radius)", padding: 4 }}>
          {(["pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                background: filter === f ? "var(--accent-primary)" : "transparent",
                color: filter === f ? "white" : "var(--text-muted)",
                transition: "all 0.2s ease",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div
        className="glass-card"
        style={{
          padding: "16px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontWeight: 700, fontSize: 24, color: "var(--warning)" }}>
            {exceptions.length}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {filter} exceptions
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {filter === "pending" && exceptions.length > 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Review each item and approve (full marks) or reject (zero marks)
          </div>
        )}
      </div>

      {/* Exception Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          Loading exceptions...
        </div>
      ) : exceptions.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: 60, textAlign: "center" }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {filter === "pending" ? "🎉" : "📋"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            {filter === "pending" ? "All Clear!" : `No ${filter} exceptions`}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {filter === "pending"
              ? "No exceptions need review right now"
              : `Switch to another tab to see other statuses`}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {exceptions.map((exc, i) => (
            <div
              key={exc.exception_id}
              className="glass-card animate-fade-in"
              style={{ padding: 20, animationDelay: `${i * 0.05}s`, opacity: 0 }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: exc.engine === "D" ? "#ec4899" : exc.engine === "B" ? "#f59e0b" : "#6366f1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {exc.engine}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{exc.question_id}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {ENGINE_LABELS[exc.engine] || exc.engine}
                    </div>
                  </div>
                </div>
                <span
                  className="badge badge-warning"
                  style={{ fontSize: 11 }}
                >
                  {(exc.confidence * 100).toFixed(0)}% conf
                </span>
              </div>

              {/* Cropped Image Preview */}
              <div
                style={{
                  width: "100%",
                  height: 140,
                  borderRadius: 8,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                {exc.cropped_image_url ? (
                  <img
                    src={`http://localhost:9000/olympiad-uploads/${exc.cropped_image_url}`}
                    alt={`Cropped ${exc.question_id}`}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.innerHTML =
                        '<span style="color: var(--text-muted); font-size: 13px">Image unavailable</span>';
                    }}
                  />
                ) : (
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No preview</span>
                )}
              </div>

              {/* OCR vs Expected */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div style={{ padding: 10, borderRadius: 8, background: "var(--bg-secondary)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    OCR Read
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--danger)" }}>
                    {exc.ocr_text || "—"}
                  </div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: "var(--bg-secondary)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    Expected
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--success)" }}>
                    {exc.expected || "—"}
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span className="badge badge-info" style={{ fontSize: 10 }}>{exc.grade_level.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {exc.submission_id.slice(0, 10)}...
                </span>
              </div>

              {/* Action Buttons */}
              {filter === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    id={`approve-${exc.exception_id}`}
                    className="btn-success"
                    onClick={() => handleResolve(exc.exception_id, "approve")}
                    disabled={resolving === exc.exception_id}
                    style={{ flex: 1, opacity: resolving === exc.exception_id ? 0.5 : 1 }}
                  >
                    ✓ Approve (Full Marks)
                  </button>
                  <button
                    id={`reject-${exc.exception_id}`}
                    className="btn-danger"
                    onClick={() => handleResolve(exc.exception_id, "reject")}
                    disabled={resolving === exc.exception_id}
                    style={{ flex: 1, opacity: resolving === exc.exception_id ? 0.5 : 1 }}
                  >
                    ✗ Reject (Zero)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
