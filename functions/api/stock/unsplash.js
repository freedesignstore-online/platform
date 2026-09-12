import { error, json } from "./_lib.js";

const APP = "FreeDesignStore";

/**
 * Is this search result an Unsplash+ premium photo?
 *
 * Unsplash+ is a paid subscription licence, not the free Unsplash Licence, and
 * premium photos are interleaved into ordinary search results with no visual
 * marker. The restriction is on the licence, not on where the bytes are hosted,
 * so linking one is a violation even though we never mirror it.
 *
 * They have to be dropped here rather than flagged for the caller to handle:
 * every surface downstream labels whatever it receives "Unsplash License".
 *
 * Detection is deliberately belt-and-braces. The `premium`/`plus` booleans are
 * not documented as stable across API versions, while the
 * `plus.unsplash.com` / `premium_photo-` URL shape has always been present on
 * premium assets — so a change to either signal alone still excludes the photo.
 */
export function isPremiumPhoto(photo) {
  if (!photo || typeof photo !== "object") return false;
  if (photo.premium === true || photo.plus === true) return true;
  const candidates = [...Object.values(photo.urls || {}), photo.links?.html, photo.links?.download];
  return candidates.some(
    (value) =>
      typeof value === "string" &&
      (value.includes("plus.unsplash.com") || value.includes("premium_photo-"))
  );
}

export async function onRequestGet({ request, env }) {
  const accessKey = env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return error("Unsplash API is not configured.", 503);
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "design workspace").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const upstream = new URL("https://api.unsplash.com/search/photos");
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("page", String(page));
  upstream.searchParams.set("per_page", "24");
  upstream.searchParams.set("content_filter", "high");

  const res = await fetch(upstream, {
    headers: {
      authorization: `Client-ID ${accessKey}`,
      "accept-version": "v1",
    },
  });
  if (!res.ok) {
    return error("Unsplash search failed.", res.status);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  const free = results.filter((photo) => !isPremiumPhoto(photo));
  return json({
    ok: true,
    total: data.total || 0,
    excludedPremium: results.length - free.length,
    items: free.map((photo) => ({
      id: `unsplash-${photo.id}`,
      source: "unsplash",
      assetType: "photo",
      title: photo.alt_description || photo.description || query,
      category: "Unsplash",
      author: photo.user?.name || "Unsplash photographer",
      license: "Unsplash License",
      url: photo.urls?.small,
      width: photo.width,
      height: photo.height,
      description: photo.alt_description || photo.description || `Unsplash photo for ${query}.`,
      altText: photo.alt_description || photo.description || query,
      palette: photo.color ? [photo.color] : [],
      downloadLocation: photo.links?.download_location,
      creditUrl: `${photo.user?.links?.html || photo.links?.html}?utm_source=${APP}&utm_medium=referral`,
      photoUrl: `${photo.links?.html}?utm_source=${APP}&utm_medium=referral`,
      tags: (photo.tags || []).map((tag) => tag.title).filter(Boolean).slice(0, 4),
    })),
  });
}

export async function onRequestPost({ request, env }) {
  const accessKey = env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return error("Unsplash API is not configured.", 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return error("JSON body required.");
  }
  const downloadLocation = String(body.downloadLocation || "");
  if (!downloadLocation.startsWith("https://api.unsplash.com/photos/")) {
    return error("Invalid Unsplash download location.");
  }

  await fetch(downloadLocation, {
    headers: {
      authorization: `Client-ID ${accessKey}`,
      "accept-version": "v1",
    },
  });
  return json({ ok: true });
}
