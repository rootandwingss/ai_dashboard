"use client";

import { useState, useEffect } from "react";
import { getSchools, createSchool } from "@/lib/api";

interface School {
  id: string;
  name: string;
  location: string;
  studentCount?: number;
  pendingReviewCount?: number;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: "", location: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSchools();
  }, []);

  async function loadSchools() {
    try {
      const data = await getSchools();
      // Add mock counts for demo
      const schoolsWithCounts = data.map((s: any, i: number) => ({
        ...s,
        studentCount: Math.floor(Math.random() * 50) + 10,
        pendingReviewCount: i === 0 ? 2 : 0,
      }));
      setSchools(schoolsWithCounts);
    } catch (err) {
      console.error("Failed to load schools:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchool() {
    if (!newSchool.name) {
      alert("School name is required");
      return;
    }
    setCreating(true);
    try {
      await createSchool(newSchool.name, newSchool.location);
      setNewSchool({ name: "", location: "" });
      setShowAddForm(false);
      loadSchools();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create school");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Schools</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Manage schools and view student activity</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          style={{ padding: "12px 24px", borderRadius: "var(--radius)", background: "var(--accent-primary)", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
        >
          + Add School
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Add New School</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>School Name *</label>
              <input
                type="text"
                value={newSchool.name}
                onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                placeholder="e.g., Green Valley Public School"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Location</label>
              <input
                type="text"
                value={newSchool.location}
                onChange={(e) => setNewSchool({ ...newSchool, location: e.target.value })}
                placeholder="e.g., Delhi, Mumbai, etc."
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleCreateSchool}
              disabled={creating}
              style={{ padding: "10px 24px", borderRadius: "var(--radius)", background: "var(--success)", color: "white", border: "none", fontWeight: 600, cursor: creating ? "not-allowed" : "pointer" }}
            >
              {creating ? "Creating..." : "Create School"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ padding: "10px 24px", borderRadius: "var(--radius)", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>School Name</th>
              <th>Location</th>
              <th>Students</th>
              <th>Pending Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40 }}>Loading...</td></tr>
            ) : schools.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No schools yet. Add one to get started.</td></tr>
            ) : (
              schools.map((school) => (
                <tr key={school.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{school.name}</div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{school.location || "—"}</td>
                  <td>
                    <span style={{ padding: "4px 10px", borderRadius: 12, background: "var(--bg-secondary)", fontSize: 13, fontWeight: 600 }}>
                      {school.studentCount}
                    </span>
                  </td>
                  <td>
                    {school.pendingReviewCount && school.pendingReviewCount > 0 ? (
                      <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(34, 197, 94, 0.2)", color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }}></span>
                        {school.pendingReviewCount}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <button style={{ padding: "6px 12px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 12, cursor: "pointer" }}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}