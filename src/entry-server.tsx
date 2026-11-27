import { renderToString } from "react-dom/server";
import App from "./App";
import { pageMeta } from "./pages/Pages";

export function render(path: string) {
  const normalizedPath = path.replace(/\/$/, "") || "/";
  const english = normalizedPath === "/en" || normalizedPath.startsWith("/en/");
  const meta = pageMeta[normalizedPath] ?? {
    title: english ? "Page not found — Rusty.Lub" : "Страница не найдена — Rusty.Lub",
    description: english ? "The requested page could not be found." : "Запрошенная страница не найдена.",
  };
  return {
    html: renderToString(<App initialPath={normalizedPath} />),
    meta,
    noindex: !pageMeta[normalizedPath] || ["/account", "/link", "/leaderboards", "/store", "/en/account", "/en/link", "/en/leaderboards", "/en/store"].includes(normalizedPath),
  };
}
