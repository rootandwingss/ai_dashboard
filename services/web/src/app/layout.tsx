import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Mittsure Olympiad Engine",
  description: "Automated grading engine for Olympiad worksheets — Nursery, LKG, UKG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Navbar />
          <main
            style={{
              flex: 1,
              padding: "32px 40px",
              overflowY: "auto",
              maxHeight: "100vh",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

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
