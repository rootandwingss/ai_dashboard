"use client";

import { useState, useEffect } from "react";
import { getSubmissions, getSubmission } from "@/lib/api";

interface Submission {
  id: string;
  studentId: string | null;
  gradeLevel: string;
  templateId: string;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  createdAt: string;
}

interface QuestionDetail {
  question_id: string;
  type: number;
  engine: string;
  score: number;
  max_score: number;
  confidence: number;
}

interface SubmissionDetail {
  submission_id: string;
  grade_level: string;
  template_id: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  questions: QuestionDetail[];
  exceptions: string[];
}

const QUESTION_TYPE_LABELS: Record<number, string> = {
  1: "Circle Correct Answer",
  2: "Tick or Cross",
  3: "Match the Following",
  4: "Color the Image",
  5: "Trace Dotted Line",
  6: "Draw a Shape",
  7: "Count & Answer",
  8: "Write Letter/Word",
  9: "Complete Pattern",
  10: "Color N of M",
  11: "Fill Missing Letter",
  12: "Match Pic to Letter",
  13: "Color Words by Rule",
  14: "Rearrange Letters",
};

const ENGINE_COLORS: Record<string, string> = {
  A: "#6366f1",
  B: "#f59e0b",
  C: "#22c55e",
  D: "#ec4899",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    completed: { cls: "badge-success", label: "Completed" },
    grading: { cls: "badge-info", label: "Grading" },
    splitting: { cls: "badge-info", label: "Splitting" },
    queued: { cls: "badge-info", label: "Queued" },
    has_exceptions: { cls: "badge-warning", label: "Has Exceptions" },
  };
  const info = map[status] || { cls: "badge-info", label: status };
  return <span className={`badge ${info.cls}`}>{info.label}</span>;
}

export default function ResultsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    try {
      const data = await getSubmissions(1, 50);
      setSubmissions(data.items || []);
    } catch {
      // Orchestrator not running — show empty state
    } finally {
      setLoading(false);
    }
  }

  async function selectSubmission(id: string) {
    try {
      const data = await getSubmission(id);
      setSelected(data);
    } catch {
      // handle error
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Grading Results
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          View submission scores and per-question breakdowns
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 24 }}>
        {/* Submissions List */}
        <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>All Submissions</span>
            <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: 8 }}>
              ({submissions.length})
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Loading...
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div>No submissions yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Upload a worksheet to get started</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => selectSubmission(sub.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {sub.studentId || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {sub.id.slice(0, 12)}...
                      </div>
                    </td>
                    <td style={{ textTransform: "uppercase", fontSize: 12, fontWeight: 600 }}>
                      {sub.gradeLevel}
                    </td>
                    <td>
                      {sub.totalScore != null ? (
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                          {sub.totalScore}/{sub.maxScore}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={sub.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="glass-card animate-fade-in" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  Submission Detail
                </h2>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {selected.submission_id}
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {/* Manual Resolution Button */}
            {selected.status !== "completed" && (
              <div style={{ marginBottom: 24, padding: 16, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>Needs Human Review</div>
                <button 
                  onClick={async () => {
                    const ok = confirm("Finalize this submission with the current score?");
                    if (ok) {
                      const { approveSubmission } = await import("@/lib/api");
                      await approveSubmission(selected.submission_id);
                      loadSubmissions();
                      selectSubmission(selected.submission_id);
                    }
                  }}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "var(--success)", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>
                  ✅ Approve & Finalize Score
                </button>
              </div>
            )}

            {/* Score Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <ScoreBox
                label="Total Score"
                value={selected.total_score != null ? `${selected.total_score}/${selected.max_score}` : "—"}
                color="var(--accent-primary)"
              />
              <ScoreBox
                label="Questions"
                value={String(selected.questions.length)}
                color="var(--accent-secondary)"
              />
              <ScoreBox
                label="Exceptions"
                value={String(selected.exceptions.length)}
                color={selected.exceptions.length > 0 ? "var(--warning)" : "var(--success)"}
              />
            </div>

            {/* Per-question breakdown */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Question Breakdown
            </div>

            {selected.questions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                Grading in progress...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.questions.map((q) => (
                  <div
                    key={q.question_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: "var(--radius)",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {/* Engine badge */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: ENGINE_COLORS[q.engine] || "#666",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "white",
                        flexShrink: 0,
                      }}
                    >
                      {q.engine}
                    </div>

                    {/* Question info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        {q.question_id} — {QUESTION_TYPE_LABELS[q.type] || `Type ${q.type}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Confidence: {(q.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Score */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: q.score >= q.max_score ? "var(--success)" : q.score > 0 ? "var(--warning)" : "var(--danger)",
                      }}
                    >
                      {q.score}/{q.max_score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius)",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
    </div>
  );
}
