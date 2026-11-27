import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dist = path.join(root, "dist");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const serverEntry = pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href;
const { render } = await import(serverEntry);
const routes = [
  "/", "/servers", "/wipes", "/rules", "/support", "/privacy", "/terms",
  "/account", "/link", "/leaderboards", "/store",
  "/en", "/en/servers", "/en/wipes", "/en/rules", "/en/support", "/en/privacy",
  "/en/terms", "/en/account", "/en/link", "/en/leaderboards", "/en/store",
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

for (const route of routes) {
  const result = render(route);
  const canonical = "https://rusty-lub.online" + (route === "/" ? "/" : route);
  let html = template
    .replace(/<html lang="[^"]*">/, '<html lang="' + (route.startsWith("/en") ? "en" : "ru") + '">')
    .replace(/<title>[^<]*<\/title>/, "<title>" + escapeHtml(result.meta.title) + "</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="' + (result.noindex ? "noindex, nofollow" : "index, follow") + '" />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '<link rel="canonical" href="' + canonical + '" />')
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, '<meta property="og:title" content="' + escapeHtml(result.meta.title) + '" />')
    .replace(/<meta property="og:description" content="[^"]*"\\s*\\/>/, '<meta property="og:description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta name="twitter:title" content="[^"]*"\\s*\\/>/, '<meta name="twitter:title" content="' + escapeHtml(result.meta.title) + '" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\\s*\\/>/, '<meta name="twitter:description" content="' + escapeHtml(result.meta.description) + '" />')
    .replace(/<meta name="twitter:image" content="[^"]*"\\s*\\/>/, '<meta name="twitter:image" content="https://rusty-lub.online/' + (route.startsWith("/en") ? "og-en.svg" : "og-ru.svg") + '" />')
    .replace(/<meta property="og:url" content="[^"]*"\\s*\\/>/, '<meta property="og:url" content="' + canonical + '" />')
    .replace(/<meta property="og:image" content="[^"]*"\\s*\\/>/, '<meta property="og:image" content="https://rusty-lub.online/' + (route.startsWith("/en") ? "og-en.svg" : "og-ru.svg") + '" />')
    .replace(/<meta property="og:locale" content="[^"]*"\\s*\\/>/, '<meta property="og:locale" content="' + (route.startsWith("/en") ? "en_US" : "ru_RU") + '" />')
    .replace('<div id="root"></div>', '<div id="root">' + result.html + '</div>');
  const output = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html, "utf8");
  console.log("Prerendered " + route + " -> " + path.relative(dist, output));
}


const notFound = render("/__not_found__");
const notFoundCanonical = "https://rusty-lub.online/404.html";
const notFoundHtml = template
  .replace(/<title>[^<]*<\/title>/, "<title>Страница не найдена — Rusty.Lub</title>")
  .replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="Запрошенная страница не найдена." />')
  .replace(/<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex, nofollow" />')
  .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '<link rel="canonical" href="' + notFoundCanonical + '" />')
  .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, '<meta property="og:title" content="Страница не найдена — Rusty.Lub" />')
  .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, '<meta property="og:description" content="Запрошенная страница не найдена." />')
  .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, '<meta property="og:url" content="' + notFoundCanonical + '" />')
  .replace('<div id="root"></div>', '<div id="root">' + notFound.html + '</div>');
await fs.writeFile(path.join(dist, "404.html"), notFoundHtml, "utf8");
const notFoundEn = render("/en/__not_found__");
const notFoundEnHtml = template
  .replace(/<html lang="[^"]*">/, '<html lang="en">')
  .replace(/<title>[^<]*<\\/title>/, "<title>Page not found — Rusty.Lub</title>")
  .replace(/<meta name="description" content="[^"]*"\\s*\\/>/, '<meta name="description" content="The requested page could not be found." />')
  .replace(/<meta name="robots" content="[^"]*"\\s*\\/>/, '<meta name="robots" content="noindex, nofollow" />')
  .replace(/<link rel="canonical" href="[^"]*"\\s*\\/>/, '<link rel="canonical" href="https://rusty-lub.online/en/404.html" />')
  .replace(/<meta property="og:title" content="[^"]*"\\s*\\/>/, '<meta property="og:title" content="Page not found — Rusty.Lub" />')
  .replace(/<meta property="og:description" content="[^"]*"\\s*\\/>/, '<meta property="og:description" content="The requested page could not be found." />')
  .replace(/<meta property="og:image" content="[^"]*"\\s*\\/>/, '<meta property="og:image" content="https://rusty-lub.online/og-en.svg" />')
  .replace(/<meta property="og:url" content="[^"]*"\\s*\\/>/, '<meta property="og:url" content="https://rusty-lub.online/en/404.html" />')
  .replace('<div id="root"></div>', '<div id="root">' + notFoundEn.html + '</div>');
await fs.mkdir(path.join(dist, "en"), { recursive: true });
await fs.writeFile(path.join(dist, "en", "404.html"), notFoundEnHtml, "utf8");
console.log("Prerendered RU and EN 404 pages");
