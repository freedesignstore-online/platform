import {
  PENDING_INDEX,
  PUBLIC_INDEX,
  addToIndex,
  deleteItem,
  error,
  getItem,
  isAdmin,
  json,
  putItem,
  removeFromIndex,
  requireStore,
} from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  if (!isAdmin(request, env)) return error("Admin token required.", 401);

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return error("JSON body required.");
  }

  const id = String(body.id || "");
  const action = String(body.action || "");
  const item = id ? await getItem(store.kv, id) : null;
  if (!item) return error("Stock item not found.", 404);

  if (action === "publish") {
    item.status = "public";
    item.updatedAt = new Date().toISOString();
    await putItem(store.kv, item);
    await removeFromIndex(store.kv, PENDING_INDEX, id);
    await addToIndex(store.kv, PUBLIC_INDEX, id);
    return json({ ok: true, id, status: "public" });
  }

  if (action === "reject") {
    await store.bucket.delete(item.objectKey);
    await deleteItem(store.kv, id);
    await removeFromIndex(store.kv, PENDING_INDEX, id);
    await removeFromIndex(store.kv, PUBLIC_INDEX, id);
    return json({ ok: true, id, status: "rejected" });
  }

  return error("Action must be publish or reject.");
}
