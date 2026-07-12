import {
  LICENSES,
  ORIGINS,
  PENDING_INDEX,
  PUBLIC_INDEX,
  error,
  getItem,
  isAssetType,
  isAdmin,
  json,
  publicItem,
  readIndex,
  requireStore,
} from "./_lib.js";

const HOSTED_ACCOUNT = "fds-official";
// Paging design: the index is a JSON array of ids with the newest appended at
// the END, so we reverse it once and page over the newest-first id list.
// `offset`/`nextOffset` are positions in that id list (NOT in the filtered
// result), which lets clients resume filtered scans exactly where the server
// stopped. Only the page's items are fetched from KV; filtered requests scan
// lazily in batches and stop after `limit` matches or FETCH_CAP item reads,
// returning `nextOffset` so the client can continue.
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 500; // legacy callers expect big pages; new clients page with 60-100
const FETCH_CAP = 600; // max KV item reads per request (bounds work well under CF per-invocation op limits)
const SCAN_BATCH = 100;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "public";
  const source = String(url.searchParams.get("source") || "all").toLowerCase();
  const assetType = String(url.searchParams.get("asset_type") || url.searchParams.get("assetType") || "").toLowerCase();
  const category = String(url.searchParams.get("category") || "").trim().toLowerCase();
  const orientation = String(url.searchParams.get("orientation") || "").trim().toLowerCase();
  const purpose = String(url.searchParams.get("purpose") || "").trim().toLowerCase();
  const safe = String(url.searchParams.get("safe") || "").trim().toLowerCase() === "true";
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const wantFacets = url.searchParams.get("facets") === "1";
  if (!["all", "hosted", "community"].includes(source)) {
    return error("Unsupported source.", 400);
  }
  if (status === "pending" && !isAdmin(request, env)) {
    return error("Admin token required.", 401);
  }
  if (assetType && !isAssetType(assetType)) {
    return error("Unsupported asset_type.", 400);
  }
  if (orientation && !["landscape", "portrait", "square"].includes(orientation)) {
    return error("Unsupported orientation.", 400);
  }
  const originFilter = String(url.searchParams.get("origin") || "").trim().toLowerCase();
  const licenseFilter = String(url.searchParams.get("license") || "").trim().toLowerCase();
  if (originFilter && !ORIGINS.has(originFilter)) {
    return error("Unsupported origin.", 400);
  }
  if (licenseFilter && !LICENSES.has(licenseFilter)) {
    return error("Unsupported license.", 400);
  }

  const origin = url.origin;
  const store = requireStore(env);
  if (store.missing) return store.response;

  const key = status === "pending" ? PENDING_INDEX : PUBLIC_INDEX;
  const ids = (await readIndex(store.kv, key)).reverse(); // newest first
  const total = ids.length;

  // Shared KV read budget: every item fetch goes through fetchItem, which
  // caches promises so the facet prefetch and the page scan never fetch an
  // id twice within one request.
  let reads = 0;
  const cache = new Map();
  const fetchItem = (id) => {
    if (!cache.has(id)) {
      reads += 1;
      cache.set(id, getItem(store.kv, id));
    }
    return cache.get(id);
  };

  const matchesSource = (item) => {
    if (source === "hosted") return item.ownerAccountId === HOSTED_ACCOUNT;
    if (source === "community") return item.ownerAccountId !== HOSTED_ACCOUNT;
    return true;
  };
  // matchesBase applies every active filter EXCEPT category — the facet counts
  // build on it so each category chip shows how many results it would yield
  // under the OTHER active filters (standard faceted search). matches() adds
  // the category clause for the actual result page.
  const matchesBase = (item) =>
    matchesSource(item) &&
    (!assetType || item.assetType === assetType) &&
    (!orientation || orientationOf(item) === orientation) &&
    (!purpose || (item.purpose || []).some((value) => String(value || "").toLowerCase() === purpose)) &&
    (!originFilter || item.origin === originFilter) &&
    (!licenseFilter || item.licenseId === licenseFilter) &&
    (!safe || item.safe !== false) &&
    (!query ||
      [item.title, item.author, item.category, item.license, item.assetType, orientationOf(item), ...(item.tags || []), ...(item.purpose || [])]
        .join(" ")
        .toLowerCase()
        .includes(query));
  const matches = (item) =>
    matchesBase(item) && (!category || String(item.category || "").toLowerCase() === category);

  // Facets: category counts over the newest FETCH_CAP items — exact while the
  // catalog fits the read budget, flagged partial beyond. Counts respect all
  // active filters except category, so chips never advertise results that the
  // current origin/license/type/search filters would hide. categoriesTotal is
  // the "All" count under those same filters.
  let categories = null;
  let categoriesTotal = null;
  let facetsPartial = false;
  if (wantFacets) {
    const facetIds = ids.slice(0, FETCH_CAP);
    const facetItems = (await Promise.all(facetIds.map(fetchItem))).filter(Boolean);
    categories = {};
    categoriesTotal = 0;
    for (const item of facetItems) {
      if (!matchesBase(item)) continue;
      categoriesTotal += 1;
      const cat = String(item.category || "").toLowerCase();
      if (cat) categories[cat] = (categories[cat] || 0) + 1;
    }
    facetsPartial = total > facetIds.length;
  }

  // Filter-then-page: walk the newest-first id list from `offset`, fetching in
  // batches and keeping matches until `limit` are collected or the read budget
  // is spent.
  const matched = [];
  let pos = Math.min(offset, total);
  let scanned = 0;
  while (pos < total && matched.length < limit && reads < FETCH_CAP) {
    const batchSize = Math.min(SCAN_BATCH, Math.max(1, FETCH_CAP - reads));
    const batch = await Promise.all(ids.slice(pos, pos + batchSize).map(fetchItem));
    for (const item of batch) {
      pos += 1;
      scanned += 1;
      if (item && matches(item)) {
        matched.push(item);
        if (matched.length >= limit) break;
      }
    }
  }
  const nextOffset = pos < total ? pos : null;

  return json({
    ok: true,
    source,
    status,
    assetType: assetType || "all",
    category: category || "all",
    orientation: orientation || "all",
    purpose: purpose || "all",
    origin: originFilter || "all",
    license: licenseFilter || "all",
    safe: safe ? true : "all",
    q: query,
    communityUnavailable: false,
    total,
    offset,
    limit,
    scanned,
    nextOffset,
    ...(categories ? { categories, categoriesTotal, facetsPartial } : {}),
    items: matched.map((item) => publicItem(item, origin)),
  });
}

export function onRequestHead() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
    },
  });
}

function clampInt(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function orientationOf(item) {
  if (!item.width || !item.height) return "";
  return item.height > item.width ? "portrait" : item.width > item.height ? "landscape" : "square";
}
