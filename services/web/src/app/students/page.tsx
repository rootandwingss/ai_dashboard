"use client";

import { useState, useEffect } from "react";
import { getSchools, getStudents, createStudent } from "@/lib/api";

interface School { id: string; name: string }
interface Student { id: string; name: string; grade: string; studentCode: string; schoolId: string; pagesUploaded: number; pendingReview: number }

export default function StudentsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [newStudent, setNewStudent] = useState({ name: "", grade: "nursery", studentCode: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchool) loadStudents(selectedSchool);
  }, [selectedSchool]);

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
      // Add mock data for demo
      const studentsWithProgress = data.map((s: any, i: number) => ({
        ...s,
        pagesUploaded: Math.floor(Math.random() * 15) + 1,
        pendingReview: i === 0 ? 1 : 0,
      }));
      setStudents(studentsWithProgress);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStudent() {
    if (!newStudent.name || !selectedSchool) {
      alert("Student name and school are required");
      return;
    }
    setCreating(true);
    try {
      await createStudent(newStudent.name, newStudent.grade, selectedSchool, newStudent.studentCode);
      setNewStudent({ name: "", grade: "nursery", studentCode: "" });
      setShowAddForm(false);
      loadStudents(selectedSchool);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create student");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Students</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Manage students and view their worksheet progress</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          style={{ padding: "12px 24px", borderRadius: "var(--radius)", background: "var(--accent-primary)", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
        >
          + Add Student
        </button>
      </div>

      {/* School Filter */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>Filter by School:</span>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          style={{ padding: "8px 16px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
        >
          {schools.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Add New Student</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Student Name *</label>
              <input
                type="text"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                placeholder="e.g., Aarav Sharma"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Student Code</label>
              <input
                type="text"
                value={newStudent.studentCode}
                onChange={(e) => setNewStudent({ ...newStudent, studentCode: e.target.value })}
                placeholder="e.g., GVS001"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Grade</label>
              <select
                value={newStudent.grade}
                onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 14 }}
              >
                <option value="nursery">Nursery</option>
                <option value="lkg">LKG</option>
                <option value="ukg">UKG</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleCreateStudent}
              disabled={creating}
              style={{ padding: "10px 24px", borderRadius: "var(--radius)", background: "var(--success)", color: "white", border: "none", fontWeight: 600, cursor: creating ? "not-allowed" : "pointer" }}
            >
              {creating ? "Creating..." : "Create Student"}
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
              <th>Student</th>
              <th>Code</th>
              <th>Grade</th>
              <th>Pages Uploaded</th>
              <th>Pending Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40 }}>Loading...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No students in this school</td></tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{student.name}</div>
                  </td>
                  <td>
                    <code style={{ background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}>{student.studentCode}</code>
                  </td>
                  <td>
                    <span style={{ textTransform: "uppercase", fontSize: 12, fontWeight: 600, color: "var(--accent-primary)" }}>{student.grade}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 100, height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${(student.pagesUploaded / 20) * 100}%`, height: "100%", background: "var(--success)", borderRadius: 3 }}></div>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{student.pagesUploaded}/20</span>
                    </div>
                  </td>
                  <td>
                    {student.pendingReview > 0 ? (
                      <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(34, 197, 94, 0.2)", color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }}></span>
                        {student.pendingReview}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <a href={`/?student=${student.id}`} style={{ padding: "6px 12px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: 12, cursor: "pointer", textDecoration: "none", color: "var(--text-primary)" }}>
                      Upload
                    </a>
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