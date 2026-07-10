import { PUBLIC_INDEX, getProfile, listItems, publicItem, requireStore } from "./_lib.js";

// Contributor directory, computed from the public index (<=500 items) and
// cached at the edge for 5 minutes. No standing index to maintain.
export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  const origin = new URL(request.url).origin;

  const items = await listItems(store.kv, PUBLIC_INDEX);
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
