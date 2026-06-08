/**
 * AI Task Queue — shared across all FreeDesignStore tools
 *
 * Queues AI tasks (Chrome Nano / Prompt API) and processes them one by one.
 * Shows progress via a floating panel. Tasks persist in localStorage so they
 * survive page navigation. Results are stored and accessible from any tool.
 *
 * Usage in any tool:
 *   <script src="/ai-queue.js"></script>
 *
 *   // Add a task
 *   AIQueue.add({
 *     id: 'logo-suggest-1',
 *     tool: 'Logo Maker',
 *     description: 'Generate logo style for "Acme Corp"',
 *     prompt: 'Suggest a logo style for brand "Acme Corp"...',
 *     systemPrompt: 'You are a brand designer...',
 *     onComplete: (result) => { applyResult(result); }
 *   });
 *
 *   // Check status
 *   AIQueue.getStatus(); // { pending: 3, processing: 1, completed: 5, failed: 0 }
 *
 *   // Get results
 *   AIQueue.getResult('logo-suggest-1'); // { status, result, error, timestamp }
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'fds-ai-queue';
  const MAX_HISTORY = 50;

  // State
  let queue = [];
  let processing = false;
  let currentTask = null;
  let callbacks = {};
  let panelEl = null;

  // Load persisted queue
  function loadQueue() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      queue = data.queue || [];
      return data.history || [];
    } catch { return []; }
  }

  function saveQueue(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: queue.filter(t => t.status === 'pending'),
        history: (history || getHistory()).slice(0, MAX_HISTORY)
      }));
    } catch {}
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').history || [];
    } catch { return []; }
  }

  // Check AI availability
  async function checkAI() {
    try {
      if (self.ai && self.ai.languageModel) {
        const caps = await self.ai.languageModel.capabilities();
        return caps.available === 'readily' || caps.available === 'after-download';
      }
    } catch {}
    return false;
  }

  // Process next task
  async function processNext() {
    if (processing) return;
    const next = queue.find(t => t.status === 'pending');
    if (!next) { updatePanel(); return; }

    processing = true;
    currentTask = next;
    next.status = 'processing';
    next.startedAt = Date.now();
    updatePanel();

    try {
      const aiAvailable = await checkAI();
      let result;

      if (aiAvailable) {
        const session = await self.ai.languageModel.create({
          systemPrompt: next.systemPrompt || 'You are a helpful creative assistant. Be concise and specific.'
        });
        result = await session.prompt(next.prompt);
        session.destroy();
      } else {
        throw new Error('Chrome AI not available');
      }

      next.status = 'completed';
      next.result = result;
      next.completedAt = Date.now();
      next.duration = next.completedAt - next.startedAt;

      // Call registered callback
      if (callbacks[next.id]) {
        try { callbacks[next.id](result); } catch (e) { console.warn('Callback error:', e); }
      }

      // Show notification
      showToast(`AI completed: ${next.description}`, 'success');
      if (document.hidden && Notification.permission === 'granted') {
        new Notification('AI Task Complete', { body: next.description, icon: '/favicon.svg' });
      }

    } catch (e) {
      next.status = 'failed';
      next.error = e.message;
      next.completedAt = Date.now();
      showToast(`AI failed: ${next.description} — ${e.message}`, 'error');
    }

    // Move to history
    const history = getHistory();
    history.unshift(next);
    queue = queue.filter(t => t.id !== next.id);
    saveQueue(history);

    processing = false;
    currentTask = null;
    updatePanel();

    // Process next in queue
    setTimeout(processNext, 500);
  }

  // Public API
  window.AIQueue = {
    add(task) {
      if (!task.id) task.id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      task.status = 'pending';
      task.createdAt = Date.now();
      queue.push(task);
      if (task.onComplete) {
        callbacks[task.id] = task.onComplete;
        delete task.onComplete; // Don't persist functions
      }
      saveQueue();
      updatePanel();
      processNext();
      return task.id;
    },

    cancel(id) {
      queue = queue.filter(t => t.id !== id);
      saveQueue();
      updatePanel();
    },

    getStatus() {
      const history = getHistory();
      return {
        pending: queue.filter(t => t.status === 'pending').length,
        processing: processing ? 1 : 0,
        completed: history.filter(t => t.status === 'completed').length,
        failed: history.filter(t => t.status === 'failed').length,
        total: queue.length + history.length
      };
    },

    getResult(id) {
      const history = getHistory();
      return history.find(t => t.id === id) || queue.find(t => t.id === id) || null;
    },

    getHistory() { return getHistory(); },

    clearHistory() {
      localStorage.removeItem(STORAGE_KEY);
      queue = [];
      updatePanel();
    },

    // Register a callback for a task (useful if page navigated away and came back)
    onComplete(id, fn) { callbacks[id] = fn; },

    // Show/hide the panel
    showPanel() { if (panelEl) panelEl.classList.add('open'); },
    hidePanel() { if (panelEl) panelEl.classList.remove('open'); },
    togglePanel() { if (panelEl) panelEl.classList.toggle('open'); }
  };

  // UI: Floating queue panel
  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      .aiq-fab{position:fixed;bottom:20px;left:20px;z-index:9999;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:none;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(139,92,246,.3);transition:transform .15s;font-family:Manrope,system-ui,sans-serif}
      .aiq-fab:hover{transform:scale(1.08)}
      .aiq-fab .badge{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;font-size:.6rem;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fafafa}
      .aiq-panel{position:fixed;bottom:72px;left:20px;z-index:9998;background:#fff;border:1px solid #e5e7eb;border-radius:12px;width:320px;max-height:400px;box-shadow:0 8px 30px rgba(0,0,0,.12);overflow:hidden;transform:scale(.9) translateY(10px);opacity:0;pointer-events:none;transition:all .2s;font-family:Manrope,system-ui,sans-serif}
      .aiq-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:auto}
      .aiq-header{padding:12px 14px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
      .aiq-header h4{font-size:.82rem;font-weight:700;color:#1a1a1a}
      .aiq-header .aiq-close{background:none;border:none;font-size:1.1rem;cursor:pointer;color:#6b7280;padding:2px 6px}
      .aiq-body{overflow-y:auto;max-height:320px;padding:8px}
      .aiq-item{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:.75rem}
      .aiq-item:last-child{border:none}
      .aiq-item-title{font-weight:600;color:#1a1a1a;margin-bottom:2px}
      .aiq-item-meta{color:#6b7280;font-size:.68rem;display:flex;justify-content:space-between;align-items:center}
      .aiq-status{padding:2px 6px;border-radius:4px;font-size:.6rem;font-weight:700}
      .aiq-status.pending{background:#fef3c7;color:#92400e}
      .aiq-status.processing{background:#dbeafe;color:#1e40af;animation:aiq-pulse 1s infinite}
      .aiq-status.completed{background:#dcfce7;color:#166534}
      .aiq-status.failed{background:#fee2e2;color:#991b1b}
      @keyframes aiq-pulse{50%{opacity:.5}}
      .aiq-empty{text-align:center;padding:20px;color:#9ca3af;font-size:.78rem}
      .aiq-toast{position:fixed;bottom:72px;left:72px;z-index:9997;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:.75rem;box-shadow:0 4px 12px rgba(0,0,0,.08);font-family:Manrope,system-ui,sans-serif;animation:aiq-slide .3s}
      .aiq-toast.success{border-left:3px solid #16a34a}
      .aiq-toast.error{border-left:3px solid #dc2626}
      @keyframes aiq-slide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    `;
    document.head.appendChild(style);

    // FAB button
    const fab = document.createElement('button');
    fab.className = 'aiq-fab';
    fab.innerHTML = '🧠<span class="badge" id="aiqBadge" style="display:none">0</span>';
    fab.onclick = () => AIQueue.togglePanel();
    document.body.appendChild(fab);

    // Panel
    panelEl = document.createElement('div');
    panelEl.className = 'aiq-panel';
    panelEl.innerHTML = `
      <div class="aiq-header">
        <h4>AI Task Queue</h4>
        <button class="aiq-close" onclick="AIQueue.hidePanel()">&times;</button>
      </div>
      <div class="aiq-body" id="aiqBody">
        <div class="aiq-empty">No AI tasks yet. Tools will queue tasks here automatically.</div>
      </div>
    `;
    document.body.appendChild(panelEl);
  }

  function updatePanel() {
    const badge = document.getElementById('aiqBadge');
    const body = document.getElementById('aiqBody');
    if (!badge || !body) return;

    const pending = queue.filter(t => t.status === 'pending').length;
    const isProcessing = processing ? 1 : 0;
    const total = pending + isProcessing;

    badge.style.display = total > 0 ? 'flex' : 'none';
    badge.textContent = total;

    // Render items
    const history = getHistory().slice(0, 10);
    const allItems = [...queue, ...history];

    if (!allItems.length) {
      body.innerHTML = '<div class="aiq-empty">No AI tasks yet. Tools will queue tasks here automatically.</div>';
      return;
    }

    body.innerHTML = allItems.map(item => {
      const time = item.completedAt ? `${((item.completedAt - item.startedAt) / 1000).toFixed(1)}s` : item.startedAt ? 'running...' : 'queued';
      return `<div class="aiq-item">
        <div class="aiq-item-title">${item.description || item.id}</div>
        <div class="aiq-item-meta">
          <span>${item.tool || 'Unknown'} &middot; ${time}</span>
          <span class="aiq-status ${item.status}">${item.status}</span>
        </div>
      </div>`;
    }).join('');
  }

  function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `aiq-toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 4000);
  }

  // Init
  loadQueue();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { createPanel(); updatePanel(); processNext(); });
  } else {
    createPanel(); updatePanel(); processNext();
  }
})();
