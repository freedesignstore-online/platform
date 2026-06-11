const PUBLIC_INDEX = "stock:index:public";
const PENDING_INDEX = "stock:index:pending";
const ITEM_PREFIX = "stock:item:";
const MAX_ITEMS = 500;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_SVG_SIZE = 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);
const ASSET_TYPES = new Set([
  "photo",
  "illustration",
  "icon",
  "pattern",
  "texture",
  "background",
  "ui",
]);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function error(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, ...extra }, status);
}

export function getStore(env) {
  return {
    bucket: env.FDS_STOCK_BUCKET || env.STOCK_BUCKET,
    kv: env.FDS_STOCK_KV || env.STOCK_KV,
  };
}

export function requireStore(env) {
  const store = getStore(env);
  if (!store.bucket || !store.kv) {
    return {
      missing: true,
      response: error(
        "Community asset storage is not configured. Bind FDS_STOCK_BUCKET to R2 and FDS_STOCK_KV to KV.",
        503
      ),
    };
  }
  return store;
}

export function isAdmin(request, env) {
  const token = env.STOCK_ADMIN_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}

export async function readIndex(kv, key) {
  const value = await kv.get(key, "json");
  return Array.isArray(value) ? value : [];
}

export async function writeIndex(kv, key, ids) {
  await kv.put(key, JSON.stringify([...new Set(ids)].slice(0, MAX_ITEMS)));
}

export async function getItem(kv, id) {
  return kv.get(`${ITEM_PREFIX}${id}`, "json");
}

export async function putItem(kv, item) {
  await kv.put(`${ITEM_PREFIX}${item.id}`, JSON.stringify(item));
}

export async function deleteItem(kv, id) {
  await kv.delete(`${ITEM_PREFIX}${id}`);
}

export async function listItems(kv, key) {
  const ids = await readIndex(kv, key);
  const items = await Promise.all(ids.map((id) => getItem(kv, id)));
  return items.filter(Boolean);
}

export async function addToIndex(kv, key, id) {
  const ids = await readIndex(kv, key);
  await writeIndex(kv, key, [id, ...ids.filter((itemId) => itemId !== id)]);
}

export async function removeFromIndex(kv, key, id) {
  const ids = await readIndex(kv, key);
  await writeIndex(kv, key, ids.filter((itemId) => itemId !== id));
}

export function publicItem(item) {
  return {
    id: item.id,
    source: "community",
    title: item.title,
    category: item.category,
    assetType: item.assetType || "photo",
    author: item.author,
    license: item.license,
    tags: item.tags || [],
    url: `/api/stock/image/${item.id}`,
    download: `/api/stock/image/${item.id}?download=1`,
    filename: item.filename,
    contentType: item.contentType,
    createdAt: item.createdAt,
    status: item.status,
  };
}

export function cleanText(value, fallback, max = 120) {
  return String(value || fallback || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => cleanText(tag, "", 28).toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export function safeFilename(name, contentType) {
  const extFromType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  }[contentType] || "jpg";
  const base = String(name || "stock-photo")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "stock-photo";
  return `${base}.${extFromType}`;
}

export function validateFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    return "Image file is required.";
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPG, PNG, WebP, AVIF, and SVG assets are accepted.";
  }
  if (file.type === "image/svg+xml" && file.size > MAX_SVG_SIZE) {
    return "SVG assets must be under 1 MB.";
  }
  if (!file.size || file.size > MAX_FILE_SIZE) {
    return "Image assets must be under 8 MB.";
  }
  return null;
}

export function cleanAssetType(value) {
  const type = String(value || "photo").toLowerCase();
  return ASSET_TYPES.has(type) ? type : "photo";
}

export async function fileBytes(file) {
  const buffer = await file.arrayBuffer();
  if (file.type !== "image/svg+xml") {
    return buffer;
  }
  const text = new TextDecoder().decode(buffer);
  const unsafe = [
    /<script[\s>]/i,
    /<foreignObject[\s>]/i,
    /\son[a-z]+\s*=/i,
    /javascript:/i,
    /data:text\/html/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
  ];
  if (!/<svg[\s>]/i.test(text) || unsafe.some((pattern) => pattern.test(text))) {
    throw new Error("SVG contains unsupported or unsafe markup.");
  }
  return new TextEncoder().encode(text).buffer;
}

export { PUBLIC_INDEX, PENDING_INDEX };
