import { PUBLIC_INDEX, getItem, getProfile, publicItem, readIndex, requireStore } from "./_lib.js";

// Bound the number of public items scanned per request so the directory stays
// under Cloudflare's per-invocation KV-op limit as the catalog grows past
// ~1000 items. When the catalog is larger than this, the directory reflects
// the newest contributors (ids are appended newest-last, so we take the tail).
const DIRECTORY_SCAN = 600;

// Contributor directory, computed from the newest public ids and cached at the
// edge for 5 minutes. No standing index to maintain.
export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  const origin = new URL(request.url).origin;

  const ids = (await readIndex(store.kv, PUBLIC_INDEX)).slice(-DIRECTORY_SCAN);
  const items = (await Promise.all(ids.map((id) => getItem(store.kv, id)))).filter(Boolean);
  const byOwner = new Map();
  for (const item of items) {
    if (!item.ownerAccountId || item.status !== "public") continue;
    const list = byOwner.get(item.ownerAccountId) || [];
    list.push(item);
    byOwner.set(item.ownerAccountId, list);
  }

  const creators = (
    await Promise.all(
      [...byOwner.entries()].map(async ([accountId, owned]) => {
        const profile = await getProfile(store.kv, accountId);
        if (!profile) return null;
        return {
          handle: profile.handle,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio || "",
          publicCount: owned.length,
          previews: owned.slice(0, 3).map((item) => publicItem(item, origin).url),
          profileUrl: `/u/${profile.handle}`,
        };
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => b.publicCount - a.publicCount);

  return new Response(JSON.stringify({ ok: true, creators }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });
}
