import { Html, Head, Main, NextScript } from "next/document";

const THEME_SCRIPT = `
try {
  var t = localStorage.getItem("stux-theme");
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
} catch (e) {}
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        {/* Runs before hydration so the correct theme applies on first paint, no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
