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
  const owned = await listItems(store.kv, accountIndexKey(profile.accountId));
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
      return `<a class="card" href="/photo/${encodeURIComponent(item.id)}">${media}<span class="card-title">${esc(item.title)}</span></a>`;
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--accent:#ec4899;--bg:#fdfcfd;--panel:#fff;--line:#f1e5ec;--text:#1f2430;--muted:#6b7280;--soft:#fdf2f8}
body{font-family:'Manrope',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;backdrop-filter:blur(14px);background:rgba(253,252,253,.86);padding:.6rem 1.5rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid var(--line);z-index:10}
.brand{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--text)}
.brand-name{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:700}
nav{display:flex;gap:.85rem;font-size:.82rem;font-weight:600;margin-left:auto}
nav a{color:var(--muted)}nav a:hover{color:var(--text);text-decoration:none}
.hero{max-width:1100px;margin:0 auto;padding:2.2rem 1.5rem 1.4rem;display:flex;gap:1.3rem;align-items:center}
.avatar{width:84px;height:84px;border-radius:50%;background:var(--soft);object-fit:cover;border:2px solid var(--line)}
.hero h1{font-family:'Fraunces',serif;font-size:1.7rem}
.handle{color:var(--muted);font-size:.85rem;font-weight:700}
.bio{margin-top:.35rem;color:var(--muted);font-size:.85rem;max-width:640px;line-height:1.5}
.links{margin-top:.35rem;font-size:.78rem;font-weight:600}
.count{margin-left:auto;text-align:right;font-size:.8rem;color:var(--muted)}
.count strong{display:block;font-size:1.5rem;color:var(--text);font-family:'Fraunces',serif}
.grid{max-width:1100px;margin:0 auto;padding:0 1.5rem 3rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.card{position:relative;display:block;border-radius:12px;overflow:hidden;background:var(--panel);border:1px solid var(--line)}
.card img,.card video{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
.card-title{position:absolute;left:0;right:0;bottom:0;padding:1.2rem .7rem .5rem;background:linear-gradient(transparent,rgba(0,0,0,.65));color:#fff;font-size:.75rem;font-weight:700}
.duration{position:absolute;top:.5rem;right:.5rem;background:rgba(0,0,0,.65);color:#fff;font-size:.65rem;font-weight:700;border-radius:6px;padding:.15rem .4rem}
.empty{max-width:1100px;margin:0 auto;padding:2rem 1.5rem;color:var(--muted);font-size:.85rem}
footer{border-top:1px solid var(--line);padding:1rem;text-align:center;font-size:.7rem;color:var(--muted)}
@media(max-width:640px){.hero{flex-direction:column;text-align:center}.count{margin:0;text-align:center}}
</style>
</head>
<body>
<header>
<a href="/" class="brand"><span style="font-size:1.4rem">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div class="hero">
${profile.avatarUrl ? `<img class="avatar" src="${esc(profile.avatarUrl)}" alt="${esc(profile.displayName)}">` : `<div class="avatar"></div>`}
<div>
<h1>${esc(profile.displayName)}</h1>
<div class="handle">@${esc(profile.handle)}</div>
${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ""}
<div class="links">${profile.website ? `<a href="${esc(profile.website)}" target="_blank" rel="noopener">Website</a>${socialLinks ? " · " : ""}` : ""}${socialLinks}</div>
</div>
<div class="count"><strong>${items.length}</strong>free asset${items.length === 1 ? "" : "s"}</div>
</div>
${items.length ? `<div class="grid">${cards}</div>` : `<p class="empty">No published assets yet.</p>`}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer>FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a></footer>
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
