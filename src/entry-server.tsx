import { renderToString } from "react-dom/server";
import App from "./App";
import { pageMeta } from "./pages/Pages";

export function render(path: string) {
  const normalizedPath = path.replace(/\/$/, "") || "/";
  const meta = pageMeta[normalizedPath] ?? {
    title: "Страница не найдена — Rusty.Lub",
    description: "Запрошенная страница не найдена.",
  };
  return {
    html: renderToString(<App initialPath={normalizedPath} />),
    meta,
    noindex: !pageMeta[normalizedPath] || ["/account", "/link", "/leaderboards", "/store", "/en/account", "/en/link", "/en/leaderboards", "/en/store"].includes(normalizedPath),
  };
}
