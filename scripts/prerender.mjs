import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dist = path.join(root, "dist");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const serverEntry = pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href;
const { render } = await import(serverEntry);
const routes = [
  "/", "/servers", "/wipes", "/rules", "/support", "/privacy", "/cookies", "/terms",
  "/account", "/link", "/leaderboards", "/store",
  "/en", "/en/servers", "/en/wipes", "/en/rules", "/en/support", "/en/privacy", "/en/cookies",
  "/en/terms", "/en/account", "/en/link", "/en/leaderboards", "/en/store",
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

for (const route of routes) {
  const result = render(route);
  const english = route.startsWith("/en");
  const canonical = "https://rusty-lub.online" + (route === "/" ? "/" : route);
  const image = "https://rusty-lub.online/" + (english ? "og-en.png" : "og-ru.png");
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
  const canonical = english ? "https://rusty-lub.online/en/404.html" : "https://rusty-lub.online/404.html";
  const image = "https://rusty-lub.online/" + (english ? "og-en.png" : "og-ru.png");
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
