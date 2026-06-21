// Related Tools — FreeDesignStore
(function() {
  const ACCENT = '#ec4899';
  const REGISTRY_KEY = 'robots';

  function getCurrentId() {
    const match = window.location.pathname.match(/\/(?:brand|images|templates)\/([^/]+)/);
    return match ? match[1] : null;
  }

  function getPrefix() {
    const match = window.location.pathname.match(/\/(brand|images|templates)\//);
    return match ? '/' + match[1] + '/' : '/brand/';
  }

  function render(current, items) {
    const same = items.filter(i => i.category === current.category && i.id !== current.id);
    const others = items.filter(i => i.category !== current.category && i.id !== current.id);
    let related = same.slice(0, 3);
    if (related.length < 3) related = related.concat(others.slice(0, 3 - related.length));
    if (related.length === 0) return;

    const container = document.createElement('div');
    container.id = 'related-tools';
    container.innerHTML = '<style>' +
      '#related-tools{position:fixed;bottom:0;left:0;right:0;z-index:50;background:#fff;border-top:1px solid #e5e7eb;padding:.6rem 1rem;display:flex;align-items:center;gap:.6rem;overflow-x:auto;box-shadow:0 -2px 8px rgba(0,0,0,.04)}' +
      '.rel-label{font-size:.7rem;color:#6b7280;font-weight:600;white-space:nowrap;font-family:Manrope,system-ui,sans-serif}' +
      '.rel-card{display:flex;align-items:center;gap:.4rem;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:.35rem .6rem;text-decoration:none;color:#1a1a1a;font-family:Manrope,system-ui,sans-serif;transition:border-color .15s;flex-shrink:0}' +
      '.rel-card:hover{border-color:' + ACCENT + '}' +
      '.rel-name{font-size:.72rem;font-weight:600;white-space:nowrap}' +
      '</style>' +
      '<span class="rel-label">Related:</span>' +
      related.map(r => {
        const prefix = '/' + (r.section || 'brand') + '/';
        return '<a class="rel-card" href="' + prefix + r.id + '/"><span class="rel-name">' + r.name + '</span></a>';
      }).join('');

    document.body.appendChild(container);
  }

  const currentId = getCurrentId();
  if (!currentId || currentId === 'stock-photos') return;

  fetch('/registry.json')
    .then(r => r.json())
    .then(data => {
      const items = data[REGISTRY_KEY] || [];
      const current = items.find(i => i.id === currentId);
      if (current) render(current, items);
    })
    .catch(() => {});
})();
