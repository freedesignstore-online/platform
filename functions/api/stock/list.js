import {
  PENDING_INDEX,
  PUBLIC_INDEX,
  error,
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
  if (status === "pending" && !isAdmin(request, env)) {
    return error("Admin token required.", 401);
  }

  const key = status === "pending" ? PENDING_INDEX : PUBLIC_INDEX;
  const items = await listItems(store.kv, key);
  return json({
    ok: true,
    status,
    items: items.map(publicItem),
  });
}
