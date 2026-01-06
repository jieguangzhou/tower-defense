import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiBaseUrl = process.env.API_BASE_URL || "";
const config = {
  apiBaseUrl,
};

const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "config.js"
);

const payload = `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(target, payload, "utf8");
console.log(`[config] API_BASE_URL=${apiBaseUrl || "(same origin)"}`);
