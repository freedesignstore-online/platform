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
    cc0: "Dedicated to the public domain (CC0). Use for anything, personal or commercial — no attribution, no permission required.",
    "fds-free": "Free to use in personal and commercial projects. Attribution appreciated but not required.",
    attribution: "Free to use in personal and commercial projects with credit to the creator.",
  };
  const licenseNote = licenseExplainers[item.licenseId] || licenseExplainers["cc0"];
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
<link rel="stylesheet" href="/tw.css">
</head>
<body class="asset-page">
<header class="fds-header-dark">
<a href="/" class="brand"><span style="font-size:1.4rem">🎨</span><span class="brand-name">FreeDesignStore</span></a>
<nav class="fds-nav-dark"><a href="/tools/">Tools</a><a href="/images/stock-photos/">Assets</a><a href="/creators">Creators</a><a href="/skills/">Skills</a><a href="/console/">Console</a></nav>
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
<p class="license">${esc(licenseNote)} · <a href="/terms/">Terms &amp; License</a> · <a href="https://github.com/freedesignstore-online/platform/issues/new?title=${encodeURIComponent(`Report asset ${item.id}`)}&body=${encodeURIComponent(`Asset: ${pageUrl}\n\nReason (copyright, inappropriate content, wrong attribution, other):\n`)}" target="_blank" rel="noopener">Report this asset</a></p>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<footer class="fds-footer-dark">FreeDesignStore — part of <a href="https://openfrontier.pages.dev">Open Frontier</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></footer>
<div id="lightbox" hidden>
<img id="lbImg" alt="Full size preview">
<div class="lb-ui"><button data-lb="out" aria-label="Zoom out">&minus;</button><span id="lbZoom">100%</span><button data-lb="in" aria-label="Zoom in">+</button><button data-lb="fit">Fit</button><button data-lb="close" aria-label="Close">&times;</button></div>
</div>
<script>
document.getElementById('copyBtn').addEventListener('click',function(){
  navigator.clipboard.writeText(location.href).then(()=>{
    this.textContent='Copied!';this.classList.add('copied');
    setTimeout(()=>{this.textContent='Copy link';this.classList.remove('copied');},2000);
  });
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
