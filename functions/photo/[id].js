export async function onRequestGet({ params, request, env }) {
  const id = params.id;
  const origin = new URL(request.url).origin;
  let item;

  if (env.FDS_STOCK_KV) {
    const meta = await env.FDS_STOCK_KV.get(`stock:item:${id}`, "json");
    if (meta && meta.status === "public") {
      const isHosted = meta.source === "hosted";
      item = {
        id: meta.id,
        title: meta.title,
        category: meta.category,
        assetType: meta.assetType || "photo",
        author: isHosted ? meta.author : meta.ownerName || meta.author || "Community",
        ownerHandle: isHosted ? undefined : meta.ownerHandle,
        license: meta.license || "FreeDesignStore Community License",
        licenseId: meta.licenseId,
        origin: meta.origin,
        originDetail: meta.originDetail,
        contentType: meta.contentType,
        width: meta.width,
        height: meta.height,
        tags: meta.tags || [],
        url: `${origin}/api/stock/image/${encodeURIComponent(meta.id)}`,
        download: `${origin}/api/stock/image/${encodeURIComponent(meta.id)}`,
        filename: meta.filename || `${meta.id}.jpg`,
      };
    }
  }

  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  const pageUrl = `${origin}/photo/${encodeURIComponent(item.id)}`;
  const xText = encodeURIComponent(`${item.title} — free design asset on FreeDesignStore`);
  const xUrl = encodeURIComponent(pageUrl);

  const originLabels = {
    photograph: "Photograph",
    "ai-generated": "AI Generated",
    "3d-render": "3D Render",
    "digital-illustration": "Digital Illustration",
    "vector-art": "Vector Art",
    scan: "Scan",
    mixed: "Mixed Media",
  };
  const licenseExplainers = {
    cc0: "Dedicated to the public domain (CC0). Use for anything, no attribution required.",
    "fds-free": "Free to use in personal and commercial projects. Attribution appreciated but not required. Do not resell or redistribute as a competing stock library.",
    attribution: "Free to use in personal and commercial projects with credit to the creator. Do not resell or redistribute as a competing stock library.",
  };
  const licenseNote = licenseExplainers[item.licenseId] || licenseExplainers["fds-free"];
  const originBlock = item.origin
    ? `<div class="made"><strong>How this was made</strong><p>${esc(originLabels[item.origin] || item.origin)}${
        item.originDetail?.tool ? ` · ${esc(item.originDetail.tool)}` : ""
      }${item.originDetail?.model ? ` (${esc(item.originDetail.model)})` : ""}</p>${
        item.originDetail?.prompt
          ? `<details><summary>Generation prompt</summary><p class="prompt">${esc(item.originDetail.prompt)}</p></details>`
          : ""
      }</div>`
    : `<div class="made"><strong>How this was made</strong><p>Origin not disclosed.</p></div>`;

  const isVideoAsset = String(item.contentType || "").startsWith("video/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isVideoAsset ? "VideoObject" : "ImageObject",
    name: item.title,
    contentUrl: item.url,
    url: pageUrl,
    creator: { "@type": item.author === "NASA" || item.author === "FreeDesignStore" ? "Organization" : "Person", name: item.author },
    license: item.licenseId === "cc0" ? "https://creativecommons.org/publicdomain/zero/1.0/" : `${origin}/images/stock-photos/`,
    acquireLicensePage: pageUrl,
    ...(item.origin ? { creditText: `${item.author} — ${originLabels[item.origin] || item.origin}` } : {}),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(item.title)} — FreeDesignStore</title>
<meta name="description" content="Free ${esc(item.category)} design asset: ${esc(item.title)}. Download for personal and commercial use.">
<meta property="og:title" content="${esc(item.title)} — FreeDesignStore">
<meta property="og:description" content="Free ${esc(item.category)} design asset. Download for personal and commercial use.">
<meta property="og:image" content="${esc(item.url)}">
<meta property="og:image:width" content="${item.width || 1672}">
<meta property="og:image:height" content="${item.height || 941}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:type" content="article">
${String(item.contentType || "").startsWith("video/") ? `<meta property="og:video" content="${esc(item.url)}">\n<meta property="og:video:type" content="${esc(item.contentType)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(item.title)} — FreeDesignStore">
<meta name="twitter:image" content="${esc(item.url)}">
<link rel="canonical" href="${esc(pageUrl)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--accent:#ec4899;--bg:#0f0f0f;--panel:#1a1a1a;--line:#2a2a2a;--text:#f5f5f5;--muted:#9ca3af}
body{font-family:'Manrope',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{padding:.6rem 1.5rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid var(--line);background:var(--panel)}
.brand{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--text)}
.brand-name{font-family:'Fraunces',serif;font-size:1.05rem;font-weight:700}
nav{display:flex;gap:.85rem;font-size:.82rem;font-weight:600;margin-left:auto}
nav a{color:var(--muted)}nav a:hover{color:var(--text);text-decoration:none}
.photo-wrap{max-width:1200px;margin:0 auto;padding:1.5rem}
.photo-img{width:100%;border-radius:12px;display:block;background:var(--panel)}
.meta{max-width:1200px;margin:0 auto;padding:0 1.5rem 2rem;display:grid;grid-template-columns:1fr auto;gap:2rem;align-items:start}
.info h1{font-family:'Fraunces',serif;font-size:1.6rem;margin-bottom:.3rem}
.info p{color:var(--muted);font-size:.82rem;line-height:1.5}
.tags{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.5rem}
.tag{font-size:.7rem;font-weight:700;color:var(--accent);background:rgba(236,72,153,.12);border-radius:99px;padding:.2rem .55rem}
.actions{display:flex;flex-direction:column;gap:.5rem;align-items:flex-end}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:.55rem 1.2rem;border-radius:8px;border:1px solid transparent;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;transition:.15s;white-space:nowrap;text-decoration:none}
.btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)}.btn-primary:hover{background:#db2777;text-decoration:none}
.btn-outline{background:transparent;color:var(--text);border-color:var(--line)}.btn-outline:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
.share-row{display:flex;gap:.4rem;flex-wrap:wrap}
.share-btn{display:inline-flex;align-items:center;gap:5px;padding:.4rem .7rem;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font:inherit;font-size:.7rem;font-weight:700;cursor:pointer;transition:.15s;text-decoration:none}
.share-btn:hover{border-color:var(--accent);color:var(--accent);text-decoration:none}
.share-btn.copied{border-color:#10b981;color:#10b981}
.license{max-width:1200px;margin:0 auto;padding:0 1.5rem 2rem;font-size:.72rem;color:var(--muted);line-height:1.5}
.made{margin-top:.9rem;padding:.7rem .9rem;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:.75rem}
.made strong{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.made p{margin-top:.25rem;color:var(--text)}
.made details{margin-top:.4rem}.made summary{cursor:pointer;color:var(--accent);font-size:.72rem;font-weight:700}
.made .prompt{color:var(--muted);font-size:.72rem;margin-top:.3rem;line-height:1.5}
footer{border-top:1px solid var(--line);padding:1rem;text-align:center;font-size:.7rem;color:var(--muted);background:var(--panel)}
@media(max-width:640px){.meta{grid-template-columns:1fr}.actions{align-items:flex-start;flex-direction:row;flex-wrap:wrap}}
</style>
</head>
<body>
<header>
<a href="/" class="brand"><span style="font-size:1.4rem">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div class="photo-wrap">
${String(item.contentType || "").startsWith("video/")
    ? `<video class="photo-img" src="${esc(item.url)}" controls playsinline></video>`
    : `<img class="photo-img" src="${esc(item.url)}" alt="${esc(item.title)}">`}
</div>
<div class="meta">
<div class="info">
<h1>${esc(item.title)}</h1>
<p>By ${item.ownerHandle ? `<a href="/u/${esc(item.ownerHandle)}">${esc(item.author)}</a>` : esc(item.author)} · ${esc(item.category)} · ${esc(item.license)}</p>
<div class="tags">${(item.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
${originBlock}
</div>
<div class="actions">
<a class="btn btn-primary" href="${esc(item.download)}" download="${esc(item.filename)}">Download</a>
<a class="btn btn-outline" href="/images/stock-photos/">Browse all assets</a>
<div class="share-row">
<button class="share-btn" id="copyBtn" type="button">Copy link</button>
<a class="share-btn" href="https://x.com/intent/tweet?text=${xText}&url=${xUrl}" target="_blank" rel="noopener">X</a>
<a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${xUrl}" target="_blank" rel="noopener">Facebook</a>
<a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${xUrl}" target="_blank" rel="noopener">LinkedIn</a>
<a class="share-btn" href="https://pinterest.com/pin/create/button/?url=${xUrl}&media=${encodeURIComponent(item.url)}&description=${xText}" target="_blank" rel="noopener">Pinterest</a>
</div>
</div>
</div>
<p class="license">${esc(licenseNote)} · <a href="https://github.com/freedesignstore-online/platform/issues/new?title=${encodeURIComponent(`Report asset ${item.id}`)}&body=${encodeURIComponent(`Asset: ${pageUrl}\n\nReason (copyright, inappropriate content, wrong attribution, other):\n`)}" target="_blank" rel="noopener">Report this asset</a></p>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer>FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a></footer>
<script>
document.getElementById('copyBtn').addEventListener('click',function(){
  navigator.clipboard.writeText(location.href).then(()=>{
    this.textContent='Copied!';this.classList.add('copied');
    setTimeout(()=>{this.textContent='Copy link';this.classList.remove('copied');},2000);
  });
});
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=utf-8",
      "cache-control": "public, max-age=3600",
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
