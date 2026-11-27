import test from "node:test";
import assert from "node:assert/strict";
import { onRequest, resolveSiteOrigin, rewriteSiteUrl } from "../../functions/_middleware.js";

test("maps only the two approved Rusty.Lub domains", () => {
  assert.equal(resolveSiteOrigin("rusty-lub.online"), "https://rusty-lub.online");
  assert.equal(resolveSiteOrigin("RUSTY-LUB.RU"), "https://rusty-lub.ru");
  assert.equal(resolveSiteOrigin("evil.example"), null);
});

test("rewrites only Rusty.Lub-owned absolute or relative metadata URLs", () => {
  assert.equal(rewriteSiteUrl("https://rusty-lub.online/og-ru.png", "https://rusty-lub.ru"), "https://rusty-lub.ru/og-ru.png");
  assert.equal(rewriteSiteUrl("/og-en.png", "https://rusty-lub.ru"), "https://rusty-lub.ru/og-en.png");
  assert.equal(rewriteSiteUrl("https://cdn.example/image.png", "https://rusty-lub.ru"), "https://cdn.example/image.png");
});

test("rewrites sitemap and robots origins for the .ru hostname", async () => {
  const sitemap = new Response(
    '<urlset><url><loc>https://rusty-lub.online/servers</loc></url></urlset>',
    { headers: { "content-type": "application/xml", "content-length": "80", etag: '"old"' } },
  );
  const rewrittenSitemap = await onRequest({
    request: new Request("https://rusty-lub.ru/sitemap.xml"),
    next: async () => sitemap,
  });
  assert.match(await rewrittenSitemap.text(), /https:\/\/rusty-lub\.ru\/servers/);
  assert.equal(rewrittenSitemap.headers.has("content-length"), false);
  assert.equal(rewrittenSitemap.headers.has("etag"), false);

  const robots = new Response("Sitemap: https://rusty-lub.online/sitemap.xml", {
    headers: { "content-type": "text/plain" },
  });
  const rewrittenRobots = await onRequest({
    request: new Request("https://rusty-lub.ru/robots.txt"),
    next: async () => robots,
  });
  assert.equal(await rewrittenRobots.text(), "Sitemap: https://rusty-lub.ru/sitemap.xml");
});

test("leaves unapproved host responses untouched", async () => {
  const response = new Response("unchanged", { headers: { "content-type": "text/plain" } });
  const result = await onRequest({
    request: new Request("https://evil.example/robots.txt"),
    next: async () => response,
  });
  assert.equal(result, response);
});

test("rewrites canonical and social image metadata on HTML responses", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "HTMLRewriter");
  class TestHTMLRewriter {
    handlers = [];
    on(selector, handler) {
      this.handlers.push({ selector, handler });
      return this;
    }
    transform(response) {
      const nodes = [
        { selector: 'link[rel="canonical"]', attributes: { href: "https://rusty-lub.online/servers/eu-long" } },
        { selector: 'meta[property="og:url"]', attributes: { content: "https://rusty-lub.online/servers/eu-long" } },
        { selector: 'meta[property="og:image"]', attributes: { content: "https://rusty-lub.online/og-ru.png" } },
        { selector: 'meta[property="og:image:secure_url"]', attributes: { content: "https://rusty-lub.online/og-ru.png" } },
        { selector: 'meta[name="twitter:image"]', attributes: { content: "https://rusty-lub.online/og-ru.png" } },
      ];
      for (const node of nodes) {
        const registration = this.handlers.find((item) => item.selector === node.selector);
        const element = {
          getAttribute: (name) => node.attributes[name] ?? null,
          setAttribute: (name, value) => { node.attributes[name] = value; },
        };
        registration?.handler.element(element);
      }
      return new Response(JSON.stringify(nodes.map((node) => node.attributes)), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }
  }
  globalThis.HTMLRewriter = TestHTMLRewriter;
  try {
    const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    const rewritten = await onRequest({
      request: new Request("https://rusty-lub.ru/servers/eu-long"),
      next: async () => response,
    });
    const [canonical, ogUrl, ogImage, secureImage, twitterImage] = await rewritten.json();
    assert.equal(canonical.href, "https://rusty-lub.ru/servers/eu-long");
    assert.equal(ogUrl.content, "https://rusty-lub.ru/servers/eu-long");
    assert.equal(ogImage.content, "https://rusty-lub.ru/og-ru.png");
    assert.equal(secureImage.content, "https://rusty-lub.ru/og-ru.png");
    assert.equal(twitterImage.content, "https://rusty-lub.ru/og-ru.png");
  } finally {
    if (previous) Object.defineProperty(globalThis, "HTMLRewriter", previous);
    else delete globalThis.HTMLRewriter;
  }
});
