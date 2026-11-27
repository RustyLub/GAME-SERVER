const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_API_BASE_URL",
];

const values = Object.fromEntries(required.map((name) => [name, process.env[name]?.trim() || ""]));
const missing = required.filter((name) => !values[name]);

if (missing.length === required.length) {
  console.warn("::warning::Firebase and backend public configuration is not connected. Missing GitHub Actions Variables: " + missing.join(", "));
  process.exit(0);
}

if (missing.length) {
  console.warn("::warning::Public configuration is incomplete. Missing GitHub Actions Variables: " + missing.join(", "));
  process.exit(0);
}

if (!/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(values.VITE_FIREBASE_PROJECT_ID)) {
  throw new Error("VITE_FIREBASE_PROJECT_ID is not a valid Firebase project ID.");
}
if (!/^\\d+$/.test(values.VITE_FIREBASE_MESSAGING_SENDER_ID)) {
  throw new Error("VITE_FIREBASE_MESSAGING_SENDER_ID must contain only digits.");
}
if (/[\\s/]/.test(values.VITE_FIREBASE_AUTH_DOMAIN)) {
  throw new Error("VITE_FIREBASE_AUTH_DOMAIN must be a hostname, not a URL.");
}

const backendUrl = new URL(values.VITE_API_BASE_URL);
if (backendUrl.protocol !== "https:" || backendUrl.username || backendUrl.password ||
    backendUrl.pathname !== "/" || backendUrl.search || backendUrl.hash) {
  throw new Error("VITE_API_BASE_URL must be an HTTPS origin without a path, query or credentials.");
}

console.log("Public Firebase and backend configuration is complete and structurally valid. Values were not printed.");
