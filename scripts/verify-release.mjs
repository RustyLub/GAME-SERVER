import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const dist = path.resolve("dist");
const routes = [
  ["/", "index.html", "ru"],
  ["/servers", "servers/index.html", "ru"],
  ["/wipes", "wipes/index.html", "ru"],
  ["/rules", "rules/index.html", "ru"],
  ["/support", "support/index.html", "ru"],
  ["/privacy", "privacy/index.html", "ru"],
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
  ["/en/terms", "en/terms/index.html", "en"],
  ["/en/account", "en/account/index.html", "en"],
  ["/en/link", "en/link/index.html", "en"],
  ["/en/leaderboards", "en/leaderboards/index.html", "en"],
  ["/en/store", "en/store/index.html", "en"],
];

for (const [route, file, language] of routes) {
  const html = await fs.readFile(path.join(dist, file), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/, route + " must have a title");
  assert.match(html, /<meta name="description" content="[^"]+"/, route + " must have a description");
  assert.ok(html.includes("https://rusty-lub.online" + (route === "/" ? "/" : route)), route + " must include its canonical URL");
  assert.ok(html.includes("https://rusty-lub.online/og-" + (language === "en" ? "en" : "ru") + ".svg"), route + " must have its own-domain OG image");
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/, route + " must have a large Twitter card");
  assert.ok(html.includes('<html lang="' + language + '">'), route + " must have correct language");
  const h1Count = (html.match(/<h1/g) || []).length;
  assert.equal(h1Count, 1, route + " must render exactly one h1");
}

for (const [file, language, image] of [
  ["404.html", "ru", "og-ru.svg"],
  ["en/404.html", "en", "og-en.svg"],
]) {
  const html = await fs.readFile(path.join(dist, file), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.ok(html.includes('<html lang="' + language + '">'));
  assert.ok(html.includes("https://rusty-lub.online/" + image));
  assert.equal((html.match(/<h1/g) || []).length, 1);
}

for (const image of ["og-ru.svg", "og-en.svg"]) {
  const svg = await fs.readFile(path.join(dist, image), "utf8");
  assert.match(svg, /width="1200" height="630"/);
}

const sitemap = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes("https://rusty-lub.online/en"));
assert.equal((sitemap.match(/<url>/g) || []).length, 14, "sitemap must contain the 14 public RU/EN routes");

const allAssets = (await fs.readdir(path.join(dist, "assets"))).filter((name) => name.endsWith(".js"));
for (const asset of allAssets) {
  const js = await fs.readFile(path.join(dist, "assets", asset), "utf8");
  for (const forbidden of ["DISCORD_CLIENT_SECRET", "PLATEGA_SECRET", "RCON_PASSWORD", "FIREBASE_SERVICE_ACCOUNT"]) {
    assert.equal(js.includes(forbidden), false, "frontend bundle must not contain " + forbidden);
  }
}
console.log("Release verification passed: 22 routes, RU/EN 404, metadata, OG artwork, sitemap and secret scan.");
