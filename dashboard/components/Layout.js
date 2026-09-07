import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ children }) {
  const router = useRouter();
  return (
    <div>
      <nav className="nav">
        <Link href="/" className="brand">
          Stux Agent
        </Link>
        <Link
          href="/settings"
          className={`nav-link${router.pathname === "/settings" ? " active" : ""}`}
        >
          ⚙ Settings
        </Link>
      </nav>
      {children}
      <style jsx>{`
        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px clamp(16px, 4vw, 48px);
          border-bottom: 1px solid var(--border);
          background: var(--card);
        }
        .brand {
          font-weight: 700;
          text-decoration: none;
          color: var(--text);
          font-size: 0.95rem;
        }
        .nav-link {
          text-decoration: none;
          color: var(--muted);
          font-size: 0.9rem;
          padding: 6px 12px;
          border-radius: 8px;
        }
        .nav-link.active,
        .nav-link:hover {
          background: var(--gray-bg);
          color: var(--text);
        }
      `}</style>
    </div>
  );
}
