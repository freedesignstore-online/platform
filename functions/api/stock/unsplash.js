import { error, json } from "./_lib.js";

const APP = "FreeDesignStore";

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
  return json({
    ok: true,
    total: data.total || 0,
    items: (data.results || []).map((photo) => ({
      id: `unsplash-${photo.id}`,
      source: "unsplash",
      assetType: "photo",
      title: photo.alt_description || photo.description || query,
      category: "Unsplash",
      author: photo.user?.name || "Unsplash photographer",
      license: "Unsplash License",
      url: photo.urls?.small,
      download: photo.urls?.full || photo.urls?.raw,
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
