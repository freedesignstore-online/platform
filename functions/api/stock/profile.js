import {
  RESERVED_HANDLES,
  cleanText,
  ensureProfile,
  error,
  getProfileByHandle,
  json,
  putProfile,
  requireStore,
  safeHandle,
  sessionAccount,
} from "./_lib.js";

const SOCIAL_KEYS = ["x", "github", "instagram", "dribbble", "behance"];

export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  const account = await sessionAccount(request, env);
  if (!account?.authenticated) return error("Sign in to view your profile.", 401);
  const profile = await ensureProfile(store.kv, account);
  return json({ ok: true, profile, profileUrl: `/u/${profile.handle}` });
}

export async function onRequestPost({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;
  const account = await sessionAccount(request, env);
  if (!account?.authenticated) return error("Sign in to update your profile.", 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error("JSON body required.");
  }

  const profile = await ensureProfile(store.kv, account);

  if (body.handle !== undefined) {
    const handle = safeHandle(body.handle);
    if (handle.length < 3) return error("Handles need at least 3 characters (a-z, 0-9, hyphens).");
    if (RESERVED_HANDLES.has(handle)) return error("That handle is reserved.");
    if (handle !== profile.handle) {
      const taken = await getProfileByHandle(store.kv, handle);
      if (taken && taken.accountId !== profile.accountId) return error("That handle is already taken.", 409);
      await store.kv.delete(`profile:handle:${profile.handle}`);
      await store.kv.put(`profile:handle:${handle}`, JSON.stringify({ accountId: profile.accountId }));
      profile.handle = handle;
    }
  }
  if (body.displayName !== undefined) profile.displayName = cleanText(body.displayName, profile.displayName, 80);
  if (body.bio !== undefined) profile.bio = cleanText(body.bio, "", 400);
  if (body.website !== undefined) {
    const website = String(body.website || "").trim().slice(0, 200);
    if (website && !/^https:\/\//.test(website)) return error("Website must be an https:// URL.");
    profile.website = website;
  }
  if (body.social !== undefined && typeof body.social === "object") {
    const social = {};
    for (const key of SOCIAL_KEYS) {
      const value = cleanText(body.social[key], "", 60).replace(/^@/, "");
      if (value) social[key] = value;
    }
    profile.social = social;
  }
  profile.updatedAt = new Date().toISOString();
  await putProfile(store.kv, profile);
  return json({ ok: true, profile, profileUrl: `/u/${profile.handle}` });
}
