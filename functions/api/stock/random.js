import { PUBLIC_INDEX, error, isAssetType, listItems, publicItem, requireStore } from "./_lib.js";

const MAX_COUNT = 20;
const CACHE_SECONDS = 60;
const HOSTED_ACCOUNT = "fds-official";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const assetType = String(url.searchParams.get("assetType") || url.searchParams.get("asset_type") || "photo").toLowerCase();
  const category = String(url.searchParams.get("category") || "").trim().toLowerCase();
  const orientation = String(url.searchParams.get("orientation") || "").trim().toLowerCase();
  const purpose = String(url.searchParams.get("purpose") || "").trim().toLowerCase();
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const safe = String(url.searchParams.get("safe") || "true").trim().toLowerCase() !== "false";
  const count = clampCount(url.searchParams.get("count"));

  if (assetType && !isAssetType(assetType)) {
    return error("Unsupported assetType.", 400);
  }
  if (orientation && !["landscape", "portrait", "square"].includes(orientation)) {
    return error("Unsupported orientation.", 400);
  }

  const store = requireStore(env);
  if (store.missing) return store.response;

  const matches = (await listItems(store.kv, PUBLIC_INDEX))
    .filter((item) => item.ownerAccountId === HOSTED_ACCOUNT)
    .filter((item) => !assetType || item.assetType === assetType)
    .filter((item) => !category || String(item.category || "").toLowerCase() === category)
    .filter((item) => !orientation || orientationOf(item) === orientation)
    .filter((item) => !purpose || (item.purpose || []).some((value) => String(value || "").toLowerCase() === purpose))
    .filter((item) => !safe || item.safe !== false)
    .filter((item) => {
      if (!query) return true;
      return [item.title, item.author, item.category, item.license, item.assetType, orientationOf(item), ...(item.tags || []), ...(item.purpose || [])]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  const items = shuffle(matches).slice(0, count).map((item) => publicItem(item, url.origin));

  return new Response(
    JSON.stringify({
      ok: true,
      source: "hosted",
      count: items.length,
      filters: {
        assetType,
        category: category || "all",
        orientation: orientation || "all",
        purpose: purpose || "all",
        safe,
        q: query,
      },
      items,
    }),
    {
      headers: responseHeaders(),
    }
  );
}

export function onRequestHead() {
  return new Response(null, {
    headers: responseHeaders(),
  });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

function clampCount(value) {
  const count = Number(value || 1);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(MAX_COUNT, Math.floor(count)));
}

function responseHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS * 5}`,
  };
}

function orientationOf(item) {
  if (!item.width || !item.height) return "";
  return item.height > item.width ? "portrait" : item.width > item.height ? "landscape" : "square";
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
