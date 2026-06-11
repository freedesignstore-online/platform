import { error, getItem, isAdmin, requireStore } from "../_lib.js";

export async function onRequestGet({ params, request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;

  const id = params.id;
  const item = await getItem(store.kv, id);
  if (!item) return error("Image not found.", 404);
  if (item.status !== "public" && !isAdmin(request, env)) {
    return error("Image is not public.", 404);
  }

  const object = await store.bucket.get(item.objectKey);
  if (!object) return error("Image file not found.", 404);

  const url = new URL(request.url);
  const filename = item.filename || `${id}.jpg`;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", item.status === "public" ? "public, max-age=86400" : "no-store");
  headers.set(
    "content-disposition",
    url.searchParams.has("download")
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`
  );
  return new Response(object.body, { headers });
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context);
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
