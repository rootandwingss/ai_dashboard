"use client";

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: "var(--radius)",
        color: "var(--text-secondary)",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 500,
        transition: "all 0.2s ease",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--accent-glow)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </a>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <div style={{ padding: "12px 16px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </div>
  );
}

export function Navbar() {
  return (
    <nav
      style={{
        width: 260,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent-primary), #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "white",
            boxShadow: "0 2px 12px rgba(99, 102, 241, 0.4)",
          }}
        >
          M
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            Mittsure
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
            OLYMPIAD ENGINE
          </div>
        </div>
      </div>

      <NavSection label="Templates" />
      <NavLink href="/templates" icon="📄" label="Template Manager" />

      <NavSection label="School Management" />
      <NavLink href="/schools" icon="🏫" label="Schools" />
      <NavLink href="/students" icon="👨‍🎓" label="Students" />

      <NavSection label="Grading" />
      <NavLink href="/" icon="📤" label="Upload Worksheets" />
      <NavLink href="/results" icon="📊" label="Grading Results" />
      <NavLink href="/exceptions" icon="⚠️" label="Exception Review" />

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--radius)",
          background: "rgba(34, 197, 94, 0.08)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          fontSize: 12,
        }}
      >
        <div style={{ color: "var(--success)", fontWeight: 600, marginBottom: 4 }}>
          ● System Online
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
          All engines operational
        </div>
      </div>
    </nav>
  );
}