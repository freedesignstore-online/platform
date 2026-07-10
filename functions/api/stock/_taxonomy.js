// FDS asset taxonomy — single source of truth for Pages Functions.
// The MCP worker (workers/mcp/src/index.ts) mirrors these constants by
// convention (the two runtimes deliberately vendor-duplicate; keep in sync).

export const ASSET_TYPE_LIST = [
  { id: "photo", label: "Photos" },
  { id: "illustration", label: "Illustrations" },
  { id: "vector", label: "Vectors" },
  { id: "icon", label: "Icons" },
  { id: "pattern", label: "Patterns" },
  { id: "texture", label: "Textures" },
  { id: "background", label: "Backgrounds" },
  { id: "ui", label: "UI Kits" },
  { id: "mockup", label: "Mockups" },
  { id: "template", label: "Templates" },
  { id: "3d-render", label: "3D Renders" },
  { id: "video", label: "Videos" },
  { id: "animation", label: "Animations" },
];

export const ASSET_TYPES = new Set(ASSET_TYPE_LIST.map((t) => t.id));

export const ORIGIN_LIST = [
  { id: "photograph", label: "Photograph" },
  { id: "ai-generated", label: "AI Generated" },
  { id: "3d-render", label: "3D Render" },
  { id: "digital-illustration", label: "Digital Illustration" },
  { id: "vector-art", label: "Vector Art" },
  { id: "scan", label: "Scan" },
  { id: "mixed", label: "Mixed Media" },
];

export const ORIGINS = new Set(ORIGIN_LIST.map((o) => o.id));

export const LICENSE_LIST = [
  { id: "cc0", label: "CC0 / Public Domain" },
  { id: "fds-free", label: "FreeDesignStore Free Release" },
  { id: "attribution", label: "Free with Attribution" },
];

export const LICENSES = new Set(LICENSE_LIST.map((l) => l.id));

export const PURPOSES = new Set([
  "profile_background",
  "hero_image",
  "thumbnail",
  "wallpaper",
]);

export function cleanAssetType(value) {
  const type = String(value || "photo").toLowerCase();
  return ASSET_TYPES.has(type) ? type : "photo";
}

export function isAssetType(value) {
  return ASSET_TYPES.has(String(value || "").toLowerCase());
}

export function cleanOrigin(value) {
  const origin = String(value || "").toLowerCase();
  return ORIGINS.has(origin) ? origin : null;
}

export function cleanOriginDetail(tool, model, prompt) {
  const detail = {};
  const cleanedTool = String(tool || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const cleanedModel = String(model || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const cleanedPrompt = String(prompt || "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (cleanedTool) detail.tool = cleanedTool;
  if (cleanedModel) detail.model = cleanedModel;
  if (cleanedPrompt) detail.prompt = cleanedPrompt;
  return Object.keys(detail).length ? detail : undefined;
}

export function cleanLicenseId(value) {
  const id = String(value || "").toLowerCase();
  if (LICENSES.has(id)) return id;
  // Map legacy human labels to license ids.
  const label = String(value || "").toLowerCase();
  if (label.includes("cc0") || label.includes("public domain")) return "cc0";
  if (label.includes("attribution")) return "attribution";
  return "fds-free";
}

export function licenseLabel(id) {
  return LICENSE_LIST.find((l) => l.id === id)?.label || LICENSE_LIST[1].label;
}

export function cleanPurpose(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list
    .map((p) => String(p || "").trim().toLowerCase())
    .filter((p) => PURPOSES.has(p))
    .slice(0, 4);
}
