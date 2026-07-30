(function () {
  var STORE_KEY = "fds.projects.v1";
  var ACTIVE_KEY = "fds.projects.active";

  function now() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (prefix || "proj") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function emptyProject(name) {
    var stamp = now();
    return {
      id: uid("proj"),
      name: name || "Asset Collection",
      createdAt: stamp,
      updatedAt: stamp,
      colors: [],
      fonts: [],
      assets: [],
      notes: "",
      exports: [],
      workflows: {}
    };
  }

  function readState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (!Array.isArray(parsed.projects)) parsed.projects = [];
      parsed.version = 1;
      parsed.activeId = localStorage.getItem(ACTIVE_KEY) || parsed.activeId || (parsed.projects[0] && parsed.projects[0].id) || "";
      return parsed;
    } catch (err) {
      return { version: 1, activeId: "", projects: [] };
    }
  }

  function writeState(state) {
    state.version = 1;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (state.activeId) localStorage.setItem(ACTIVE_KEY, state.activeId);
  }

  function normalizeProject(project) {
    project.colors = Array.isArray(project.colors) ? project.colors : [];
    project.fonts = Array.isArray(project.fonts) ? project.fonts : [];
    project.assets = Array.isArray(project.assets) ? project.assets : [];
    project.exports = Array.isArray(project.exports) ? project.exports : [];
    project.workflows = project.workflows || {};
    project.notes = project.notes || "";
    return project;
  }

  function ensureActiveProject(state, defaultName) {
    var project = state.projects.find(function (item) { return item.id === state.activeId; }) || state.projects[0];
    if (!project) {
      project = emptyProject(defaultName);
      state.projects.unshift(project);
    }
    state.activeId = project.id;
    return normalizeProject(project);
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function normalizeAsset(asset) {
    var stamp = now();
    return {
      id: asset.projectAssetId || uid("asset"),
      label: clean(asset.label || asset.title || asset.name || asset.url || "Saved asset"),
      url: clean(asset.pageUrl || asset.url || ""),
      mediaUrl: clean(asset.mediaUrl || asset.imageUrl || asset.download || asset.url || ""),
      type: clean(asset.type || asset.assetType || "asset"),
      source: clean(asset.source || "fds"),
      assetId: clean(asset.assetId || asset.id || ""),
      author: clean(asset.author || ""),
      license: clean(asset.license || ""),
      category: clean(asset.category || ""),
      tags: Array.isArray(asset.tags) ? asset.tags.filter(Boolean).slice(0, 12) : [],
      svg: asset.svg || "",
      createdAt: asset.createdAt || stamp,
      updatedAt: stamp
    };
  }

  function normalizeExport(exportItem) {
    var stamp = now();
    var label = clean(exportItem && (exportItem.label || exportItem.title || exportItem.name));
    return {
      id: exportItem && exportItem.projectExportId || uid("export"),
      label: label || "Saved export",
      type: clean(exportItem && (exportItem.type || "export")),
      source: clean(exportItem && (exportItem.source || "fds")),
      url: clean(exportItem && (exportItem.url || "")),
      format: clean(exportItem && (exportItem.format || "")),
      score: typeof (exportItem && exportItem.score) === "number" ? exportItem.score : null,
      status: clean(exportItem && exportItem.status || ""),
      summary: clean(exportItem && exportItem.summary || ""),
      report: clean(exportItem && exportItem.report || ""),
      createdAt: exportItem && exportItem.createdAt || stamp,
      updatedAt: stamp
    };
  }

  function sameAsset(a, b) {
    if (a.assetId && b.assetId && a.source === b.source) return a.assetId === b.assetId;
    if (a.url && b.url) return a.url === b.url;
    if (a.mediaUrl && b.mediaUrl) return a.mediaUrl === b.mediaUrl;
    return false;
  }

  function toast(message) {
    var existing = document.getElementById("fdsProjectToast");
    if (existing) existing.remove();
    var note = document.createElement("div");
    note.id = "fdsProjectToast";
    note.setAttribute("role", "status");
    note.textContent = message;
    note.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2000;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.2);box-shadow:0 12px 30px rgba(15,23,42,.22);border-radius:10px;padding:10px 14px;font:700 13px Manrope,system-ui,sans-serif;max-width:min(420px,calc(100vw - 28px));text-align:center;";
    document.body.appendChild(note);
    setTimeout(function () { note.remove(); }, 2200);
  }

  function saveAsset(asset, options) {
    var state = readState();
    var project = ensureActiveProject(state, options && options.defaultProjectName);
    var item = normalizeAsset(asset || {});
    var existing = project.assets.find(function (candidate) { return sameAsset(candidate, item); });
    if (existing) {
      Object.assign(existing, item, { id: existing.id, createdAt: existing.createdAt || item.createdAt, updatedAt: now() });
      item = existing;
    } else {
      project.assets.unshift(item);
    }
    project.updatedAt = now();
    writeState(state);
    if (!(options && options.silent)) toast("Saved to " + project.name);
    return { state: state, project: project, item: item, duplicate: Boolean(existing) };
  }

  function saveTool(tool, options) {
    return saveAsset({
      label: tool && (tool.label || tool.title || tool.name),
      url: tool && tool.url,
      type: "tool",
      source: "fds-tool",
      assetId: tool && (tool.id || tool.slug || tool.url),
      category: tool && tool.category
    }, options);
  }

  function saveExport(exportItem, options) {
    var state = readState();
    var project = ensureActiveProject(state, options && options.defaultProjectName);
    var item = normalizeExport(exportItem || {});
    var existing = project.exports.find(function (candidate) {
      if (candidate.id && item.id && candidate.id === item.id) return true;
      return candidate.source && item.source && candidate.label === item.label && candidate.source === item.source;
    });
    if (existing) {
      Object.assign(existing, item, { id: existing.id, createdAt: existing.createdAt || item.createdAt, updatedAt: now() });
      item = existing;
    } else {
      project.exports.unshift(item);
    }
    project.updatedAt = now();
    writeState(state);
    if (!(options && options.silent)) toast("Saved report to " + project.name);
    return { state: state, project: project, item: item, duplicate: Boolean(existing) };
  }

  window.FDSProjects = {
    keys: { store: STORE_KEY, active: ACTIVE_KEY },
    readState: readState,
    writeState: writeState,
    ensureActiveProject: ensureActiveProject,
    saveAsset: saveAsset,
    saveTool: saveTool,
    saveExport: saveExport
  };
})();
