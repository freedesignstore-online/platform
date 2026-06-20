import {
  PENDING_INDEX,
  PUBLIC_INDEX,
  error,
  isAssetType,
  isAdmin,
  json,
  listItems,
  publicItem,
  requireStore,
} from "./_lib.js";
import { HOSTED_STOCK, filterHostedStock, hostedStockItem } from "./hosted.js";

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

  const origin = new URL(request.url).origin;
  const includeHosted = status === "public" && (source === "all" || source === "hosted");
  const includeCommunity = source === "all" || source === "community";
  const hostedItems = includeHosted
    ? filterHostedStock(HOSTED_STOCK, { assetType, category, orientation, purpose, safe, q: query }).map((item) =>
        hostedStockItem(item, origin)
      )
    : [];

  let communityItems = [];
  let communityUnavailable = false;
  if (includeCommunity) {
    const store = requireStore(env);
    if (store.missing) {
      if (source === "community" || status === "pending") return store.response;
      communityUnavailable = true;
    } else {
      const key = status === "pending" ? PENDING_INDEX : PUBLIC_INDEX;
      communityItems = (await listItems(store.kv, key))
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
        })
        .map((item) => publicItem(item, origin));
    }
  }

  return json({
    ok: true,
    source,
    status,
    assetType: assetType || "all",
    category: category || "all",
    orientation: orientation || "all",
    purpose: purpose || "all",
    safe,
    q: query,
    communityUnavailable,
    items: [...hostedItems, ...communityItems],
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

function orientationOf(item) {
  if (!item.width || !item.height) return "";
  return item.height > item.width ? "portrait" : item.width > item.height ? "landscape" : "square";
}
