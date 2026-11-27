import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.resolve("public");
for (const language of ["ru", "en"]) {
  const source = await fs.readFile(path.join(publicDir, "og-" + language + ".svg"));
  const base = sharp(source, { density: 144 }).resize(1200, 630, { fit: "fill" });
  await base.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(publicDir, "og-" + language + ".png"));
  await base.clone().webp({ quality: 86, effort: 6 }).toFile(path.join(publicDir, "og-" + language + ".webp"));
}
console.log("Generated 1200x630 RU/EN Open Graph PNG and WebP assets.");
