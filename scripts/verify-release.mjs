import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { resolveSiteOrigin, rewriteSiteUrl } from "../functions/_middleware.js";

assert.equal(resolveSiteOrigin("rusty-lub.online"), "https://rusty-lub.online");
assert.equal(resolveSiteOrigin("RUSTY-LUB.RU"), "https://rusty-lub.ru");
assert.equal(resolveSiteOrigin("www.rusty-lub.ru"), null);
assert.equal(resolveSiteOrigin("untrusted.example"), null);
assert.equal(rewriteSiteUrl("https://rusty-lub.online/og-ru.png", "https://rusty-lub.ru"), "https://rusty-lub.ru/og-ru.png");
assert.equal(rewriteSiteUrl("/og-ru.png", "https://rusty-lub.ru"), "https://rusty-lub.ru/og-ru.png");
assert.equal(rewriteSiteUrl("https://external.example/image.png", "https://rusty-lub.ru"), "https://external.example/image.png");

const configuredSiteOrigin = process.env.SITE_ORIGIN?.trim() || "https://rusty-lub.online";
const parsedSiteOrigin = new URL(configuredSiteOrigin);
assert.equal(parsedSiteOrigin.protocol, "https:", "SITE_ORIGIN must use HTTPS");
assert.equal(parsedSiteOrigin.origin, configuredSiteOrigin, "SITE_ORIGIN must be an origin without path or credentials");
const SITE_ORIGIN = parsedSiteOrigin.origin;
assert.ok(["https://rusty-lub.online", "https://rusty-lub.ru"].includes(SITE_ORIGIN), "SITE_ORIGIN must be an approved Rusty.Lub domain");
assert.equal(resolveSiteOrigin(parsedSiteOrigin.hostname), SITE_ORIGIN, "SITE_ORIGIN must be one of the supported independent production domains");
const dist = path.resolve("dist");
const pagesRoutes = JSON.parse(await fs.readFile(path.join(dist, "_routes.json"), "utf8"));
assert.equal(pagesRoutes.version, 1, "Cloudflare Pages routes config must use version 1");
assert.ok(pagesRoutes.include.includes("/*"), "Cloudflare middleware must cover document and SEO routes");
for (const assetRoute of ["/assets/*", "/*.svg", "/*.png", "/*.webp", "/*.css", "/*.js", "/CNAME", "/_routes.json"]) {
  assert.ok(pagesRoutes.exclude.includes(assetRoute), "Cloudflare middleware should skip static asset route " + assetRoute);
}
assert.ok(!pagesRoutes.exclude.includes("/robots.txt"), "robots.txt must pass through host metadata middleware");
assert.ok(!pagesRoutes.exclude.includes("/sitemap.xml"), "sitemap.xml must pass through host metadata middleware");
await fs.access(path.resolve("functions/_middleware.js"));
const { serverRoutes, noindexRoutes } = await import(pathToFileURL(path.join(process.cwd(), "dist-ssr", "entry-server.js")).href);
const routes = [
  ["/", "index.html", "ru"],
  ["/servers", "servers/index.html", "ru"],
  ["/wipes", "wipes/index.html", "ru"],
  ["/rules", "rules/index.html", "ru"],
  ["/support", "support/index.html", "ru"],
  ["/privacy", "privacy/index.html", "ru"],
  ["/cookies", "cookies/index.html", "ru"],
  ["/terms", "terms/index.html", "ru"],
  ["/account", "account/index.html", "ru"],
  ["/link", "link/index.html", "ru"],
  ["/leaderboards", "leaderboards/index.html", "ru"],
  ["/store", "store/index.html", "ru"],
  ["/en", "en/index.html", "en"],
  ["/en/servers", "en/servers/index.html", "en"],
  ["/en/wipes", "en/wipes/index.html", "en"],
  ["/en/rules", "en/rules/index.html", "en"],
  ["/en/support", "en/support/index.html", "en"],
  ["/en/privacy", "en/privacy/index.html", "en"],
  ["/en/cookies", "en/cookies/index.html", "en"],
  ["/en/terms", "en/terms/index.html", "en"],
  ["/en/account", "en/account/index.html", "en"],
  ["/en/link", "en/link/index.html", "en"],
  ["/en/leaderboards", "en/leaderboards/index.html", "en"],
  ["/en/store", "en/store/index.html", "en"],
];
routes.push(...serverRoutes.map((route) => [route, path.join(route.slice(1), "index.html"), route.startsWith("/en/") ? "en" : "ru"]));
for (const [route, file, language] of routes) {
  const html = await fs.readFile(path.join(dist, file), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/, route + " must have a title");
  assert.match(html, /<meta name="description" content="[^"]+"/, route + " must have a description");
  assert.ok(html.includes(SITE_ORIGIN + (route === "/" ? "/" : route)), route + " must include its canonical URL");
  assert.ok(html.includes(SITE_ORIGIN + "/og-" + (language === "en" ? "en" : "ru") + ".png"), route + " must have its own-domain OG image");
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/, route + " must have a large Twitter card");
  const robotsPolicy = noindexRoutes.includes(route) ? "noindex, nofollow" : "index, follow";
  assert.ok(html.includes('<meta name="robots" content="' + robotsPolicy + '"'), route + " must preserve its indexing policy");
  assert.ok(html.includes('<html lang="' + language + '">'), route + " must have correct language");
  const h1Count = (html.match(/<h1/g) || []).length;
  assert.equal(h1Count, 1, route + " must render exactly one h1");
}

for (const [file, language, image] of [
  ["404.html", "ru", "og-ru.png"],
  ["en/404.html", "en", "og-en.png"],
]) {
  const html = await fs.readFile(path.join(dist, file), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.ok(html.includes('<html lang="' + language + '">'));
  assert.ok(html.includes(SITE_ORIGIN + "/" + image));
  assert.ok(html.includes(SITE_ORIGIN + "/" + (language === "en" ? "en/404.html" : "404.html")));
  assert.equal((html.match(/<h1/g) || []).length, 1);
}

for (const image of ["og-ru.png", "og-en.png"]) {
  const png = await fs.readFile(path.join(dist, image));
  assert.equal(png.readUInt32BE(16), 1200, image + " width");
  assert.equal(png.readUInt32BE(20), 630, image + " height");
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  const webpName = image.replace(".png", ".webp");
  const webp = await fs.readFile(path.join(dist, webpName));
  assert.equal(webp.toString("ascii", 0, 4), "RIFF");
  assert.equal(webp.toString("ascii", 8, 12), "WEBP");
}

const cloudflareRoutes = JSON.parse(await fs.readFile(path.join(dist, "_routes.json"), "utf8"));
assert.ok(cloudflareRoutes.include.includes("/*"), "Cloudflare Pages must include document and SEO routes");
assert.ok(cloudflareRoutes.exclude.includes("/assets/*"), "Cloudflare Pages middleware must skip bundled assets");
assert.ok(!cloudflareRoutes.exclude.includes("/robots.txt"), "Cloudflare Pages must rewrite robots.txt per hostname");
assert.ok(!cloudflareRoutes.exclude.includes("/sitemap.xml"), "Cloudflare Pages must rewrite sitemap.xml per hostname");

const sitemap = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes(SITE_ORIGIN + "/en"));
assert.ok((sitemap.match(/<url>/g) || []).length >= 18, "sitemap must contain the public RU/EN routes");
for (const route of serverRoutes) {
  assert.ok(sitemap.includes("<loc>" + SITE_ORIGIN + route + "</loc>"), route + " must be present in sitemap");
}
for (const route of noindexRoutes) {
  assert.ok(!sitemap.includes("<loc>" + SITE_ORIGIN + route + "</loc>"), route + " must not be present in sitemap");
}
const robots = await fs.readFile(path.join(dist, "robots.txt"), "utf8");
assert.ok(robots.includes("Sitemap: " + SITE_ORIGIN + "/sitemap.xml"), "robots.txt must advertise the production sitemap");

const allAssets = (await fs.readdir(path.join(dist, "assets"))).filter((name) => name.endsWith(".js"));
for (const asset of allAssets) {
  const js = await fs.readFile(path.join(dist, "assets", asset), "utf8");
  for (const forbidden of ["DISCORD_CLIENT_SECRET", "PLATEGA_SECRET", "RCON_PASSWORD", "FIREBASE_SERVICE_ACCOUNT"]) {
    assert.equal(js.includes(forbidden), false, "frontend bundle must not contain " + forbidden);
  }
}
console.log("Release verification passed: 26 routes, RU/EN 404, metadata, OG artwork, sitemap and secret scan.");
