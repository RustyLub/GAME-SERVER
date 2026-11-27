import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const configuredSiteOrigin = process.env.SITE_ORIGIN?.trim() || "https://rusty-lub.online";
const parsedSiteOrigin = new URL(configuredSiteOrigin);
if (parsedSiteOrigin.protocol !== "https:" || parsedSiteOrigin.username || parsedSiteOrigin.password ||
    parsedSiteOrigin.pathname !== "/" || parsedSiteOrigin.search || parsedSiteOrigin.hash) {
  throw new Error("SITE_ORIGIN must be an HTTPS origin without a path, query or credentials.");
}
const SITE_ORIGIN = parsedSiteOrigin.origin;
if (!["https://rusty-lub.online", "https://rusty-lub.ru"].includes(SITE_ORIGIN)) {
  throw new Error("SITE_ORIGIN must be one of the two approved Rusty.Lub domains.");
}

const root = process.cwd();
const dist = path.join(root, "dist");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const serverEntry = pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href;
const { render, serverRoutes } = await import(serverEntry);
const routes = [
  "/", "/servers", "/wipes", "/rules", "/support", "/privacy", "/cookies", "/terms",
  "/account", "/link", "/leaderboards", "/store",
  "/en", "/en/servers", "/en/wipes", "/en/rules", "/en/support", "/en/privacy", "/en/cookies",
  "/en/terms", "/en/account", "/en/link", "/en/leaderboards", "/en/store",
  ...serverRoutes,
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

for (const route of routes) {
  const result = render(route);
  const english = route.startsWith("/en");
  const canonical = SITE_ORIGIN + (route === "/" ? "/" : route);
  const image = SITE_ORIGIN + "/" + (english ? "og-en.png" : "og-ru.png");
  let html = template
    .replace(/<html lang="[^"]*">/, '<html lang="' + (english ? "en" : "ru") + '">')
    .replace(/<title>[^<]*<\/title>/, "<title>" + escapeHtml(result.meta.title) + "</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="' + (result.noindex ? "noindex, nofollow" : "index, follow") + '" />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '<link rel="canonical" href="' + canonical + '" />')
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, '<meta property="og:title" content="' + escapeHtml(result.meta.title) + '" />')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, '<meta property="og:description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, '<meta property="og:url" content="' + canonical + '" />')
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/, '<meta property="og:image" content="' + image + '" />')
    .replace(/<meta property="og:locale" content="[^"]*"\s*\/>/, '<meta property="og:locale" content="' + (english ? "en_US" : "ru_RU") + '" />')
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, '<meta name="twitter:title" content="' + escapeHtml(result.meta.title) + '" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, '<meta name="twitter:description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, '<meta name="twitter:image" content="' + image + '" />')
    .replace('<div id="root"></div>', '<div id="root">' + result.html + '</div>');
  const output = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html, "utf8");
  console.log("Prerendered " + route + " -> " + path.relative(dist, output));
}

function notFoundHtml(pathname, english) {
  const result = render(pathname);
  const canonical = SITE_ORIGIN + (english ? "/en/404.html" : "/404.html");
  const image = SITE_ORIGIN + "/" + (english ? "og-en.png" : "og-ru.png");
  const title = english ? "Page not found — Rusty.Lub" : "Страница не найдена — Rusty.Lub";
  const description = english ? "The requested page could not be found." : "Запрошенная страница не найдена.";
  return template
    .replace(/<html lang="[^"]*">/, '<html lang="' + (english ? "en" : "ru") + '">')
    .replace(/<title>[^<]*<\/title>/, "<title>" + title + "</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="' + description + '" />')
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '<link rel="canonical" href="' + canonical + '" />')
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, '<meta property="og:title" content="' + title + '" />')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, '<meta property="og:description" content="' + description + '" />')
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, '<meta property="og:url" content="' + canonical + '" />')
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/, '<meta property="og:image" content="' + image + '" />')
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, '<meta name="twitter:title" content="' + title + '" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, '<meta name="twitter:description" content="' + description + '" />')
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, '<meta name="twitter:image" content="' + image + '" />')
    .replace('<div id="root"></div>', '<div id="root">' + result.html + '</div>');
}

await fs.writeFile(path.join(dist, "404.html"), notFoundHtml("/__not_found__", false), "utf8");
await fs.mkdir(path.join(dist, "en"), { recursive: true });
await fs.writeFile(path.join(dist, "en", "404.html"), notFoundHtml("/en/__not_found__", true), "utf8");
console.log("Prerendered RU and EN 404 pages");

const sitemapPath = path.join(dist, "sitemap.xml");
let sitemap = await fs.readFile(sitemapPath, "utf8");
sitemap = sitemap.replaceAll("https://rusty-lub.online", SITE_ORIGIN);
for (const route of serverRoutes) {
  const url = SITE_ORIGIN + route;
  if (sitemap.includes("<loc>" + url + "</loc>")) continue;
  const priority = route.startsWith("/en/") ? "0.7" : "0.8";
  sitemap = sitemap.replace("</urlset>", "  <url><loc>" + url + "</loc><changefreq>monthly</changefreq><priority>" + priority + "</priority></url>\n</urlset>");
}
await fs.writeFile(sitemapPath, sitemap, "utf8");
const robotsPath = path.join(dist, "robots.txt");
const robots = (await fs.readFile(robotsPath, "utf8")).replaceAll("https://rusty-lub.online", SITE_ORIGIN);
await fs.writeFile(robotsPath, robots, "utf8");
console.log("Updated sitemap with all configured server detail routes");
