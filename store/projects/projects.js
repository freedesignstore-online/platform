(function () {
  var STORE_KEY = "fds.projects.v1";
  var ACTIVE_KEY = "fds.projects.active";
  var REVIEW_SEED_KEY = "fds.review.seed";

  function now() {
    return new Date().toISOString();
  }

  function uid() {
    return "proj-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function emptyProject(name) {
    var stamp = now();
    return {
      id: uid(),
      name: name || "Untitled Project",
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

  function activeProject(state) {
    return state.projects.find(function (project) { return project.id === state.activeId; }) || state.projects[0];
  }

  function touch(project) {
    project.updatedAt = now();
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function field(label, id, value, placeholder) {
    return '<label class="grid gap-1 text-[.76rem] font-bold text-ink">' + esc(label) + '<input class="search-input" id="' + esc(id) + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || "") + '"></label>';
  }

  function textarea(label, id, value, placeholder) {
    return '<label class="grid gap-1 text-[.76rem] font-bold text-ink">' + esc(label) + '<textarea class="search-input min-h-[140px]" id="' + esc(id) + '" placeholder="' + esc(placeholder || "") + '">' + esc(value) + "</textarea></label>";
  }

  function listItems(items, type) {
    if (!items.length) return '<p class="text-[.78rem] text-muted">Nothing saved yet.</p>';
    return items.map(function (item, index) {
      var label = typeof item === "string" ? item : item.label;
      var meta = typeof item === "string" ? "" : (item.url || item.type || item.createdAt || "");
      return '<div class="flex items-start gap-2 justify-between border border-hairline rounded-lg p-2 bg-panel"><div class="min-w-0"><strong class="block text-[.8rem]">' + esc(label) + '</strong><span class="block text-[.7rem] text-muted break-all">' + esc(meta) + '</span></div><button class="filter-btn !text-[.68rem]" data-remove="' + esc(type) + '" data-index="' + index + '" type="button">Remove</button></div>';
    }).join("");
  }

  function workflowProgress(project) {
    var entries = Object.keys(project.workflows || {}).map(function (slug) {
      var flow = project.workflows[slug];
      var count = Array.isArray(flow.checked) ? flow.checked.length : 0;
      return '<a class="card" href="/workflows/' + esc(slug) + '/"><div class="card-icon" style="background:#ec4899">' + count + '</div><div class="card-body"><div class="card-name">' + esc(flow.title || slug) + '</div><div class="card-desc">Saved ' + esc((flow.savedAt || "").slice(0, 10)) + " · " + count + ' checklist items</div></div><span class="card-cta">Open -></span></a>';
    });
    return entries.length ? entries.join("") : '<p class="text-[.78rem] text-muted">Open a workflow and use Save to Project to capture progress here.</p>';
  }

  function reviewItems(project) {
    return []
      .concat(project.assets || [])
      .concat((project.exports || []).map(function (item) {
        return Object.assign({}, item, { type: item.type || "export", source: item.source || "project-export" });
      }));
  }

  function renderList(state) {
    var list = document.getElementById("projectList");
    if (!state.projects.length) {
      list.innerHTML = '<p class="text-[.78rem] text-muted">No projects yet.</p>';
      return;
    }
    list.innerHTML = state.projects.map(function (project) {
      var active = project.id === state.activeId ? " active" : "";
      return '<button class="filter-btn text-left' + active + '" data-project="' + esc(project.id) + '" type="button"><strong class="block">' + esc(project.name) + '</strong><span class="block text-[.68rem] font-normal">' + esc(project.updatedAt.slice(0, 10)) + "</span></button>";
    }).join("");
  }

  function renderEditor(state) {
    var editor = document.getElementById("projectEditor");
    var project = activeProject(state);
    if (!project) {
      editor.innerHTML = '<section class="bg-panel border border-hairline rounded-2xl p-5"><h2 class="font-display text-[1.3rem] font-bold mb-2">Create a project</h2><p class="text-muted text-[.86rem]">Start a local workspace for one brand, campaign, landing page, deck, or UI kit.</p></section>';
      return;
    }
    state.activeId = project.id;
    editor.innerHTML = [
      '<section class="bg-panel border border-hairline rounded-2xl p-4 grid gap-3">',
      '<div class="flex justify-between gap-3 items-start max-[640px]:flex-col"><div>' + field("Project name", "projectName", project.name, "Client launch kit") + '</div><div class="flex gap-2 flex-wrap"><button class="filter-btn" id="createReview" type="button">Create Review Package</button><button class="filter-btn" id="deleteProject" type="button">Delete Project</button></div></div>',
      textarea("Notes", "projectNotes", project.notes || "", "Brief, decisions, open questions, next actions..."),
      "</section>",
      '<section class="grid grid-cols-2 gap-4 max-[820px]:grid-cols-1">',
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-3">Colors</h2><div class="flex gap-2 mb-3"><input class="search-input flex-1" id="colorInput" placeholder="#ec4899 or Primary pink"><button class="filter-btn" id="addColor" type="button">Add</button></div><div class="grid gap-2">' + listItems(project.colors || [], "colors") + "</div></div>",
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-3">Fonts</h2><div class="flex gap-2 mb-3"><input class="search-input flex-1" id="fontInput" placeholder="Manrope, Inter, Fraunces"><button class="filter-btn" id="addFont" type="button">Add</button></div><div class="grid gap-2">' + listItems(project.fonts || [], "fonts") + "</div></div>",
      "</section>",
      '<section class="grid grid-cols-2 gap-4 max-[820px]:grid-cols-1">',
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-3">Assets and Links</h2><div class="grid gap-2 mb-3">' + field("Label", "assetLabel", "", "Logo concept") + field("URL", "assetUrl", "", "https://...") + '<button class="filter-btn" id="addAsset" type="button">Add Asset</button></div><div class="grid gap-2">' + listItems(project.assets || [], "assets") + "</div></div>",
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-3">Exports</h2><div class="grid gap-2 mb-3">' + field("Label", "exportLabel", "", "Brand guide HTML") + field("URL or note", "exportUrl", "", "Downloaded locally") + '<button class="filter-btn" id="addExport" type="button">Add Export</button></div><div class="grid gap-2">' + listItems(project.exports || [], "exports") + "</div></div>",
      "</section>",
      '<section class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-3">Workflow Progress</h2><div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">' + workflowProgress(project) + "</div></section>"
    ].join("");
  }

  function bind(state) {
    document.getElementById("projectList").onclick = function (event) {
      var btn = event.target.closest("[data-project]");
      if (!btn) return;
      state.activeId = btn.getAttribute("data-project");
      writeState(state);
      render(state);
    };

    document.getElementById("newProject").onclick = function () {
      var project = emptyProject("Project " + (state.projects.length + 1));
      state.projects.unshift(project);
      state.activeId = project.id;
      writeState(state);
      render(state);
    };

    document.getElementById("exportAll").onclick = function () {
      download("fds-projects.json", JSON.stringify(state, null, 2));
    };

    document.getElementById("importFile").onchange = function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var imported = JSON.parse(String(reader.result || "{}"));
          if (!Array.isArray(imported.projects)) throw new Error("Missing projects array");
          imported.version = 1;
          imported.activeId = imported.activeId || (imported.projects[0] && imported.projects[0].id) || "";
          writeState(imported);
          state = imported;
          render(state);
        } catch (err) {
          alert("Import failed: " + err.message);
        }
      };
      reader.readAsText(file);
    };
  }

  function bindEditor(state) {
    var project = activeProject(state);
    if (!project) return;

    var name = document.getElementById("projectName");
    name.addEventListener("input", function () {
      project.name = name.value.trim() || "Untitled Project";
      touch(project);
      writeState(state);
      renderList(state);
    });

    var notes = document.getElementById("projectNotes");
    notes.addEventListener("input", function () {
      project.notes = notes.value;
      touch(project);
      writeState(state);
      renderList(state);
    });

    document.getElementById("deleteProject").onclick = function () {
      if (!confirm("Delete this local project?")) return;
      state.projects = state.projects.filter(function (item) { return item.id !== project.id; });
      state.activeId = (state.projects[0] && state.projects[0].id) || "";
      writeState(state);
      render(state);
    };

    document.getElementById("createReview").onclick = function () {
      var items = reviewItems(project);
      localStorage.setItem(REVIEW_SEED_KEY, JSON.stringify({
        title: project.name + " review",
        source: "project:" + project.id,
        assets: items
      }));
      location.href = "/reviews/#new";
    };

    function addString(inputId, prop) {
      var input = document.getElementById(inputId);
      var value = input.value.trim();
      if (!value) return;
      project[prop] = project[prop] || [];
      project[prop].push(value);
      input.value = "";
      touch(project);
      writeState(state);
      render(state);
    }

    document.getElementById("addColor").onclick = function () { addString("colorInput", "colors"); };
    document.getElementById("addFont").onclick = function () { addString("fontInput", "fonts"); };

    document.getElementById("addAsset").onclick = function () {
      var label = document.getElementById("assetLabel").value.trim();
      var url = document.getElementById("assetUrl").value.trim();
      if (!label && !url) return;
      project.assets = project.assets || [];
      project.assets.push({ label: label || url, url: url, type: "link", createdAt: now() });
      touch(project);
      writeState(state);
      render(state);
    };

    document.getElementById("addExport").onclick = function () {
      var label = document.getElementById("exportLabel").value.trim();
      var url = document.getElementById("exportUrl").value.trim();
      if (!label && !url) return;
      project.exports = project.exports || [];
      project.exports.push({ label: label || "Export", url: url, type: "manual", createdAt: now() });
      touch(project);
      writeState(state);
      render(state);
    };

    document.getElementById("projectEditor").onclick = function (event) {
      var btn = event.target.closest("[data-remove]");
      if (!btn) return;
      var prop = btn.getAttribute("data-remove");
      var index = Number(btn.getAttribute("data-index"));
      if (!Array.isArray(project[prop])) return;
      project[prop].splice(index, 1);
      touch(project);
      writeState(state);
      render(state);
    };
  }

  function render(existingState) {
    var state = existingState || readState();
    renderList(state);
    renderEditor(state);
    bind(state);
    bindEditor(state);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { render(); });
  else render();
})();
