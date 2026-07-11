import { sessionAccount, safeAccountId, accountIndexKey } from "../_session.js";

const PUBLIC_INDEX = "stock:index:public";
const PENDING_INDEX = "stock:index:pending";
const ITEM_PREFIX = "stock:item:";
const PROFILE_PREFIX = "profile:account:";
const HANDLE_PREFIX = "profile:handle:";
const MAX_ITEMS = 500;
const MAX_ACCOUNT_ASSETS = 100;
const MAX_UPLOADS_PER_HOUR = 20;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_SVG_SIZE = 1024 * 1024;
// Multipart bodies buffer in Worker memory (128 MB isolate), so keep video
// uploads well under that. Raising this needs a raw-body upload endpoint.
const MAX_VIDEO_SIZE = 40 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
]);
export {
  ASSET_TYPES,
  ASSET_TYPE_LIST,
  ORIGINS,
  ORIGIN_LIST,
  LICENSES,
  LICENSE_LIST,
  cleanAssetType,
  isAssetType,
  cleanOrigin,
  cleanOriginDetail,
  cleanLicenseId,
  licenseLabel,
  cleanPurpose,
} from "./_taxonomy.js";

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
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

export async function authenticatedAccount(request, env) {
  return sessionAccount(request, env);
}

export async function canViewItem(request, env, item) {
  if (item.status === "public" || isAdmin(request, env)) return true;
  const account = await authenticatedAccount(request, env);
  if (account?.isAdmin) return true;
  return Boolean(account?.accountId && item.ownerAccountId === account.accountId);
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

export function publicItem(item, origin = "") {
  const imagePath = `/api/stock/image/${item.id}`;
  const imageUrl = origin ? new URL(imagePath, origin).toString() : imagePath;
  const downloadUrl = origin ? new URL(`${imagePath}?download=1`, origin).toString() : `${imagePath}?download=1`;
  return {
    id: item.id,
    source: item.source === "hosted" ? "hosted" : "community",
    title: item.title,
    category: item.category,
    assetType: item.assetType || "photo",
    author: item.author,
    attribution: item.attribution || item.author,
    license: item.license,
    licenseUrl: item.licenseUrl,
    tags: item.tags || [],
    url: imageUrl,
    download: downloadUrl,
    filename: item.filename,
    contentType: item.contentType,
    width: item.width,
    height: item.height,
    orientation: item.height > item.width ? "portrait" : item.width > item.height ? "landscape" : undefined,
    safe: item.safe !== false,
    purpose: item.purpose || [],
    origin: item.origin,
    originDetail: item.originDetail,
    licenseId: item.licenseId,
    duration: item.duration,
    ownerHandle: item.ownerHandle,
    authorUrl: item.ownerHandle ? `/u/${item.ownerHandle}` : undefined,
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
    "video/mp4": "mp4",
    "video/webm": "webm",
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
    return "Asset file is required.";
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPG, PNG, WebP, AVIF, SVG, MP4, and WebM assets are accepted.";
  }
  if (file.type === "image/svg+xml" && file.size > MAX_SVG_SIZE) {
    return "SVG assets must be under 1 MB.";
  }
  if (file.type.startsWith("video/")) {
    if (!file.size || file.size > MAX_VIDEO_SIZE) {
      return "Video assets must be under 40 MB.";
    }
    return null;
  }
  if (!file.size || file.size > MAX_FILE_SIZE) {
    return "Image assets must be under 8 MB.";
  }
  return null;
}

// Best-effort dimension sniff for JPEG and PNG headers. Returns null for
// other formats — callers fall back to client-supplied values.
export function imageDimensions(bytes, contentType) {
  const view = new DataView(bytes);
  try {
    if (contentType === "image/png") {
      // PNG signature + IHDR: width/height at offsets 16/20.
      if (view.byteLength < 24 || view.getUint32(0) !== 0x89504e47) return null;
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (contentType === "image/jpeg") {
      if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
      let offset = 2;
      while (offset + 9 < view.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = view.getUint8(offset + 1);
        // SOF0-SOF15 except DHT/JPG/DAC carry dimensions.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
        }
        const length = view.getUint16(offset + 2);
        if (!length) return null;
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
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

// Returns an error message when the account may not upload right now, else null.
// Admins are expected to be exempted by callers. Note: KV counters are not
// transactional; treat these as soft limits against casual abuse.
export async function uploadAllowance(kv, accountId) {
  const publicIds = await readIndex(kv, PUBLIC_INDEX);
  const pendingIds = await readIndex(kv, PENDING_INDEX);
  if (publicIds.length + pendingIds.length >= MAX_ITEMS) {
    return "The catalog is at capacity right now. Please try again later.";
  }
  const owned = await readIndex(kv, accountIndexKey(accountId));
  if (owned.length >= MAX_ACCOUNT_ASSETS) {
    return `Account asset limit reached (${MAX_ACCOUNT_ASSETS}). Delete older assets to publish more.`;
  }
  const hour = Math.floor(Date.now() / 3600000);
  const rlKey = `rl:upload:${safeAccountId(accountId)}:${hour}`;
  const count = Number((await kv.get(rlKey)) || 0);
  if (count >= MAX_UPLOADS_PER_HOUR) {
    return `Upload rate limit reached (${MAX_UPLOADS_PER_HOUR} per hour). Try again later.`;
  }
  await kv.put(rlKey, String(count + 1), { expirationTtl: 3600 });
  return null;
}

// Handles that would collide with site routes or impersonate the platform.
export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "team", "official",
  "fds", "freedesign", "free-design-store", "support", "help", "about", "legal",
  "api", "assets", "creators", "creator", "console", "tools", "skills",
  "photo", "photos", "images", "system", "root",
]);

export function safeHandle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export async function getProfile(kv, accountId) {
  return kv.get(`${PROFILE_PREFIX}${safeAccountId(accountId)}`, "json");
}

export async function getProfileByHandle(kv, handle) {
  const ref = await kv.get(`${HANDLE_PREFIX}${safeHandle(handle)}`, "json");
  if (!ref?.accountId) return null;
  return getProfile(kv, ref.accountId);
}

export async function putProfile(kv, profile) {
  await kv.put(`${PROFILE_PREFIX}${safeAccountId(profile.accountId)}`, JSON.stringify(profile));
}

// Lazily creates a CreatorProfile from a session account on first contribution.
// Default handle comes from the provider login (email local-part for Google),
// with -2/-3 suffixes on collision.
export async function ensureProfile(kv, account) {
  if (!account?.accountId) return null;
  const existing = await getProfile(kv, account.accountId);
  if (existing) return existing;

  let base =
    safeHandle(String(account.login || "").split("@")[0]) ||
    safeAccountId(account.accountId);
  if (RESERVED_HANDLES.has(base)) base = `${base}-creator`.slice(0, 30);
  let handle = base.length >= 3 ? base : `${base}-fds`.slice(0, 30);
  for (let n = 2; n < 50; n += 1) {
    const taken = await kv.get(`${HANDLE_PREFIX}${handle}`, "json");
    if (!taken) break;
    if (taken.accountId === safeAccountId(account.accountId)) break;
    handle = `${base}-${n}`.slice(0, 30);
  }

  const now = new Date().toISOString();
  const profile = {
    accountId: safeAccountId(account.accountId),
    handle,
    displayName: account.accountName || handle,
    avatarUrl: account.avatarUrl || null,
    provider: account.provider || null,
    login: account.login || null,
    bio: "",
    website: "",
    social: {},
    createdAt: now,
    updatedAt: now,
  };
  await kv.put(`${HANDLE_PREFIX}${handle}`, JSON.stringify({ accountId: profile.accountId }));
  await putProfile(kv, profile);
  return profile;
}

export { PUBLIC_INDEX, PENDING_INDEX, sessionAccount, safeAccountId, accountIndexKey };
