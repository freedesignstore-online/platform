import {
  accountIndexKey,
  getProfileByHandle,
  listItems,
  publicItem,
  requireStore,
} from "../api/stock/_lib.js";

const SOCIAL_URLS = {
  x: (v) => `https://x.com/${v}`,
  github: (v) => `https://github.com/${v}`,
  instagram: (v) => `https://instagram.com/${v}`,
  dribbble: (v) => `https://dribbble.com/${v}`,
  behance: (v) => `https://www.behance.net/${v}`,
};

export async function onRequestGet({ params, request, env }) {
  const store = requireStore(env);
  if (store.missing) return new Response("Creator profiles are unavailable.", { status: 503 });

  const profile = await getProfileByHandle(store.kv, params.handle);
  if (!profile) return new Response("Creator not found", { status: 404 });

  const origin = new URL(request.url).origin;
  // Newest ids sit at the end of the account index — reverse for newest-first.
  const owned = (await listItems(store.kv, accountIndexKey(profile.accountId))).reverse();
  const items = owned.filter((item) => item.status === "public").map((item) => publicItem(item, origin));
  const pageUrl = `${origin}/u/${encodeURIComponent(profile.handle)}`;

  const sameAs = [
    ...(profile.website ? [profile.website] : []),
    ...Object.entries(profile.social || {}).map(([key, value]) => SOCIAL_URLS[key]?.(value)).filter(Boolean),
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      alternateName: `@${profile.handle}`,
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      url: pageUrl,
      ...(sameAs.length ? { sameAs } : {}),
      ...(profile.bio ? { description: profile.bio } : {}),
    },
  };

  const socialLinks = Object.entries(profile.social || {})
    .map(([key, value]) => {
      const url = SOCIAL_URLS[key]?.(value);
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(key)}</a>` : "";
    })
    .filter(Boolean)
    .join(" · ");

  const cards = items
    .map((item) => {
      const media = String(item.contentType || "").startsWith("video/")
        ? `<video muted loop playsinline preload="metadata" src="${esc(item.url)}"></video>${
            item.duration ? `<span class="duration">${Math.round(item.duration)}s</span>` : ""
          }`
        : `<img loading="lazy" src="${esc(item.url)}" alt="${esc(item.title)}">`;
      return `<a class="work-card" href="/photo/${encodeURIComponent(item.id)}">${media}<span class="work-title">${esc(item.title)}</span></a>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(profile.displayName)} (@${esc(profile.handle)}) — FreeDesignStore</title>
<meta name="description" content="${esc(profile.bio || `Free design assets by ${profile.displayName} on FreeDesignStore.`)}">
<meta property="og:title" content="${esc(profile.displayName)} (@${esc(profile.handle)}) — FreeDesignStore">
<meta property="og:type" content="profile">
${profile.avatarUrl ? `<meta property="og:image" content="${esc(profile.avatarUrl)}">` : ""}
<meta property="og:url" content="${esc(pageUrl)}">
<link rel="canonical" href="${esc(pageUrl)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tw.css">
</head>
<body class="min-h-screen">
<header class="fds-header">
<a href="/" class="brand"><span style="font-size:1.4rem">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav class="fds-nav"><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div class="max-w-[1100px] mx-auto pt-[2.2rem] px-6 pb-[1.4rem] flex gap-[1.3rem] items-center max-[640px]:flex-col max-[640px]:text-center">
${profile.avatarUrl ? `<img class="profile-avatar" src="${esc(profile.avatarUrl)}" alt="${esc(profile.displayName)}">` : `<div class="profile-avatar"></div>`}
<div>
<h1 class="font-display text-[1.7rem]">${esc(profile.displayName)}</h1>
<div class="text-muted text-[.85rem] font-bold">@${esc(profile.handle)}</div>
${profile.bio ? `<p class="mt-[.35rem] text-muted text-[.85rem] max-w-[640px] leading-normal">${esc(profile.bio)}</p>` : ""}
<div class="mt-[.35rem] text-[.78rem] font-semibold">${profile.website ? `<a href="${esc(profile.website)}" target="_blank" rel="noopener">Website</a>${socialLinks ? " · " : ""}` : ""}${socialLinks}</div>
</div>
<div class="profile-count"><strong>${items.length}</strong>free asset${items.length === 1 ? "" : "s"}</div>
</div>
${items.length ? `<div class="max-w-[1100px] mx-auto px-6 pb-12 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">${cards}</div>` : `<p class="max-w-[1100px] mx-auto px-6 py-8 text-muted text-[.85rem]">No published assets yet.</p>`}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer class="fds-footer">FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
