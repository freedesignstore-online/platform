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
        size: meta.size,
        width: meta.width,
        height: meta.height,
        duration: meta.duration,
        purpose: meta.purpose || [],
        description: meta.description,
        altText: meta.altText,
        palette: Array.isArray(meta.palette) ? meta.palette : [],
        sourceUrl: meta.sourceUrl,
        safe: meta.safe !== false,
        source: meta.source || (isHosted ? "hosted" : "community"),
        createdAt: meta.createdAt,
        tags: meta.tags || [],
        url: `${origin}/api/stock/image/${encodeURIComponent(meta.id)}`,
        download: `${origin}/api/stock/image/${encodeURIComponent(meta.id)}?download=1`,
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
    cc0: "Dedicated to the public domain (CC0). Use for anything, personal or commercial — no attribution, no permission required.",
    "fds-free": "Free to use in personal and commercial projects. Attribution appreciated but not required.",
    attribution: "Free to use in personal and commercial projects with credit to the creator.",
  };
  const licenseNote = licenseExplainers[item.licenseId] || licenseExplainers["cc0"];
  const trust = trustMetadata(item, licenseNote, pageUrl);
  const metadataText = assetMetadataText(item, trust, pageUrl);
  const trustBlock = `<section class="trust-panel" aria-labelledby="trustTitle">
<div class="trust-head"><div><p>Trust metadata</p><h2 id="trustTitle">Reuse details</h2></div><span>${esc(item.safe === false ? "Review before use" : "Safe for general design use")}</span></div>
<div class="trust-grid">${trust.rows.map((row) => `<div class="trust-item"><strong>${esc(row.label)}</strong><p>${row.html ? row.value : esc(row.value)}</p></div>`).join("")}</div>
</section>`;
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
    description: trust.description,
    contentUrl: item.url,
    url: pageUrl,
    creator: { "@type": item.author === "NASA" || item.author === "FreeDesignStore" ? "Organization" : "Person", name: item.author },
    license: item.licenseId === "cc0" ? "https://creativecommons.org/publicdomain/zero/1.0/" : `${origin}/images/stock-photos/`,
    acquireLicensePage: pageUrl,
    encodingFormat: item.contentType,
    ...(item.width ? { width: item.width } : {}),
    ...(item.height ? { height: item.height } : {}),
    ...(item.size ? { contentSize: readableBytes(item.size) } : {}),
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
<link rel="stylesheet" href="/tw.css">
</head>
<body class="asset-page">
<header class="fds-header-dark">
<a href="/" class="brand"><span class="brand-emoji">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav class="fds-nav-dark"><a href="/tools/">Tools</a><a href="/workflows/">Workflows</a><a href="/projects/">Projects</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
</header>
<div style="max-width:1100px;margin:16px auto -4px;padding:0 20px">
<a href="/images/stock-photos/" id="backBtn" class="btn btn-outline">&larr; Back to results <span style="opacity:.6;font-weight:600">Esc</span></a>
</div>
<div class="photo-wrap">
${String(item.contentType || "").startsWith("video/")
    ? `<video class="photo-img" src="${esc(item.url)}" controls playsinline></video>`
    : `<img class="photo-img" id="photoImg" src="${esc(item.url)}" alt="${esc(item.title)}">`}
</div>
${String(item.contentType || "").startsWith("video/") ? "" : `<p class="zoom-hint">Click the image for a full-size preview — scroll or pinch to zoom, drag to pan.</p>`}
<div class="meta">
<div class="info">
<h1>${esc(item.title)}</h1>
<p>By ${item.ownerHandle ? `<a href="/u/${esc(item.ownerHandle)}">${esc(item.author)}</a>` : esc(item.author)} · <a href="/images/stock-photos/?category=${encodeURIComponent(item.category || "")}">${esc(item.category)}</a> · ${esc(item.license)}</p>
<div class="tags">${(item.tags || []).map((t) => `<a class="tag" href="/images/stock-photos/?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>
${originBlock}
</div>
<div class="actions">
<a class="btn btn-primary" href="${esc(item.download)}" download="${esc(item.filename)}">Download</a>
<button class="btn btn-outline" id="saveProjectBtn" type="button">Save to Project</button>
<button class="btn btn-outline" id="reviewAssetBtn" type="button">Review</button>
<a class="btn btn-outline" href="/images/stock-photos/">Browse all assets</a>
<div class="share-row">
<button class="share-btn" id="copyBtn" type="button">Copy link</button>
<button class="share-btn" id="copyInfoBtn" type="button">Copy info</button>
<button class="share-btn" id="downloadInfoBtn" type="button">Download info</button>
<a class="share-btn" href="https://x.com/intent/tweet?text=${xText}&url=${xUrl}" target="_blank" rel="noopener">X</a>
<a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${xUrl}" target="_blank" rel="noopener">Facebook</a>
<a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${xUrl}" target="_blank" rel="noopener">LinkedIn</a>
<a class="share-btn" href="https://pinterest.com/pin/create/button/?url=${xUrl}&media=${encodeURIComponent(item.url)}&description=${xText}" target="_blank" rel="noopener">Pinterest</a>
</div>
</div>
</div>
${trustBlock}
<p class="license">${esc(licenseNote)} · <a href="/terms/">Terms &amp; License</a> · <a href="https://github.com/freedesignstore-online/platform/issues/new?title=${encodeURIComponent(`Report asset ${item.id}`)}&body=${encodeURIComponent(`Asset: ${pageUrl}\n\nReason (copyright, inappropriate content, wrong attribution, other):\n`)}" target="_blank" rel="noopener">Report this asset</a></p>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer class="fds-footer-dark">FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></footer>
<div id="lightbox" hidden>
<img id="lbImg" alt="Full size preview">
<div class="lb-ui"><button data-lb="out" aria-label="Zoom out">&minus;</button><span id="lbZoom">100%</span><button data-lb="in" aria-label="Zoom in">+</button><button data-lb="fit">Fit</button><button data-lb="close" aria-label="Close">&times;</button></div>
</div>
<script src="/projects/project-save.js"></script>
<script>
const fdsProjectAsset=${JSON.stringify({
    label: item.title,
    pageUrl,
    mediaUrl: item.url,
    type: item.assetType || "asset",
    source: "hosted",
    assetId: item.id,
    author: item.author,
    license: item.license,
    category: item.category,
    tags: item.tags || [],
  }).replace(/</g, "\\u003c")};
const fdsMetadataText=${JSON.stringify(metadataText).replace(/</g, "\\u003c")};
document.getElementById('saveProjectBtn').addEventListener('click',function(){
  if(!window.FDSProjects) return;
  const result=window.FDSProjects.saveAsset(fdsProjectAsset,{defaultProjectName:'Asset Collection'});
  this.textContent='Saved to '+result.project.name;
  setTimeout(()=>{this.textContent='Save to Project';},1800);
});
document.getElementById('reviewAssetBtn').addEventListener('click',function(){
  localStorage.setItem('fds.review.seed',JSON.stringify({
    title:fdsProjectAsset.label+' review',
    source:'asset-detail',
    assets:[fdsProjectAsset]
  }));
  location.href='/reviews/#new';
});
document.getElementById('copyBtn').addEventListener('click',function(){
  navigator.clipboard.writeText(location.href).then(()=>{
    this.textContent='Copied!';this.classList.add('copied');
    setTimeout(()=>{this.textContent='Copy link';this.classList.remove('copied');},2000);
  });
});
document.getElementById('copyInfoBtn').addEventListener('click',function(){
  navigator.clipboard.writeText(fdsMetadataText).then(()=>{
    this.textContent='Copied info';this.classList.add('copied');
    setTimeout(()=>{this.textContent='Copy info';this.classList.remove('copied');},2000);
  });
});
document.getElementById('downloadInfoBtn').addEventListener('click',function(){
  const blob=new Blob([fdsMetadataText],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='${esc(metadataFilename(item))}';
  a.click();
  URL.revokeObjectURL(a.href);
});
// Go back to the list exactly where the visitor left it (scroll + filters),
// falling back to the gallery when this page was opened directly.
function fdsGoBack(){
  if(history.length>1&&document.referrer){
    try{if(new URL(document.referrer).origin===location.origin){history.back();return;}}catch(e){}
  }
  location.href='/images/stock-photos/';
}
document.getElementById('backBtn').addEventListener('click',function(e){e.preventDefault();fdsGoBack();});
(function(){
const lb=document.getElementById('lightbox'),img=document.getElementById('lbImg'),zl=document.getElementById('lbZoom');
let s=1,tx=0,ty=0,fitS=1,lastDist=0,moved=false;const ptrs=new Map();
function apply(){img.style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';zl.textContent=Math.round(s*100)+'%';}
function fit(){const w=img.naturalWidth||1,h=img.naturalHeight||1;fitS=Math.min(innerWidth/w,innerHeight/h,1);s=fitS;tx=(innerWidth-w*s)/2;ty=(innerHeight-h*s)/2;apply();}
function zoomAt(f,cx,cy){const ns=Math.min(Math.max(s*f,Math.min(fitS,1)*0.25),8);tx=cx-(cx-tx)*ns/s;ty=cy-(cy-ty)*ns/s;s=ns;apply();}
window.openLightbox=function(src){img.src=src;lb.hidden=false;document.body.style.overflow='hidden';if(img.complete&&img.naturalWidth)fit();else img.onload=fit;};
function close(){lb.hidden=true;document.body.style.overflow='';}
lb.addEventListener('click',e=>{if(e.target===lb&&!moved)close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!lb.hidden)close();else fdsGoBack();}});
lb.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.25:0.8,e.clientX,e.clientY);},{passive:false});
img.addEventListener('dblclick',e=>{if(Math.abs(s-1)<0.01)fit();else zoomAt(1/s,e.clientX,e.clientY);});
lb.addEventListener('pointerdown',e=>{ptrs.set(e.pointerId,[e.clientX,e.clientY]);lb.setPointerCapture(e.pointerId);moved=false;});
lb.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);
if(ptrs.size===1){tx+=e.clientX-prev[0];ty+=e.clientY-prev[1];if(Math.abs(e.clientX-prev[0])+Math.abs(e.clientY-prev[1])>2)moved=true;apply();}
else if(ptrs.size===2){const p=[...ptrs.values()];const d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(lastDist)zoomAt(d/lastDist,(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2);lastDist=d;moved=true;}});
['pointerup','pointercancel'].forEach(ev=>lb.addEventListener(ev,e=>{ptrs.delete(e.pointerId);lastDist=0;}));
document.querySelectorAll('[data-lb]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=b.dataset.lb;if(a==='in')zoomAt(1.25,innerWidth/2,innerHeight/2);else if(a==='out')zoomAt(0.8,innerWidth/2,innerHeight/2);else if(a==='fit')fit();else close();}));
const photo=document.getElementById('photoImg');
if(photo)photo.addEventListener('click',()=>openLightbox(photo.src));
})();
</script>
<script src="/nav.js" defer></script></body>
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

const ASSET_TYPE_LABELS = {
  photo: "Photo",
  illustration: "Illustration",
  vector: "Vector",
  icon: "Icon",
  pattern: "Pattern",
  texture: "Texture",
  background: "Background",
  ui: "UI asset",
  mockup: "Mockup",
  template: "Template",
  "3d-render": "3D render",
  video: "Video",
  animation: "Animation",
};

const ORIGIN_LABELS = {
  photograph: "Photograph",
  "ai-generated": "AI Generated",
  "3d-render": "3D Render",
  "digital-illustration": "Digital Illustration",
  "vector-art": "Vector Art",
  scan: "Scan",
  mixed: "Mixed Media",
};

const PURPOSE_LABELS = {
  profile_background: "Profile background",
  hero_image: "Hero image",
  thumbnail: "Thumbnail",
  wallpaper: "Wallpaper",
};

function readableBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "File size not supplied";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function dimensionsText(item) {
  if (item.width && item.height) {
    const base = `${Math.round(item.width)} x ${Math.round(item.height)} px`;
    return item.duration ? `${base} · ${Math.round(item.duration)}s` : base;
  }
  return item.duration ? `${Math.round(item.duration)}s · dimensions not supplied` : "Dimensions not supplied";
}

function originText(item) {
  const label = ORIGIN_LABELS[item.origin] || item.origin;
  if (!label) return "Origin not disclosed";
  const detail = item.originDetail || {};
  return `${label}${detail.tool ? ` · ${detail.tool}` : ""}${detail.model ? ` (${detail.model})` : ""}`;
}

function suggestedUses(item) {
  if (Array.isArray(item.purpose) && item.purpose.length) {
    return item.purpose.map((purpose) => PURPOSE_LABELS[purpose] || purpose).join(", ");
  }
  const type = item.assetType || "asset";
  if (["photo", "background", "3d-render"].includes(type)) return "Hero sections, campaign visuals, social posts";
  if (["pattern", "texture"].includes(type)) return "Background fills, brand systems, packaging, UI surfaces";
  if (["icon", "vector", "illustration"].includes(type)) return "Interfaces, landing pages, decks, brand collateral";
  if (["video", "animation"].includes(type)) return "Motion backgrounds, social clips, presentation inserts";
  if (["ui", "template", "mockup"].includes(type)) return "Product previews, UI kits, client presentations";
  return "Brand assets, campaign layouts, presentation visuals";
}

function descriptionText(item) {
  return (
    item.description ||
    item.altText ||
    `${item.title || "Untitled asset"} is a ${ASSET_TYPE_LABELS[item.assetType] || item.assetType || "design asset"} in ${item.category || "the catalog"} by ${item.author || "FreeDesignStore"}.`
  );
}

function paletteValues(item) {
  return (Array.isArray(item.palette) ? item.palette : [])
    .filter((color) => /^#[0-9a-f]{3,8}$/i.test(String(color || "")))
    .slice(0, 8);
}

function paletteHtml(item) {
  const values = paletteValues(item);
  if (!values.length) return "Palette not supplied";
  return `<span class="trust-palette">${values.map((color) => `<span title="${esc(color)}" style="background:${esc(color)}"></span>`).join("")}</span>`;
}

function trustMetadata(item, licenseNote, pageUrl) {
  const description = descriptionText(item);
  const rows = [
    { label: "License and use", value: `${item.license || "License not supplied"} — ${licenseNote}` },
    { label: "Source / origin", value: originText(item) },
    { label: "Dimensions", value: dimensionsText(item) },
    { label: "File type", value: `${item.contentType || "File type not supplied"} · ${readableBytes(item.size)}` },
    { label: "Suggested use", value: suggestedUses(item) },
    { label: "Description / alt text", value: description },
    { label: "Color palette", value: paletteHtml(item), html: true },
    { label: "Download / export", value: `Original file: ${item.filename || "filename not supplied"} · ${item.download || pageUrl}` },
  ];
  return { description, rows };
}

function assetMetadataText(item, trust, pageUrl) {
  const rowValue = (label) => trust.rows.find((row) => row.label === label)?.value || "";
  return [
    `Asset: ${item.title || "Untitled asset"}`,
    `URL: ${pageUrl}`,
    `Creator: ${item.author || "Unknown"}`,
    `License and use: ${rowValue("License and use")}`,
    `Source / origin: ${rowValue("Source / origin")}`,
    `Type: ${ASSET_TYPE_LABELS[item.assetType] || item.assetType || "Asset"}`,
    `Category: ${item.category || "Uncategorized"}`,
    `Dimensions: ${rowValue("Dimensions")}`,
    `File type: ${item.contentType || "File type not supplied"}`,
    `File size: ${readableBytes(item.size)}`,
    `Suggested use: ${rowValue("Suggested use")}`,
    `Description / alt text: ${trust.description}`,
    `Palette: ${paletteValues(item).join(", ") || "Not supplied"}`,
    `Download/source: ${item.download || item.sourceUrl || pageUrl}`,
    `Tags: ${(item.tags || []).join(", ") || "None"}`,
  ].join("\n");
}

function metadataFilename(item) {
  const base =
    String(item.title || item.id || "asset")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "asset";
  return `${base}-metadata.txt`;
}
