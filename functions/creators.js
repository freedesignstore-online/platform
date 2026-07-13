import { PUBLIC_INDEX, getItem, getProfile, publicItem, readIndex, requireStore } from "./api/stock/_lib.js";

// Bound the number of public items scanned per request so the directory page
// stays under Cloudflare's per-invocation KV-op limit as the catalog grows
// past ~1000 items. Beyond this the directory reflects the newest contributors
// (ids are appended newest-last, so we take the tail).
const DIRECTORY_SCAN = 600;

export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return new Response("Creator directory is unavailable.", { status: 503 });
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
        return { profile, owned };
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => b.owned.length - a.owned.length);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "FreeDesignStore Creators",
    url: `${origin}/creators`,
    about: "Contributors sharing free design assets: photos, illustrations, renders, AI art, and videos.",
  };

  const cards = creators
    .map(({ profile, owned }) => {
      const previews = owned
        .slice(0, 3)
        .map((item) => `<img loading="lazy" decoding="async" src="${esc(publicItem(item, origin).url)}?size=400" alt="">`)
        .join("");
      return `<a class="creator" href="/u/${encodeURIComponent(profile.handle)}">
<div class="previews">${previews}</div>
<div class="who">
${profile.avatarUrl ? `<img class="creator-avatar" src="${esc(profile.avatarUrl)}" alt="">` : `<div class="creator-avatar"></div>`}
<div><strong>${esc(profile.displayName)}</strong><span>@${esc(profile.handle)} · ${owned.length} asset${owned.length === 1 ? "" : "s"}</span></div>
</div>
${profile.bio ? `<p>${esc(profile.bio.slice(0, 120))}</p>` : ""}
</a>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Creators — FreeDesignStore</title>
<meta name="description" content="The designers, photographers, and artists sharing free assets on FreeDesignStore.">
<link rel="canonical" href="${esc(origin)}/creators">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tw.css">
</head>
<body class="min-h-screen">
<header class="fds-header">
<a href="/" class="brand"><span class="brand-emoji">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav class="fds-nav"><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div class="max-w-[1100px] mx-auto pt-[2.2rem] px-6 pb-12">
<h1 class="font-display text-[1.8rem] mb-[.3rem]">Creators</h1>
<p class="text-muted text-[.85rem] mb-[1.6rem]">The designers, photographers, and artists sharing free assets on FreeDesignStore.</p>
${creators.length ? `<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">${cards}</div>` : `<div class="p-10 border border-dashed border-hairline rounded-xl text-center text-muted text-[.85rem]">Be the first contributor — <a href="/images/stock-photos/">sign in and upload your work</a>.</div>`}
</div>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer class="fds-footer">FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></footer>
<script src="/nav.js" defer></script></body>
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
