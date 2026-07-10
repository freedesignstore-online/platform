import { PUBLIC_INDEX, getProfile, listItems, publicItem, requireStore } from "./api/stock/_lib.js";

export async function onRequestGet({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return new Response("Creator directory is unavailable.", { status: 503 });
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
        .map((item) => `<img loading="lazy" src="${esc(publicItem(item, origin).url)}" alt="">`)
        .join("");
      return `<a class="creator" href="/u/${encodeURIComponent(profile.handle)}">
<div class="previews">${previews}</div>
<div class="who">
${profile.avatarUrl ? `<img class="avatar" src="${esc(profile.avatarUrl)}" alt="">` : `<div class="avatar"></div>`}
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
.wrap{max-width:1100px;margin:0 auto;padding:2.2rem 1.5rem 3rem}
h1{font-family:'Fraunces',serif;font-size:1.8rem;margin-bottom:.3rem}
.sub{color:var(--muted);font-size:.85rem;margin-bottom:1.6rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.creator{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel);color:inherit;transition:.15s}
.creator:hover{border-color:var(--accent);text-decoration:none;transform:translateY(-1px)}
.previews{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--soft);min-height:70px}
.previews img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.who{display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem .3rem}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--soft);object-fit:cover}
.who strong{display:block;font-size:.85rem}
.who span{font-size:.7rem;color:var(--muted)}
.creator p{padding:.2rem .8rem .8rem;font-size:.75rem;color:var(--muted);line-height:1.4}
.empty{padding:2.5rem;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--muted);font-size:.85rem}
footer{border-top:1px solid var(--line);padding:1rem;text-align:center;font-size:.7rem;color:var(--muted)}
</style>
</head>
<body>
<header>
<a href="/" class="brand"><span style="font-size:1.4rem">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div class="wrap">
<h1>Creators</h1>
<p class="sub">The designers, photographers, and artists sharing free assets on FreeDesignStore.</p>
${creators.length ? `<div class="grid">${cards}</div>` : `<div class="empty">Be the first contributor — <a href="/images/stock-photos/">sign in and upload your work</a>.</div>`}
</div>
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
