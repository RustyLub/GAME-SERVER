import { renderToString } from "react-dom/server";
import App from "./App";
import { pageMeta } from "./pages/Pages";
import { SITE_CONFIG, isNoindexRoute } from "./config/site";

export const serverRoutes = SITE_CONFIG.servers.flatMap((server) => [
  "/servers/" + server.slug,
  "/en/servers/" + server.slug,
]);
export { NOINDEX_ROUTES as noindexRoutes } from "./config/site";

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
    noindex: !pageMeta[normalizedPath] || isNoindexRoute(normalizedPath),
  };
}
