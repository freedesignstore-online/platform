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

export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "public";
  const assetType = String(url.searchParams.get("asset_type") || "").toLowerCase();
  const category = String(url.searchParams.get("category") || "").trim().toLowerCase();
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  if (status === "pending" && !isAdmin(request, env)) {
    return error("Admin token required.", 401);
  }
  if (assetType && !isAssetType(assetType)) {
    return error("Unsupported asset_type.", 400);
  }

  const key = status === "pending" ? PENDING_INDEX : PUBLIC_INDEX;
  const items = (await listItems(store.kv, key))
    .filter((item) => !assetType || item.assetType === assetType)
    .filter((item) => !category || String(item.category || "").toLowerCase() === category)
    .filter((item) => {
      if (!query) return true;
      return [item.title, item.author, item.category, item.license, item.assetType, ...(item.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  return json({
    ok: true,
    status,
    assetType: assetType || "all",
    category: category || "all",
    q: query,
    items: items.map(publicItem),
  });
}
