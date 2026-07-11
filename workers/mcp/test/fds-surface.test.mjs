import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

async function readRepo(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

async function importRepoModule(path) {
  const source = await readRepo(path);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

async function importRepoFile(path) {
  return import(pathToFileURL(resolve(repoRoot, path)).href);
}

test('public MCP discovery advertises the dedicated FDS MCP endpoint', async () => {
  const discovery = JSON.parse(await readRepo('store/.well-known/mcp.json'));
  assert.equal(discovery.servers[0].endpoint, 'https://mcp.freedesignstore.online/mcp');
  assert.equal(discovery.servers[0].transport, 'streamable-http');
  assert.equal(discovery.servers[0].tools.length, 18);
  for (const tool of ['list_design_skills', 'get_design_skill', 'apply_design_skill', 'publish_asset', 'unpublish_asset', 'delete_asset']) {
    assert.ok(discovery.servers[0].tools.some((item) => item.name === tool), `missing ${tool}`);
  }
  assert.doesNotMatch(JSON.stringify(discovery), /freeappstore|fds-mcp/i);
});

test('worker config has no FAS public route or FAS auth start', async () => {
  const wrangler = await readRepo('workers/mcp/wrangler.toml');
  assert.match(wrangler, /PUBLIC_MCP_BASE_URL = "https:\/\/mcp\.freedesignstore\.online"/);
  assert.match(wrangler, /pattern = "mcp\.freedesignstore\.online\/\*"/);
  assert.match(wrangler, /zone_name = "freedesignstore\.online"/);
  assert.doesNotMatch(wrangler, /freeappstore\.online|api\.freeappstore|AUTH_START\s*=/);
});

test('worker supports FDS OAuth without FAS auth routing', async () => {
  const source = await readRepo('workers/mcp/src/index.ts');
  const oauth = await readRepo('workers/mcp/src/oauth-provider.ts');
  const session = await readRepo('workers/mcp/src/session.ts');
  assert.match(source, /https:\/\/mcp\.freedesignstore\.online\/mcp/);
  assert.match(source, /Browser sign-in: https:\/\/mcp\.freedesignstore\.online\/\.fds\/auth\/start/);
  assert.match(source, /Auth: FDS OAuth 2\.1 browser sign-in/);
  assert.match(source, /GOOGLE_OAUTH_ENABLED === 'true'/);
  assert.match(source, /canPublish/);
  assert.match(source, /Requires an authenticated creator or admin account/);
  assert.match(oauth, /const roles = \['creator', 'publisher'\]/);
  assert.match(oauth, /authorization_endpoint: `\$\{config\.issuer\}\/authorize`/);
  assert.match(oauth, /token_endpoint: `\$\{config\.issuer\}\/token`/);
  assert.match(oauth, /Continue with \$\{providerLabel\(provider\)\}/);
  assert.match(oauth, /github\/callback/);
  assert.match(oauth, /google\/callback/);
  assert.match(oauth, /avatarUrl/);
  assert.doesNotMatch(oauth, /Provider OAuth is not configured yet, so this deployment is using/);
  assert.match(session, /FDS session token signing and verification/);
  assert.doesNotMatch(`${source}\n${oauth}\n${session}`, /freeappstore|api\.freeappstore|fds-mcp\.freeappstore|AUTH_START|fas_session|fasSession|FAS-compatible/i);
});

test('Pages proxy maps any public MCP surface path to the backend worker', async () => {
  const { proxyMcpRequest } = await importRepoModule('functions/_mcpProxy.js');
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (request) => {
    seen.push(request);
    return new Response('ok', { status: 202 });
  };
  try {
    const response = await proxyMcpRequest({
      request: new Request('https://freedesignstore.online/.well-known/oauth-protected-resource/mcp?x=1', {
        headers: { authorization: 'Bearer sample' },
      }),
      env: {},
    });

    assert.equal(response.status, 202);
    assert.equal(seen.length, 1);
    const proxied = seen[0];
    assert.equal(proxied.url, 'https://freedesignstore-mcp.serge-the-dev.workers.dev/.well-known/oauth-protected-resource/mcp?x=1');
    assert.equal(proxied.headers.get('authorization'), 'Bearer sample');
    assert.equal(proxied.headers.get('x-fds-forwarded-host'), 'freedesignstore.online');
    assert.equal(proxied.headers.get('x-fds-forwarded-proto'), 'https');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('docs mention the complete FDS public MCP surface', async () => {
  const docs = await readRepo('MCP-CATALOG.md');
  for (const route of ['/mcp', '/register', '/authorize', '/token', '/.well-known/oauth-*', '/.fds/auth/*']) {
    assert.match(docs, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const tool of ['list_design_skills', 'get_design_skill', 'apply_design_skill', 'my_assets', 'get_asset', 'publish_asset', 'unpublish_asset', 'delete_asset']) {
    assert.match(docs, new RegExp(tool));
  }
});

test('creator console exposes the FDS MCP catalog workflow', async () => {
  const consoleHtml = await readRepo('store/console/index.html');
  const homeHtml = await readRepo('store/index.html');

  assert.match(homeHtml, /href="\/console\/"/);
  assert.match(consoleHtml, /Creator Console - FreeDesignStore/);
  assert.match(consoleHtml, /const MCP_ENDPOINT='\/mcp'/);
  assert.match(consoleHtml, /\/\.fds\/auth\/start\?return_to=\/console\//);
  assert.match(consoleHtml, /credentials:'include'/);
  assert.match(consoleHtml, /id="profilePanel"/);
  assert.match(consoleHtml, /id="profileSignOutBtn"/);
  assert.match(consoleHtml, /id="avatar"/);
  assert.match(consoleHtml, /id="topSignInBtn"/);
  assert.match(consoleHtml, /id="topSignOutBtn"/);
  assert.match(consoleHtml, /avatarUrl/);
  assert.match(consoleHtml, /hasImage/);
  assert.match(consoleHtml, /function initials/);
  assert.match(consoleHtml, /Publishing enabled/);
  assert.match(consoleHtml, /tools\/call/);
  assert.match(consoleHtml, /create_svg_asset/);
  assert.match(consoleHtml, /my_assets/);
  assert.match(consoleHtml, /publish_asset/);
  assert.match(consoleHtml, /unpublish_asset/);
  assert.match(consoleHtml, /delete_asset/);
  assert.match(consoleHtml, /class="assetPreview"/);
  assert.match(consoleHtml, /<img src="\$\{escapeAttr\(a\.url\)\}"/);
  assert.match(consoleHtml, /data-publish/);
  assert.match(consoleHtml, /data-unpublish/);
  assert.match(consoleHtml, /data-delete/);
  assert.doesNotMatch(consoleHtml, /bearer token|sessionStorage|localStorage|freeappstore\.online|api\.freeappstore|fds-mcp\.freeappstore/i);
});

test('home and public library make assets a first-class FDS surface', async () => {
  const homeHtml = await readRepo('store/index.html');
  const libraryHtml = await readRepo('store/images/stock-photos/index.html');

  assert.match(homeHtml, /Free Design Assets and Tools/);
  assert.match(homeHtml, /href="\/images\/stock-photos\/">Assets/);
  assert.match(homeHtml, /id="assetRail"/);
  assert.match(homeHtml, /fetch\('\/api\/stock\/list\?source=all'/);
  assert.doesNotMatch(homeHtml, /const hostedAssets=/);
  assert.match(homeHtml, /Community-published FDS assets appear here first/);
  assert.match(homeHtml, /id="tools"/);
  assert.match(homeHtml, /Design Asset Library/);
  assert.match(libraryHtml, /Free Design Asset Library/);
  assert.match(libraryHtml, /const ASSET_TYPES=/);
  assert.match(libraryHtml, /id="assetModal"/);
  assert.match(libraryHtml, /function openAssetModal/);
  assert.match(libraryHtml, /data-photo-id/);
  assert.doesNotMatch(libraryHtml, /\}role=/);
  assert.match(libraryHtml, /bindAssetCards/);
  assert.match(libraryHtml, /aria-modal="true"/);
  for (const type of ['Images / Photos', 'Illustrations', 'Icons', 'Patterns', 'Textures', 'Backgrounds', 'UI Assets']) {
    assert.match(libraryHtml, new RegExp(type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(libraryHtml, /Lifestyle/);
  assert.match(libraryHtml, /fetch\('\/api\/stock\/list\?source=all'\)/);
  assert.match(libraryHtml, /\[\.\.\.catalogPhotos,\.\.\.apiResults\]/);
  assert.doesNotMatch(libraryHtml, /HOSTED_PHOTOS/);
});

function catalogItem(overrides) {
  return {
    id: 'x', title: 'Untitled', category: 'Lifestyle', assetType: 'photo',
    author: 'FreeDesignStore', license: 'FreeDesignStore Free Release', licenseId: 'fds-free',
    origin: 'ai-generated', originDetail: { tool: 'Pollinations', model: 'flux/sana' },
    tags: [], status: 'public', objectKey: 'hosted/x.jpg', filename: 'x.jpg',
    contentType: 'image/jpeg', size: 1000, width: 1672, height: 941,
    purpose: ['profile_background'], safe: true, source: 'hosted',
    ownerAccountId: 'fds-official', ownerName: 'FreeDesignStore', ownerHandle: 'freedesignstore',
    createdAt: '2026-07-10T00:00:00Z',
    ...overrides,
  };
}

async function seedUnifiedCatalog(kv) {
  const items = [
    catalogItem({ id: 'h-ai', title: 'Sunrise Yoga', filename: 'sunrise-yoga.jpg', objectKey: 'hosted/sunrise-yoga.jpg' }),
    catalogItem({ id: 'h-cc0', title: 'Mountain Lake', category: 'Nature', origin: 'photograph', originDetail: undefined, license: 'CC0 1.0 Public Domain', licenseId: 'cc0', author: 'Fabrizio Lunardi' }),
    catalogItem({ id: 'h-nasa', title: 'Earth From Orbit', category: 'Backgrounds', origin: 'photograph', originDetail: undefined, license: 'Public Domain (NASA)', licenseId: 'cc0', author: 'NASA' }),
    catalogItem({ id: 'c-1', title: 'Community Shot', category: 'Community', source: 'community', ownerAccountId: 'github:42', ownerName: 'Alice', ownerHandle: 'alice', author: 'Alice', origin: 'photograph', originDetail: undefined, licenseId: 'cc0', objectKey: 'community/c-1/shot.jpg' }),
  ];
  for (const item of items) await kv.put(`stock:item:${item.id}`, JSON.stringify(item));
  await kv.put('stock:index:public', JSON.stringify(items.map((i) => i.id)));
  return items;
}

test('public stock list API serves the unified KV catalog with filters', async () => {
  const listSource = await readRepo('functions/api/stock/list.js');
  const taxonomySource = await readRepo('functions/api/stock/_taxonomy.js');
  const { onRequestGet, onRequestHead, onRequestOptions } = await importRepoFile('functions/api/stock/list.js');

  assert.match(taxonomySource, /export const ASSET_TYPES = new Set/);
  assert.match(taxonomySource, /export function isAssetType/);
  assert.match(listSource, /asset_type/);
  assert.match(listSource, /Unsupported asset_type/);
  assert.match(listSource, /url\.searchParams\.get\("q"\)/);
  assert.doesNotMatch(listSource, /HOSTED_STOCK/);

  const kv = memoryKV();
  await seedUnifiedCatalog(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };

  const hosted = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=hosted'),
    env,
  });
  assert.equal(hosted.status, 200);
  const hostedBody = await hosted.json();
  assert.equal(hostedBody.items.length, 3);
  assert.ok(hostedBody.items.every((item) => item.source === 'hosted'));
  assert.ok(hostedBody.items.every((item) => item.url.startsWith('https://freedesignstore.online/api/stock/image/')));

  const community = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=community'),
    env,
  });
  assert.equal((await community.json()).items.length, 1);

  const lifestyle = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?assetType=photo&category=lifestyle&source=hosted'),
    env,
  });
  assert.equal((await lifestyle.json()).items.length, 1);

  const badOrientation = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=hosted&orientation=diagonal'),
    env,
  });
  assert.equal(badOrientation.status, 400);
  assert.match((await badOrientation.json()).error, /Unsupported orientation/);

  const head = onRequestHead();
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('access-control-allow-origin'), '*');
  const options = onRequestOptions();
  assert.equal(options.status, 200);
  assert.match(options.headers.get('access-control-allow-methods'), /HEAD/);
});

test('random stock API keeps the HeartFull integration shape from the KV catalog', async () => {
  const { onRequestGet, onRequestHead, onRequestOptions } = await importRepoFile('functions/api/stock/random.js');
  const kv = memoryKV();
  await seedUnifiedCatalog(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };
  const response = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/random?assetType=photo&orientation=landscape&safe=true&purpose=profile_background&count=3'),
    env,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('cache-control'), /public/);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.source, 'hosted');
  assert.equal(body.count, 3);
  assert.equal(body.items.length, 3);
  for (const item of body.items) {
    assert.equal(item.source, 'hosted');
    assert.equal(item.assetType, 'photo');
    assert.equal(item.orientation, 'landscape');
    assert.equal(item.safe, true);
    assert.ok(item.purpose.includes('profile_background'));
    assert.ok(item.url.startsWith('https://freedesignstore.online/api/stock/image/'));
    assert.ok(item.width > item.height);
    assert.equal(item.contentType, 'image/jpeg');
  }

  const head = onRequestHead();
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('access-control-allow-origin'), '*');
  assert.match(head.headers.get('cache-control'), /public/);
  const options = onRequestOptions();
  assert.equal(options.status, 200);
  assert.match(options.headers.get('access-control-allow-methods'), /HEAD/);
});

test('legacy /assets/stock/ URLs are served from R2 for consumer compatibility', async () => {
  const { onRequestGet } = await importRepoFile('functions/assets/stock/[file].js');
  const bucket = memoryBucket();
  await bucket.put('hosted/sunrise-yoga.jpg', new Uint8Array([1, 2, 3]), {});
  bucket.get = async (key) =>
    bucket.objects.has(key)
      ? {
          body: bucket.objects.get(key).body,
          httpEtag: '"e"',
          writeHttpMetadata(headers) { headers.set('content-type', 'image/jpeg'); },
        }
      : null;
  const env = { FDS_STOCK_KV: memoryKV(), FDS_STOCK_BUCKET: bucket };

  const hit = await onRequestGet({
    params: { file: 'sunrise-yoga.jpg' },
    request: new Request('https://freedesignstore.online/assets/stock/sunrise-yoga.jpg'),
    env,
  });
  assert.equal(hit.status, 200);
  assert.equal(hit.headers.get('content-type'), 'image/jpeg');
  assert.match(hit.headers.get('cache-control'), /public/);

  const miss = await onRequestGet({
    params: { file: 'nope.jpg' },
    request: new Request('https://freedesignstore.online/assets/stock/nope.jpg'),
    env,
  });
  assert.equal(miss.status, 404);

  const traversal = await onRequestGet({
    params: { file: '../secrets.txt' },
    request: new Request('https://freedesignstore.online/assets/stock/..%2Fsecrets.txt'),
    env,
  });
  assert.equal(traversal.status, 404);
});

test('stock image route allows signed-in owners to preview private assets', async () => {
  const lib = await readRepo('functions/api/stock/_lib.js');
  const session = await readRepo('functions/api/_session.js');
  const imageRoute = await readRepo('functions/api/stock/image/[id].js');
  assert.match(lib, /authenticatedAccount/);
  assert.match(lib, /ownerAccountId === account\.accountId/);
  assert.match(session, /\/\.fds\/auth\/me/);
  assert.match(session, /SESSION_SIGNING_KEY/);
  assert.match(imageRoute, /canViewItem/);
  assert.doesNotMatch(imageRoute, /item\.status !== "public" && !isAdmin/);
});

test('published design skills mirror FIS/PAGS skill publishing pattern', async () => {
  const manifest = JSON.parse(await readRepo('store/skills/manifest.json'));
  const skillsPage = await readRepo('store/skills/index.html');
  const mcpSource = await readRepo('workers/mcp/src/index.ts');
  const homeHtml = await readRepo('store/index.html');
  const sitemap = await readRepo('store/sitemap.xml');

  assert.equal(manifest.mcp, 'https://mcp.freedesignstore.online/mcp');
  assert.ok(Array.isArray(manifest.skills));
  assert.equal(manifest.skills.length, 6);
  assert.match(homeHtml, /href="\/skills\/"/);
  assert.match(skillsPage, /list_design_skills/);
  assert.match(skillsPage, /apply_design_skill/);
  assert.match(sitemap, /https:\/\/freedesignstore\.online\/skills\//);

  const ids = new Set();
  for (const skill of manifest.skills) {
    assert.ok(skill.id, 'skill id required');
    assert.ok(skill.title, 'skill title required');
    assert.ok(skill.path?.startsWith('/skills/'), `bad skill path: ${skill.path}`);
    assert.ok(!ids.has(skill.id), `duplicate skill id: ${skill.id}`);
    ids.add(skill.id);

    const markdown = await readRepo(`store${skill.path}`);
    assert.match(markdown, new RegExp(`# ${skill.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(skillsPage, new RegExp(skill.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(mcpSource, new RegExp(`'${skill.id}'`));
    assert.match(sitemap, new RegExp(skill.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const tool of ['list_design_skills', 'get_design_skill', 'apply_design_skill']) {
    assert.match(mcpSource, new RegExp(`'${tool}'`));
  }
});

// --- Contributor identity (PR 1) ---

import { createHmac } from 'node:crypto';

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signTestSession(payload, key, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function memoryKV() {
  const data = new Map();
  return {
    data,
    async get(key, type) {
      const value = data.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      data.set(key, String(value));
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

function memoryBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, body, opts) {
      objects.set(key, { body, opts });
    },
    async get(key) {
      return objects.has(key) ? { body: objects.get(key).body } : null;
    },
  };
}

test('vendored session verify accepts worker-signed tokens and rejects bad ones', async () => {
  const { verifySession } = await importRepoFile('functions/api/_session.js');
  const key = 'test-signing-key';
  const token = signTestSession({ uid: 'github:42', name: 'Alice', login: 'alice', roles: ['creator', 'publisher'] }, key);

  const payload = await verifySession(token, key);
  assert.equal(payload.uid, 'github:42');
  assert.equal(payload.login, 'alice');

  assert.equal(await verifySession(token, 'wrong-key'), null);
  assert.equal(await verifySession(`${token}x`, key), null);
  const expired = signTestSession({ uid: 'github:42' }, key, -10);
  assert.equal(await verifySession(expired, key), null);
});

test('upload requires an authenticated session and records ownership', async () => {
  const { onRequestPost } = await importRepoFile('functions/api/stock/upload.js');
  const kv = memoryKV();
  const bucket = memoryBucket();
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: bucket, SESSION_SIGNING_KEY: 'test-signing-key' };

  const makeForm = () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(64).fill(255)], 'shot.jpg', { type: 'image/jpeg' }));
    form.append('title', 'Test Shot');
    form.append('assetType', 'photo');
    form.append('origin', 'photograph');
    form.append('license', 'attribution');
    form.append('rightsConsent', 'yes');
    form.append('releaseConsent', 'yes');
    return form;
  };

  const anon = await onRequestPost({
    request: new Request('https://freedesignstore.online/api/stock/upload', { method: 'POST', body: makeForm() }),
    env,
  });
  assert.equal(anon.status, 401);

  const token = signTestSession({ uid: 'github:42', name: 'Alice', login: 'alice', provider: 'github', roles: ['creator', 'publisher'] }, 'test-signing-key');
  const authed = await onRequestPost({
    request: new Request('https://freedesignstore.online/api/stock/upload', {
      method: 'POST',
      body: makeForm(),
      headers: { cookie: `__Host-fds_mcp_session=${encodeURIComponent(token)}` },
    }),
    env,
  });
  assert.equal(authed.status, 200);
  const result = await authed.json();
  assert.equal(result.ok, true);
  assert.equal(result.status, 'public');

  const item = JSON.parse(kv.data.get(`stock:item:${result.id}`));
  assert.equal(item.ownerAccountId, 'github:42');
  assert.equal(item.author, 'Alice');
  assert.equal(item.status, 'public');
  // All contributions are public-domain dedicated regardless of the form value.
  assert.equal(item.licenseId, 'cc0');

  const accountIndex = JSON.parse(kv.data.get('stock:index:account:github-42'));
  assert.deepEqual(accountIndex, [result.id]);
  const publicIndex = JSON.parse(kv.data.get('stock:index:public'));
  assert.ok(publicIndex.includes(result.id));

  const profile = JSON.parse(kv.data.get('profile:account:github-42'));
  assert.equal(profile.handle, 'alice');
  assert.equal(profile.displayName, 'Alice');
  const handleRef = JSON.parse(kv.data.get('profile:handle:alice'));
  assert.equal(handleRef.accountId, 'github-42');
});

// --- Taxonomy + origin disclosure (PR 2) ---

test('stock list API filters by origin and license', async () => {
  const { onRequestGet } = await importRepoFile('functions/api/stock/list.js');
  const kv = memoryKV();
  await seedUnifiedCatalog(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };

  const photographs = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=hosted&origin=photograph'),
    env,
  });
  const photoBody = await photographs.json();
  assert.equal(photoBody.items.length, 2);
  assert.ok(photoBody.items.every((item) => item.origin === 'photograph'));

  const cc0 = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=hosted&license=cc0'),
    env,
  });
  const cc0Body = await cc0.json();
  assert.equal(cc0Body.items.length, 2);

  const ai = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?origin=ai-generated'),
    env,
  });
  const aiBody = await ai.json();
  assert.equal(aiBody.items.length, 1);
  assert.equal(aiBody.items[0].originDetail.model, 'flux/sana');

  const bad = await onRequestGet({
    request: new Request('https://freedesignstore.online/api/stock/list?source=hosted&origin=magic'),
    env,
  });
  assert.equal(bad.status, 400);
});

test('photo page and gallery disclose origin', async () => {
  const photoPage = await readRepo('functions/photo/[id].js');
  assert.match(photoPage, /How this was made/);
  assert.match(photoPage, /Origin not disclosed/);
  assert.match(photoPage, /Generation prompt/);
  assert.match(photoPage, /ImageObject/);

  const gallery = await readRepo('store/images/stock-photos/index.html');
  assert.match(gallery, /ORIGIN_FILTERS/);
  assert.match(gallery, /LICENSE_FILTERS/);
  assert.match(gallery, /uploadOrigin/);
  assert.doesNotMatch(gallery, /HOSTED_PHOTOS/);

  const mcpSource = await readRepo('workers/mcp/src/index.ts');
  assert.match(mcpSource, /'update_asset'/);
  assert.match(mcpSource, /origin_tool/);
});

test('terms and privacy pages state the CC0 dedication', async () => {
  const terms = await readRepo('store/terms/index.html');
  assert.match(terms, /CC0 1\.0 Universal/);
  assert.match(terms, /No attribution/);
  assert.match(terms, /public domain/i);
  assert.match(terms, /creativecommons\.org\/publicdomain\/zero/);

  const privacy = await readRepo('store/privacy/index.html');
  assert.match(privacy, /Cloudflare Web Analytics/);
  assert.match(privacy, /__Host-fds_mcp_session/);

  const gallery = await readRepo('store/images/stock-photos/index.html');
  assert.match(gallery, /Publish to the Public Domain \(CC0\)/);
  assert.doesNotMatch(gallery, /uploadLicense/);

  const sitemap = await readRepo('store/sitemap.xml');
  assert.match(sitemap, /\/terms\//);
  assert.match(sitemap, /\/privacy\//);
});

// --- Creator profiles (PR 3) ---

async function seedProfileAndAsset(kv) {
  const profile = {
    accountId: 'github-42',
    handle: 'alice',
    displayName: 'Alice Lane',
    avatarUrl: 'https://example.com/a.png',
    bio: 'Photographer and illustrator.',
    website: 'https://alice.example',
    social: { x: 'alice' },
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };
  const item = {
    id: 'asset-1',
    title: 'Misty Coast',
    category: 'nature',
    assetType: 'photo',
    author: 'Alice Lane',
    license: 'CC0 / Public Domain',
    licenseId: 'cc0',
    origin: 'photograph',
    tags: ['coast'],
    status: 'public',
    objectKey: 'community/asset-1/misty-coast.jpg',
    filename: 'misty-coast.jpg',
    contentType: 'image/jpeg',
    size: 1000,
    ownerAccountId: 'github:42',
    ownerName: 'Alice Lane',
    ownerHandle: 'alice',
    createdAt: '2026-07-01T00:00:00Z',
  };
  await kv.put('profile:account:github-42', JSON.stringify(profile));
  await kv.put('profile:handle:alice', JSON.stringify({ accountId: 'github-42' }));
  await kv.put('stock:item:asset-1', JSON.stringify(item));
  await kv.put('stock:index:public', JSON.stringify(['asset-1']));
  await kv.put('stock:index:account:github-42', JSON.stringify(['asset-1']));
}

test('creator profile page renders hero, works grid, and ProfilePage JSON-LD', async () => {
  const { onRequestGet } = await importRepoFile('functions/u/[handle].js');
  const kv = memoryKV();
  await seedProfileAndAsset(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };

  const res = await onRequestGet({
    params: { handle: 'alice' },
    request: new Request('https://freedesignstore.online/u/alice'),
    env,
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Alice Lane/);
  assert.match(html, /@alice/);
  assert.match(html, /Photographer and illustrator\./);
  assert.match(html, /Misty Coast/);
  assert.match(html, /"@type":"ProfilePage"/);
  assert.match(html, /\/photo\/asset-1/);

  const missing = await onRequestGet({
    params: { handle: 'nobody' },
    request: new Request('https://freedesignstore.online/u/nobody'),
    env,
  });
  assert.equal(missing.status, 404);
});

test('creators directory lists contributors with counts', async () => {
  const { onRequestGet } = await importRepoFile('functions/creators.js');
  const kv = memoryKV();
  await seedProfileAndAsset(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };

  const res = await onRequestGet({
    request: new Request('https://freedesignstore.online/creators'),
    env,
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Alice Lane/);
  assert.match(html, /1 asset/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /\/u\/alice/);
});

test('profile API updates bio and enforces handle uniqueness', async () => {
  const { onRequestPost } = await importRepoFile('functions/api/stock/profile.js');
  const kv = memoryKV();
  await seedProfileAndAsset(kv);
  // second profile that will collide with 'alice'
  await kv.put('profile:account:github-7', JSON.stringify({
    accountId: 'github-7', handle: 'bob', displayName: 'Bob', social: {},
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }));
  await kv.put('profile:handle:bob', JSON.stringify({ accountId: 'github-7' }));
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket(), SESSION_SIGNING_KEY: 'test-signing-key' };
  const token = signTestSession({ uid: 'github:7', name: 'Bob', login: 'bob', roles: ['creator'] }, 'test-signing-key');
  const makeReq = (body) =>
    new Request('https://freedesignstore.online/api/stock/profile', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { cookie: `__Host-fds_mcp_session=${encodeURIComponent(token)}`, 'content-type': 'application/json' },
    });

  const updated = await onRequestPost({ request: makeReq({ bio: 'Making things.', website: 'https://bob.example' }), env });
  assert.equal(updated.status, 200);
  const body = await updated.json();
  assert.equal(body.profile.bio, 'Making things.');

  const collision = await onRequestPost({ request: makeReq({ handle: 'alice' }), env });
  assert.equal(collision.status, 409);
});

test('public items carry owner handles for author links', async () => {
  const lib = await readRepo('functions/api/stock/_lib.js');
  assert.match(lib, /ownerHandle/);
  assert.match(lib, /authorUrl/);
  const photoPage = await readRepo('functions/photo/[id].js');
  assert.match(photoPage, /\/u\/\$\{esc\(item\.ownerHandle\)\}/);
  const mcpSource = await readRepo('workers/mcp/src/index.ts');
  assert.match(mcpSource, /'get_my_profile'/);
  assert.match(mcpSource, /'update_my_profile'/);
  const consoleHtml = await readRepo('store/console/index.html');
  assert.match(consoleHtml, /update_my_profile/);
  assert.match(consoleHtml, /id="profHandle"/);
});

// --- Video support (PR 4) ---

test('image route serves byte ranges for video seeking', async () => {
  const { onRequestGet } = await importRepoFile('functions/api/stock/image/[id].js');
  const kv = memoryKV();
  const payload = new Uint8Array(1000).fill(7);
  const item = {
    id: 'vid-1', title: 'Clip', category: 'community', assetType: 'video',
    author: 'Alice', license: 'FDS Free', status: 'public',
    objectKey: 'community/vid-1/clip.mp4', filename: 'clip.mp4',
    contentType: 'video/mp4', size: payload.byteLength, tags: [],
    createdAt: '2026-07-01T00:00:00Z',
  };
  await kv.put('stock:item:vid-1', JSON.stringify(item));
  const captured = [];
  const bucket = {
    async head() { return { size: payload.byteLength }; },
    async get(key, opts) {
      captured.push(opts);
      const range = opts?.range;
      const body = range ? payload.slice(range.offset, range.offset + range.length) : payload;
      return {
        body,
        httpEtag: '"abc"',
        writeHttpMetadata(headers) { headers.set('content-type', 'video/mp4'); },
      };
    },
  };
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: bucket };

  const partial = await onRequestGet({
    params: { id: 'vid-1' },
    request: new Request('https://freedesignstore.online/api/stock/image/vid-1', { headers: { range: 'bytes=100-199' } }),
    env,
  });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 100-199/1000');
  assert.equal(partial.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(captured[0], { range: { offset: 100, length: 100 } });

  const full = await onRequestGet({
    params: { id: 'vid-1' },
    request: new Request('https://freedesignstore.online/api/stock/image/vid-1'),
    env,
  });
  assert.equal(full.status, 200);

  const unsatisfiable = await onRequestGet({
    params: { id: 'vid-1' },
    request: new Request('https://freedesignstore.online/api/stock/image/vid-1', { headers: { range: 'bytes=5000-' } }),
    env,
  });
  assert.equal(unsatisfiable.status, 416);
});

test('validateFile accepts bounded videos and rejects oversized ones', async () => {
  const { validateFile } = await importRepoFile('functions/api/stock/_lib.js');
  const smallVideo = { type: 'video/mp4', size: 5 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) };
  assert.equal(validateFile(smallVideo), null);
  const bigVideo = { type: 'video/mp4', size: 50 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) };
  assert.match(String(validateFile(bigVideo)), /40 MB/);
  const badType = { type: 'video/quicktime', size: 1000, arrayBuffer: async () => new ArrayBuffer(0) };
  assert.match(String(validateFile(badType)), /accepted/);
});

test('video rendering is wired across surfaces', async () => {
  const gallery = await readRepo('store/images/stock-photos/index.html');
  assert.match(gallery, /video\/mp4,video\/webm/);
  assert.match(gallery, /id="modalVideo"/);
  assert.match(gallery, /videoDimensions/);
  const photoPage = await readRepo('functions/photo/[id].js');
  assert.match(photoPage, /VideoObject/);
  assert.match(photoPage, /og:video/);
  const profilePage = await readRepo('functions/u/[handle].js');
  assert.match(profilePage, /<video muted loop playsinline/);
});

// --- Admin allowlist + console gating ---

test('console gates views behind sign-in and exposes admin moderation', async () => {
  const consoleHtml = await readRepo('store/console/index.html');
  assert.match(consoleHtml, /body\.locked \.view\{display:none!important\}/);
  assert.match(consoleHtml, /classList\.toggle\('locked',!on\)/);
  assert.match(consoleHtml, /id="adminNavBtn"/);
  assert.match(consoleHtml, /moderate_asset/);
  assert.match(consoleHtml, /data-approve/);
  assert.match(consoleHtml, /data-takedown/);

  const oauth = await readRepo('workers/mcp/src/oauth-provider.ts');
  assert.match(oauth, /adminLogins/);
  assert.match(oauth, /roles\.push\('admin'\)/);
  const wranglerToml = await readRepo('workers/mcp/wrangler.toml');
  assert.match(wranglerToml, /FDS_ADMIN_LOGINS = "serge-ivo"/);
});

// --- Maturity pass: abuse limits, reserved handles, catalog sitemap ---

test('upload enforces account quotas and rate limits', async () => {
  const { onRequestPost } = await importRepoFile('functions/api/stock/upload.js');
  const kv = memoryKV();
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket(), SESSION_SIGNING_KEY: 'test-signing-key' };
  const token = signTestSession({ uid: 'github:9', name: 'Cara', login: 'cara', roles: ['creator', 'publisher'] }, 'test-signing-key');
  const makeReq = () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(64)], 'x.jpg', { type: 'image/jpeg' }));
    form.append('origin', 'photograph');
    form.append('rightsConsent', 'yes');
    form.append('releaseConsent', 'yes');
    return new Request('https://freedesignstore.online/api/stock/upload', {
      method: 'POST',
      body: form,
      headers: { cookie: `__Host-fds_mcp_session=${encodeURIComponent(token)}` },
    });
  };

  // account at its 100-asset cap
  await kv.put('stock:index:account:github-9', JSON.stringify(Array.from({ length: 100 }, (_, i) => `a${i}`)));
  const quota = await onRequestPost({ request: makeReq(), env });
  assert.equal(quota.status, 429);
  assert.match((await quota.json()).error, /Account asset limit/);

  // hourly rate limit
  await kv.put('stock:index:account:github-9', JSON.stringify([]));
  const hour = Math.floor(Date.now() / 3600000);
  await kv.put(`rl:upload:github-9:${hour}`, '20');
  const rate = await onRequestPost({ request: makeReq(), env });
  assert.equal(rate.status, 429);
  assert.match((await rate.json()).error, /rate limit/);

  // full catalog
  await kv.delete(`rl:upload:github-9:${hour}`);
  await kv.put('stock:index:public', JSON.stringify(Array.from({ length: 500 }, (_, i) => `p${i}`)));
  const full = await onRequestPost({ request: makeReq(), env });
  assert.equal(full.status, 429);
  assert.match((await full.json()).error, /capacity/);
});

test('reserved handles cannot be claimed', async () => {
  const { onRequestPost } = await importRepoFile('functions/api/stock/profile.js');
  const kv = memoryKV();
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket(), SESSION_SIGNING_KEY: 'test-signing-key' };
  const token = signTestSession({ uid: 'github:9', name: 'Cara', login: 'cara', roles: ['creator'] }, 'test-signing-key');
  const res = await onRequestPost({
    request: new Request('https://freedesignstore.online/api/stock/profile', {
      method: 'POST',
      body: JSON.stringify({ handle: 'admin' }),
      headers: { cookie: `__Host-fds_mcp_session=${encodeURIComponent(token)}` },
    }),
    env,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /reserved/);
});

test('catalog sitemap lists photo and creator pages', async () => {
  const { onRequestGet } = await importRepoFile('functions/sitemap-catalog.xml.js');
  const kv = memoryKV();
  await seedProfileAndAsset(kv);
  const env = { FDS_STOCK_KV: kv, FDS_STOCK_BUCKET: memoryBucket() };
  const res = await onRequestGet({ request: new Request('https://freedesignstore.online/sitemap-catalog.xml'), env });
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.match(xml, /\/photo\/asset-1/);
  assert.match(xml, /\/u\/alice/);
  assert.match(xml, /\/creators/);
  const robots = await readRepo('store/robots.txt');
  assert.match(robots, /sitemap-catalog\.xml/);
});
