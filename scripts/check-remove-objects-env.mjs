import fs from "node:fs";
import path from "node:path";

const envFiles = [".env", ".env.local"];

const requiredKeys = [
  "NEXTAUTH_URL",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY",
  "R2_SECRET_KEY",
  "R2_URL_BASE",
  "R2_BUCKET",
  "R2_ACCOUNT_ID",
  "RUNNINGHUB_API_BASE_URL",
  "RUNNINGHUB_API_KEY",
];

const optionalKeysWithDefaults = [
  ["RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID", "2062736566451269633"],
  ["RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID", "2063827026330607618"],
  ["RUNNINGHUB_OBJECT_DETECT_IMAGE_NODE_ID", "image"],
  ["RUNNINGHUB_OBJECT_DETECT_IMAGE_FIELD_NAME", "image"],
  ["RUNNINGHUB_OBJECT_DETECT_PROMPT_NODE_ID", "prompt"],
  ["RUNNINGHUB_OBJECT_DETECT_PROMPT_FIELD_NAME", "prompt"],
  ["RUNNINGHUB_OBJECT_SEGMENT_IMAGE_NODE_ID", "19"],
  ["RUNNINGHUB_OBJECT_SEGMENT_IMAGE_FIELD_NAME", "image"],
  ["RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_NODE_ID", "25"],
  ["RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_FIELD_NAME", "info"],
  ["RUNNINGHUB_OBJECT_REMOVE_IMAGE_NODE_ID", "94"],
  ["RUNNINGHUB_OBJECT_REMOVE_IMAGE_FIELD_NAME", "image"],
  ["RUNNINGHUB_OBJECT_REMOVE_MASK_NODE_ID", "103"],
  ["RUNNINGHUB_OBJECT_REMOVE_MASK_FIELD_NAME", "image"],
  ["RUNNINGHUB_OBJECT_REMOVE_PROMPT_NODE_ID", "6"],
  ["RUNNINGHUB_OBJECT_REMOVE_PROMPT_FIELD_NAME", "text"],
];

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

function isMissing(value) {
  return !value || value === "placeholder";
}

const merged = {};
const sources = {};

for (const envFile of envFiles) {
  const fullPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(fullPath)) continue;

  const values = parseEnvFile(fs.readFileSync(fullPath, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    merged[key] = value;
    sources[key] = envFile;
  }
}

const missingRequired = requiredKeys.filter((key) => isMissing(merged[key]));
const usingDefaults = optionalKeysWithDefaults
  .filter(([key]) => isMissing(merged[key]))
  .map(([key, fallback]) => ({ key, fallback }));

console.log("Remove Objects env check");
console.log(`Loaded files: ${envFiles.filter((file) => fs.existsSync(path.join(process.cwd(), file))).join(", ") || "none"}`);
console.log("");

for (const key of requiredKeys) {
  const status = isMissing(merged[key]) ? "missing" : `set via ${sources[key]}`;
  console.log(`${key}: ${status}`);
}

console.log("");

if (usingDefaults.length > 0) {
  console.log("Optional node mappings currently falling back to built-in defaults:");
  for (const { key, fallback } of usingDefaults) {
    console.log(`- ${key} -> ${fallback}`);
  }
  console.log("");
}

if (missingRequired.length > 0) {
  console.error("Missing required keys:");
  for (const key of missingRequired) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log("All required remove-objects env keys are configured.");
