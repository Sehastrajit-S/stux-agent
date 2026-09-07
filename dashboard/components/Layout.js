import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ children }) {
  const router = useRouter();
  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="brand">
          <span className="dot" />
          Stux Agent
        </Link>
        <Link
          href="/settings"
          className={`nav-link${router.pathname === "/settings" ? " active" : ""}`}
        >
          ⚙ Settings
        </Link>
      </nav>
      <div className="content">{children}</div>
      <style jsx>{`
        .page {
          min-height: 100vh;
        }
        .nav {
          position: sticky;
          top: 16px;
          z-index: 10;
          margin: 16px clamp(16px, 4vw, 48px) 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          border-radius: 999px;
          background: var(--glass-strong);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-sm);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          text-decoration: none;
          color: var(--text);
          font-size: 0.92rem;
          letter-spacing: -0.01em;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          box-shadow: 0 0 0 4px var(--accent-soft);
        }
        .nav-link {
          text-decoration: none;
          color: var(--muted);
          font-size: 0.85rem;
          padding: 7px 14px;
          border-radius: 999px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .nav-link.active,
        .nav-link:hover {
          background: var(--accent-soft);
          color: var(--accent-strong);
        }
        .content {
          padding-bottom: 24px;
        }
      `}</style>
    </div>
  );
}
