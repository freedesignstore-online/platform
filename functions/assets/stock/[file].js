// Serves the curated hosted catalog from R2 at the original static paths
// (/assets/stock/<file>). Consumers (e.g. HeartFull profile backgrounds)
// store these absolute URLs, so they must keep working after the migration
// off git/static hosting.
import { requireStore } from "../../api/stock/_lib.js";

export async function onRequestGet({ params, request, env }) {
  const store = requireStore(env);
  if (store.missing) return new Response("Asset storage unavailable", { status: 503 });

  const file = String(params.file || "");
  if (!/^[a-z0-9-]+\.(jpg|jpeg|png|webp|json)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await store.bucket.get(`hosted/${file}`);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");
  return new Response(object.body, { headers });
}
