(function () {
  var WORKFLOWS = {
    "launch-brand": {
      title: "Launch a Brand",
      issue: "Brand foundation",
      intro: "Move from a rough idea to a practical starter brand kit: logo directions, color roles, typography, favicon, usage notes, and export files.",
      inputs: ["Brand name", "Industry or category", "Audience", "Mood words", "Primary use cases"],
      steps: [
        {
          phase: "Shape the direction",
          detail: "Write the brand name, audience, and 3-5 mood words before generating visuals.",
          tools: [
            ["Smart Logo Concepts", "/brand/ai-logo-concepts/"],
            ["Smart Color from Description", "/brand/ai-color-from-text/"]
          ]
        },
        {
          phase: "Lock visual basics",
          detail: "Choose one logo direction, one palette, and a heading/body type pairing.",
          tools: [
            ["Logo Maker", "/brand/logo-maker/"],
            ["Color Palette Generator", "/brand/color-palette/"],
            ["Typography Pairing", "/brand/typography-pairing/"]
          ]
        },
        {
          phase: "Package the kit",
          detail: "Create the client-ready brand guide and small identity assets.",
          tools: [
            ["Brand Kit Builder", "/brand/brand-kit/"],
            ["Favicon Generator", "/brand/favicon-generator/"],
            ["Business Card Designer", "/brand/business-card/"]
          ]
        }
      ],
      exports: ["Logo SVG", "Color palette", "Type pairing CSS", "Favicon package", "Brand guide HTML"],
      checks: ["Contrast passes for key text/background pairs", "Logo works at small size", "Palette has neutral/support colors", "Files use clear names"]
    },
    "landing-page": {
      title: "Build a Landing Page",
      issue: "Launch page",
      intro: "Turn a clear offer into a responsive page structure with supporting visuals, forms, preview metadata, and SEO basics.",
      inputs: ["Offer", "Audience", "Primary call to action", "Sections needed", "Brand assets"],
      steps: [
        {
          phase: "Plan the page",
          detail: "Define the promise, proof, objections, and conversion path before opening a builder.",
          tools: [
            ["Sitemap Generator", "/components/sitemap-builder/"],
            ["Moodboard Builder", "/components/moodboard/"]
          ]
        },
        {
          phase: "Build the page",
          detail: "Assemble sections, forms, and visual hierarchy using the brand kit as constraints.",
          tools: [
            ["Landing Page Builder", "/components/landing-builder/"],
            ["Form Builder", "/components/form-builder/"],
            ["Gradient & Background Maker", "/images/gradient-maker/"]
          ]
        },
        {
          phase: "Prepare launch assets",
          detail: "Create preview images, favicon assets, and a basic sitemap for publishing.",
          tools: [
            ["OG Image Maker", "/templates/og-image-maker/"],
            ["Favicon Generator", "/brand/favicon-generator/"],
            ["Format Converter", "/images/format-converter/"]
          ]
        }
      ],
      exports: ["Landing page HTML", "OG image", "Favicon tags", "Sitemap XML", "Compressed images"],
      checks: ["Hero message is clear", "CTA repeats logically", "Forms have labels", "Mobile layout has no horizontal overflow"]
    },
    "social-campaign": {
      title: "Prepare a Social Campaign",
      issue: "Channel-ready assets",
      intro: "Create a small, consistent campaign pack for social channels with correct sizes, reusable backgrounds, and export variants.",
      inputs: ["Campaign message", "Channels", "Brand colors", "Image or product assets", "Post variants"],
      steps: [
        {
          phase: "Set campaign system",
          detail: "Choose the campaign message, color treatment, and reusable background style.",
          tools: [
            ["Brand Kit Builder", "/brand/brand-kit/"],
            ["Gradient & Background Maker", "/images/gradient-maker/"],
            ["Pattern Generator", "/images/pattern-maker/"]
          ]
        },
        {
          phase: "Create channel assets",
          detail: "Build each post size from a template, then crop and resize supporting imagery.",
          tools: [
            ["Social Media Templates", "/templates/social-templates/"],
            ["Image Resizer & Cropper", "/images/image-resizer/"],
            ["Photo Editor", "/images/photo-editor/"]
          ]
        },
        {
          phase: "Export variants",
          detail: "Convert files into the right web formats and make a preview image for links.",
          tools: [
            ["Format Converter", "/images/format-converter/"],
            ["OG Image Maker", "/templates/og-image-maker/"],
            ["Personal Asset Manager", "/images/asset-manager/"]
          ]
        }
      ],
      exports: ["Platform PNGs", "Compressed JPEG/WebP", "OG image", "Campaign asset folder", "Source notes"],
      checks: ["Text fits all sizes", "Brand treatment is consistent", "File names include channel and size", "Exports are compressed"]
    },
    "ui-kit": {
      title: "Create a UI Kit",
      issue: "Reusable interface system",
      intro: "Turn visual decisions into tokens, components, forms, layout patterns, and developer-ready handoff notes.",
      inputs: ["Brand palette", "Typography", "Product type", "Core screens", "Developer target"],
      steps: [
        {
          phase: "Define tokens",
          detail: "Set color roles, type scale, spacing, radius, and export format early.",
          tools: [
            ["Design Token Generator", "/brand/design-tokens/"],
            ["Tailwind Theme Builder", "/brand/tailwind-theme/"],
            ["Contrast Checker", "/brand/contrast-checker/"]
          ]
        },
        {
          phase: "Assemble patterns",
          detail: "Collect the component and form patterns that the product actually needs.",
          tools: [
            ["UI Component Library", "/components/ui-kit/"],
            ["Form Builder", "/components/form-builder/"],
            ["CSS Layout Builder", "/components/layout-builder/"]
          ]
        },
        {
          phase: "Document handoff",
          detail: "Export specs, measurements, and implementation notes for developers.",
          tools: [
            ["Design Handoff Sheet", "/components/design-handoff/"],
            ["User Flow Builder", "/components/user-flow/"],
            ["SVG Icon Library", "/images/icon-library/"]
          ]
        }
      ],
      exports: ["Design tokens", "Component snippets", "Form patterns", "Layout CSS", "Handoff HTML"],
      checks: ["Tokens cover semantic roles", "Components include states", "Forms have labels/errors", "Handoff includes measurements"]
    },
    "pitch-deck": {
      title: "Make a Pitch Deck",
      issue: "Investor or sales deck",
      intro: "Move from a story outline to presentation-ready slides with mockups, supporting imagery, and exportable presentation files.",
      inputs: ["Audience", "Deck goal", "Problem and proof", "Product screenshots", "Ask or next step"],
      steps: [
        {
          phase: "Outline the story",
          detail: "Clarify the audience, narrative arc, and proof points before generating slides.",
          tools: [
            ["Pitch Deck Generator", "/templates/pitch-deck/"],
            ["Slide Deck Builder", "/templates/presentation-maker/"]
          ]
        },
        {
          phase: "Create supporting visuals",
          detail: "Prepare product screenshots, device mockups, icons, and background treatments.",
          tools: [
            ["Device Mockup Generator", "/templates/mockup-generator/"],
            ["SVG Icon Library", "/images/icon-library/"],
            ["Image Resizer & Cropper", "/images/image-resizer/"]
          ]
        },
        {
          phase: "Polish and present",
          detail: "Check slide hierarchy, export a self-contained deck, and prepare backup image assets.",
          tools: [
            ["Presentation Maker", "/templates/presentation-maker/"],
            ["Format Converter", "/images/format-converter/"],
            ["Brand Kit Builder", "/brand/brand-kit/"]
          ]
        }
      ],
      exports: ["Deck HTML", "Device mockups", "Slide images", "Brand assets", "Presenter-ready file"],
      checks: ["Every slide has one main point", "Numbers and claims are sourced", "Screenshots are readable", "CTA or ask is explicit"]
    },
    "asset-export": {
      title: "Clean and Export Assets",
      issue: "Production-ready files",
      intro: "Take raw files or downloaded assets and prepare clean, compressed, well-named exports for use in sites, decks, and campaigns.",
      inputs: ["Source files", "Target dimensions", "Target formats", "Naming convention", "Usage context"],
      steps: [
        {
          phase: "Collect source material",
          detail: "Gather hosted, uploaded, or generated assets into one working set.",
          tools: [
            ["Design Asset Library", "/images/stock-photos/"],
            ["Personal Asset Manager", "/images/asset-manager/"],
            ["AI Icon Set Generator", "/images/ai-icon-sets/"]
          ]
        },
        {
          phase: "Clean files",
          detail: "Remove backgrounds, optimize SVGs, crop images, and fix obvious visual problems.",
          tools: [
            ["Background Remover", "/images/ai-background-remover/"],
            ["SVG Optimizer & Editor", "/images/svg-optimizer/"],
            ["Photo Editor", "/images/photo-editor/"]
          ]
        },
        {
          phase: "Export and name",
          detail: "Resize, convert, and organize final files by use case.",
          tools: [
            ["Image Resizer & Cropper", "/images/image-resizer/"],
            ["Format Converter", "/images/format-converter/"],
            ["Vector Editor", "/images/vector-editor/"]
          ]
        }
      ],
      exports: ["Optimized SVG", "Compressed PNG/JPEG/WebP", "Transparent PNG", "Source metadata", "Named asset folder"],
      checks: ["Dimensions match destination", "SVGs are cleaned", "Images are compressed", "Metadata and license notes are kept"]
    }
  };

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function getSlug() {
    var parts = location.pathname.split("/").filter(Boolean);
    return parts[1] || "launch-brand";
  }

  function key(slug) {
    return "fds.workflow." + slug + ".checked";
  }

  function readChecked(slug) {
    try {
      return JSON.parse(localStorage.getItem(key(slug)) || "[]");
    } catch (err) {
      return [];
    }
  }

  function writeChecked(slug, values) {
    localStorage.setItem(key(slug), JSON.stringify(values));
  }

  function toolLinks(tools) {
    return tools.map(function (tool) {
      return '<a class="stock-link" href="' + esc(tool[1]) + '">' + esc(tool[0]) + " -></a>";
    }).join("");
  }

  function checklist(items, slug, prefix, checked) {
    return items.map(function (item, index) {
      var id = prefix + "-" + index;
      var isChecked = checked.indexOf(id) !== -1 ? " checked" : "";
      return '<label class="flex gap-2 items-start text-[.8rem] text-muted leading-normal"><input class="mt-[3px] accent-pink-500" type="checkbox" data-check-id="' + esc(id) + '"' + isChecked + '><span>' + esc(item) + "</span></label>";
    }).join("");
  }

  function copyPlan(workflow) {
    var lines = [
      workflow.title,
      "",
      "Inputs:",
      workflow.inputs.map(function (item) { return "- " + item; }).join("\n"),
      "",
      "Steps:",
      workflow.steps.map(function (step, index) {
        return (index + 1) + ". " + step.phase + " - " + step.detail;
      }).join("\n"),
      "",
      "Exports:",
      workflow.exports.map(function (item) { return "- " + item; }).join("\n")
    ];
    return lines.join("\n");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    var ok = document.execCommand("copy");
    textarea.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error("Copy failed"));
  }

  function render() {
    var root = document.getElementById("workflowRoot");
    if (!root) return;
    var slug = getSlug();
    var workflow = WORKFLOWS[slug] || WORKFLOWS["launch-brand"];
    var checked = readChecked(slug);
    document.title = workflow.title + " Workflow - FreeDesignStore";

    root.innerHTML = [
      '<section class="mb-5">',
      '<a class="stock-link" href="/workflows/"><- All Workflows</a>',
      '<p class="text-[.72rem] font-extrabold uppercase text-accent mt-4 mb-1">' + esc(workflow.issue) + "</p>",
      '<h1 class="font-display text-[2.35rem] leading-[1.05] font-bold mb-2 max-[520px]:text-3xl">' + esc(workflow.title) + "</h1>",
      '<p class="text-muted text-[.9rem] leading-relaxed max-w-[720px]">' + esc(workflow.intro) + "</p>",
      '<div class="flex flex-wrap gap-2 mt-4"><button class="hero-btn" id="copyWorkflowPlan" type="button">Copy Plan</button><a class="hero-btn secondary" href="/tools/">Browse All Tools</a></div>',
      "</section>",
      '<section class="grid grid-cols-[.78fr_1.22fr] gap-4 max-[820px]:grid-cols-1">',
      '<aside class="grid gap-4 content-start">',
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-2">Inputs</h2><div class="grid gap-2">' + checklist(workflow.inputs, slug, "input", checked) + "</div></div>",
      '<div class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-2">Ready Checks</h2><div class="grid gap-2">' + checklist(workflow.checks, slug, "check", checked) + "</div></div>",
      "</aside>",
      '<div class="grid gap-4">',
      workflow.steps.map(function (step, index) {
        return '<article class="card flex-col gap-3"><div class="flex items-start gap-3"><div class="card-icon" style="background:#ec4899">' + String(index + 1).padStart(2, "0") + '</div><div><h2 class="card-name text-[1rem]">' + esc(step.phase) + '</h2><p class="card-desc line-clamp-none">' + esc(step.detail) + '</p></div></div><div class="flex flex-wrap gap-1.5">' + toolLinks(step.tools) + "</div></article>";
      }).join(""),
      '<section class="bg-panel border border-hairline rounded-2xl p-4"><h2 class="font-display text-[1.1rem] font-bold mb-2">Final Exports</h2><div class="flex flex-wrap gap-1.5">' + workflow.exports.map(function (item) { return '<span class="badge">' + esc(item) + "</span>"; }).join("") + "</div></section>",
      "</div>",
      "</section>"
    ].join("");

    root.querySelectorAll("[data-check-id]").forEach(function (input) {
      input.addEventListener("change", function () {
        var current = readChecked(slug);
        var id = input.getAttribute("data-check-id");
        var next = input.checked ? current.concat(id) : current.filter(function (value) { return value !== id; });
        writeChecked(slug, Array.from(new Set(next)));
      });
    });

    var copy = document.getElementById("copyWorkflowPlan");
    copy.addEventListener("click", function () {
      copyText(copyPlan(workflow)).then(function () {
        copy.textContent = "Copied";
        setTimeout(function () { copy.textContent = "Copy Plan"; }, 1400);
      }).catch(function () {
        copy.textContent = "Copy Failed";
        setTimeout(function () { copy.textContent = "Copy Plan"; }, 1400);
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
