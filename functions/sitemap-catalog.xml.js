import { PUBLIC_INDEX, getItem, getProfile, readIndex, requireStore } from "./api/stock/_lib.js";

// Cap the number of asset urls emitted per request so the sitemap stays under
// Cloudflare's per-invocation KV-op limit as the catalog grows past ~1000
// items (sitemaps may hold up to 50k urls, but the op budget is the real
// constraint here). We emit the newest ids (appended newest-last, so take the
// tail). Full coverage beyond this would be a paginated-sitemap follow-up.
const SITEMAP_CAP = 1000;

// Dynamic sitemap for asset detail pages and creator profiles.
// Referenced from robots.txt alongside the static sitemap.xml.
export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return new Response("unavailable", { status: 503 });
  const origin = new URL(request.url).origin;

  const ids = (await readIndex(store.kv, PUBLIC_INDEX)).slice(-SITEMAP_CAP);
  const items = (await Promise.all(ids.map((id) => getItem(store.kv, id))))
    .filter((item) => item && item.status === "public");
  const owners = [...new Set(items.map((item) => item.ownerAccountId).filter(Boolean))];
  const handles = (await Promise.all(owners.map((accountId) => getProfile(store.kv, accountId))))
    .filter(Boolean)
    .map((profile) => profile.handle);

  const urls = [
    `${origin}/creators`,
    ...handles.map((handle) => `${origin}/u/${encodeURIComponent(handle)}`),
    ...items.map((item) => `${origin}/photo/${encodeURIComponent(item.id)}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url.replace(/&/g, "&amp;")}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
