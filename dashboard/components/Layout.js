import Link from "next/link";
import { useRouter } from "next/router";
import { GearIcon } from "./Icons";

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
          aria-label="Settings"
          title="Settings"
        >
          <GearIcon width={20} height={20} />
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
          padding: 22px 26px;
          border-radius: 999px;
          background: var(--glass-strong);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-sm);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 1.1rem;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
        }
        .nav-link {
          display: flex;
          align-items: center;
          color: var(--muted);
          padding: 10px;
          border-radius: 999px;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .nav-link:hover {
          background: var(--surface-muted);
          color: var(--text);
        }
        .nav-link.active {
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
