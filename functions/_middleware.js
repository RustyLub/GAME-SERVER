const SITE_ORIGINS = Object.freeze({
  "rusty-lub.online": "https://rusty-lub.online",
  "rusty-lub.ru": "https://rusty-lub.ru",
});

export function resolveSiteOrigin(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return SITE_ORIGINS[host] || null;
}

export function rewriteSiteUrl(value, origin) {
  if (typeof value !== "string" || !value) return value;
  try {
    const parsed = new URL(value, "https://rusty-lub.online");
    if (!SITE_ORIGINS[parsed.hostname]) return value;
    return origin + parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return value;
  }
}

export async function onRequest({ request, next }) {
  const response = await next();
  const url = new URL(request.url);
  const origin = resolveSiteOrigin(url.hostname);
  if (!origin) return response;

  if (response.status === 200 && (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml")) {
    const body = (await response.text()).replaceAll("https://rusty-lub.online", origin);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  if (!(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
    return response;
  }

  return new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(element) {
        element.setAttribute("href", origin + url.pathname);
      },
    })
    .on('meta[property="og:url"]', {
      element(element) {
        element.setAttribute("content", origin + url.pathname);
      },
    })
    .on('meta[property="og:image"]', {
      element(element) {
        const current = element.getAttribute("content");
        const rewritten = rewriteSiteUrl(current, origin);
        if (rewritten) element.setAttribute("content", rewritten);
      },
    })
    .on('meta[property="og:image:secure_url"]', {
      element(element) {
        const current = element.getAttribute("content");
        const rewritten = rewriteSiteUrl(current, origin);
        if (rewritten) element.setAttribute("content", rewritten);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(element) {
        const current = element.getAttribute("content");
        const rewritten = rewriteSiteUrl(current, origin);
        if (rewritten) element.setAttribute("content", rewritten);
      },
    })
    .transform(response);
}
