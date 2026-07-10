import {
  accountIndexKey,
  error,
  getProfileByHandle,
  listItems,
  publicItem,
  requireStore,
} from "../_lib.js";

export async function onRequestGet({ request, env, params }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  const profile = await getProfileByHandle(store.kv, params.handle);
  if (!profile) return error("Creator not found.", 404);

  const origin = new URL(request.url).origin;
  const owned = await listItems(store.kv, accountIndexKey(profile.accountId));
  const items = owned
    .filter((item) => item.status === "public")
    .map((item) => publicItem(item, origin));

  return new Response(
    JSON.stringify({
      ok: true,
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio || "",
        website: profile.website || "",
        social: profile.social || {},
        createdAt: profile.createdAt,
      },
      items,
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300",
      },
    }
  );
}
