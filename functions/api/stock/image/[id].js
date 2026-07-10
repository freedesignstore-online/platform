import { canViewItem, error, getItem, requireStore } from "../_lib.js";

export async function onRequestGet({ params, request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;

  const id = params.id;
  const item = await getItem(store.kv, id);
  if (!item) return error("Asset not found.", 404);
  if (!(await canViewItem(request, env, item))) {
    return error("Asset is not public.", 404);
  }

  // Range support so <video> elements can seek.
  const rangeHeader = request.headers.get("range");
  let range;
  let totalSize;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match && (match[1] || match[2])) {
      const head = await store.bucket.head(item.objectKey);
      if (!head) return error("Asset file not found.", 404);
      totalSize = head.size;
      const start = match[1] ? Number(match[1]) : Math.max(0, totalSize - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), totalSize - 1) : totalSize - 1;
      if (start >= totalSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${totalSize}` },
        });
      }
      range = { offset: start, length: end - start + 1 };
    }
  }

  const object = await store.bucket.get(item.objectKey, range ? { range } : undefined);
  if (!object) return error("Asset file not found.", 404);

  const url = new URL(request.url);
  const filename = item.filename || `${id}.jpg`;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", item.status === "public" ? "public, max-age=86400" : "no-store");
  if (item.contentType === "image/svg+xml") {
    headers.set("content-security-policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    headers.set("x-content-type-options", "nosniff");
  }
  headers.set(
    "content-disposition",
    url.searchParams.has("download")
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`
  );
  if (range) {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${totalSize}`);
    headers.set("content-length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  }
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
