export function parseFrontendOrigins(primaryOrigin, configuredOrigins = "") {
  const candidates = [
    primaryOrigin,
    ...String(configuredOrigins || "").split(";").map((value) => value.trim()).filter(Boolean),
  ];
  const origins = candidates.map((value) => {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.origin !== value) {
      throw new Error("Frontend origins must be HTTPS origins without paths, queries or credentials.");
    }
    return parsed.origin;
  });
  return [...new Set(origins)];
}

export function resolveFrontendOrigin(origin, allowedOrigins) {
  return typeof origin === "string" && allowedOrigins.includes(origin) ? origin : null;
}
