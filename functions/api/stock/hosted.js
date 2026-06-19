export const HOSTED_STOCK = [
  item("fds-workspace-studio", "Workspace Studio", "Workspace", "workspace-studio.jpg", 1400, 935, ["office", "startup", "interior"], ["profile_background"]),
  item("fds-product-tech", "Product Review", "Technology", "product-tech.jpg", 1400, 933, ["laptop", "product", "screen"], []),
  item("fds-desert-road", "Desert Road", "Travel", "desert-road.jpg", 1400, 2100, ["road", "landscape", "journey"], ["profile_background"]),
  item("fds-mountain-layers", "Mountain Layers", "Nature", "mountain-layers.jpg", 1400, 2100, ["mountains", "sunrise", "background"], ["profile_background"]),
  item("fds-desk-laptop", "Desk Laptop", "Business", "desk-laptop.jpg", 1400, 933, ["desk", "work", "computer"], []),
  item("fds-team-workshop", "Team Workshop", "People", "team-workshop.jpg", 1400, 933, ["team", "meeting", "collaboration"], []),
  item("fds-designer-desk-flatlay", "Designer Desk Flatlay", "Workspace", "designer-desk-flatlay.jpg", 1536, 1024, ["design", "color", "workspace"], []),
  item("fds-packaging-mockup", "Packaging Mockup", "Mockups", "packaging-mockup.jpg", 1536, 1024, ["packaging", "mockup", "branding"], []),
  item("fds-social-planning-workspace", "Social Planning Workspace", "Marketing", "social-planning-workspace.jpg", 1536, 1024, ["social", "content", "planning"], []),
  item("fds-interior-light-shadows", "Interior Light Shadows", "Backgrounds", "interior-light-shadows.jpg", 1536, 1024, ["interior", "light", "background"], ["profile_background"]),
  item("fds-material-swatch-moodboard", "Material Swatch Moodboard", "Textures", "material-swatch-moodboard.jpg", 1536, 1024, ["texture", "materials", "moodboard"], []),
  item("fds-ux-wireframe-desk", "UX Wireframe Desk", "UI", "ux-wireframe-desk.jpg", 1536, 1024, ["ux", "wireframe", "interface"], []),
  item("fds-lifestyle-hiking-trail", "Lifestyle Hiking Trail", "Lifestyle", "lifestyle-hiking-trail.jpg", 1672, 941, ["hiking", "nature", "background"], ["profile_background"]),
  item("fds-lifestyle-coffee-cup", "Lifestyle Coffee Cup", "Lifestyle", "lifestyle-coffee-cup.jpg", 1672, 941, ["coffee", "cafe", "background"], ["profile_background"]),
  item("fds-lifestyle-park-bench", "Lifestyle Park Bench", "Lifestyle", "lifestyle-park-bench.jpg", 1672, 941, ["park", "bench", "green"], ["profile_background"]),
  item("fds-lifestyle-concert-stage", "Lifestyle Concert Stage", "Lifestyle", "lifestyle-concert-stage.jpg", 1672, 941, ["concert", "stage", "crowd"], []),
  item("fds-lifestyle-australia-surf-beach", "Australia Surf Beach", "Lifestyle", "lifestyle-australia-surf-beach.jpg", 1672, 941, ["australia", "surf", "beach", "coast"], ["profile_background"]),
  item("fds-lifestyle-australia-cafe-table", "Australia Cafe Table", "Lifestyle", "lifestyle-australia-cafe-table.jpg", 1672, 941, ["australia", "coffee", "cafe", "table"], ["profile_background"]),
  item("fds-lifestyle-australia-bicycle-trail", "Australia Bicycle Trail", "Lifestyle", "lifestyle-australia-bicycle-trail.jpg", 1672, 941, ["australia", "cycling", "bicycle", "trail"], ["profile_background"]),
  item("fds-lifestyle-australia-rock-climbing", "Australia Rock Climbing", "Lifestyle", "lifestyle-australia-rock-climbing.jpg", 1672, 941, ["australia", "climbing", "sandstone", "outdoors"], ["profile_background"]),
  item("fds-lifestyle-australia-beach-picnic", "Australia Beach Picnic", "Lifestyle", "lifestyle-australia-beach-picnic.jpg", 1672, 941, ["australia", "beach", "picnic", "barbecue"], ["profile_background"]),
  item("fds-lifestyle-australia-coastal-walk", "Australia Coastal Walk", "Lifestyle", "lifestyle-australia-coastal-walk.jpg", 1671, 941, ["australia", "coast", "walking", "boardwalk"], ["profile_background"]),
  item("fds-lifestyle-australia-farmers-market", "Australia Farmers Market", "Lifestyle", "lifestyle-australia-farmers-market.jpg", 1672, 941, ["australia", "market", "produce", "community"], ["profile_background"]),
  item("fds-lifestyle-australia-bush-camping", "Australia Bush Camping", "Lifestyle", "lifestyle-australia-bush-camping.jpg", 1670, 941, ["australia", "camping", "bush", "river"], ["profile_background"]),
  item("fds-lifestyle-australia-park-yoga", "Australia Park Yoga", "Lifestyle", "lifestyle-australia-park-yoga.jpg", 1672, 941, ["australia", "yoga", "park", "wellness"], ["profile_background"]),
  item("fds-lifestyle-australia-ferry-commute", "Australia Ferry Commute", "Lifestyle", "lifestyle-australia-ferry-commute.jpg", 1672, 941, ["australia", "ferry", "commute", "harbour"], ["profile_background"]),
  item("fds-lifestyle-australia-park-cricket", "Australia Park Cricket", "Lifestyle", "lifestyle-australia-park-cricket.jpg", 1672, 941, ["australia", "cricket", "park", "sport"], ["profile_background"]),
  item("fds-lifestyle-australia-reef-snorkelling", "Australia Reef Snorkelling", "Lifestyle", "lifestyle-australia-reef-snorkelling.jpg", 1672, 941, ["australia", "reef", "snorkelling", "water"], ["profile_background"]),
];

function item(id, title, category, filename, width, height, tags, purposes) {
  return {
    id,
    source: "hosted",
    assetType: "photo",
    title,
    category,
    author: "FreeDesignStore",
    attribution: "FreeDesignStore",
    license: "FreeDesignStore Community License",
    licenseUrl: "https://freedesignstore.online/images/stock-photos/",
    contentType: "image/jpeg",
    width,
    height,
    orientation: height > width ? "portrait" : width > height ? "landscape" : "square",
    safe: true,
    purpose: purposes,
    tags,
    path: `/assets/stock/${filename}`,
    filename,
  };
}

export function hostedStockItem(item, origin = "") {
  const url = absoluteUrl(origin, item.path);
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    category: item.category,
    assetType: item.assetType,
    author: item.author,
    attribution: item.attribution,
    license: item.license,
    licenseUrl: item.licenseUrl,
    tags: item.tags,
    url,
    download: url,
    filename: item.filename,
    contentType: item.contentType,
    width: item.width,
    height: item.height,
    orientation: item.orientation,
    safe: item.safe,
    purpose: item.purpose,
  };
}

export function absoluteUrl(origin, path) {
  if (!origin) return path;
  return new URL(path, origin).toString();
}

export function filterHostedStock(items, filters = {}) {
  const assetType = normalize(filters.assetType);
  const category = normalize(filters.category);
  const orientation = normalize(filters.orientation);
  const purpose = normalize(filters.purpose);
  const query = normalize(filters.q);
  const safeOnly = filters.safe === true;

  return items
    .filter((item) => !assetType || normalize(item.assetType) === assetType)
    .filter((item) => !category || normalize(item.category) === category)
    .filter((item) => !orientation || item.orientation === orientation)
    .filter((item) => !purpose || (item.purpose || []).some((value) => normalize(value) === purpose))
    .filter((item) => !safeOnly || item.safe !== false)
    .filter((item) => {
      if (!query) return true;
      return [
        item.title,
        item.author,
        item.category,
        item.license,
        item.assetType,
        item.orientation,
        ...(item.tags || []),
        ...(item.purpose || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
}

export function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
