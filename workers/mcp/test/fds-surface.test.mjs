import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('public MCP discovery advertises the FDS Pages endpoint only', async () => {
  const discovery = JSON.parse(await readRepo('store/.well-known/mcp.json'));
  assert.equal(discovery.servers[0].endpoint, 'https://freedesignstore.pages.dev/mcp');
  assert.equal(discovery.servers[0].transport, 'streamable-http');
  assert.equal(discovery.servers[0].tools.length, 13);
  for (const tool of ['list_design_skills', 'get_design_skill', 'apply_design_skill']) {
    assert.ok(discovery.servers[0].tools.some((item) => item.name === tool), `missing ${tool}`);
  }
  assert.doesNotMatch(JSON.stringify(discovery), /freeappstore|fds-mcp/i);
});

test('worker config has no FAS public route or FAS auth start', async () => {
  const wrangler = await readRepo('workers/mcp/wrangler.toml');
  assert.match(wrangler, /PUBLIC_MCP_BASE_URL = "https:\/\/freedesignstore\.pages\.dev"/);
  assert.doesNotMatch(wrangler, /freeappstore\.online|api\.freeappstore|AUTH_START\s*=/);
  assert.doesNotMatch(wrangler, /\[\[routes\]\]/);
});

test('worker supports FDS OAuth without FAS auth routing', async () => {
  const source = await readRepo('workers/mcp/src/index.ts');
  const oauth = await readRepo('workers/mcp/src/oauth-provider.ts');
  const session = await readRepo('workers/mcp/src/session.ts');
  assert.match(source, /https:\/\/freedesignstore\.pages\.dev\/mcp/);
  assert.match(source, /Browser sign-in: https:\/\/freedesignstore\.pages\.dev\/\.fds\/auth\/start/);
  assert.match(source, /Auth: FDS OAuth 2\.1 browser sign-in/);
  assert.match(source, /GOOGLE_OAUTH_ENABLED === 'true'/);
  assert.match(source, /canPublish/);
  assert.match(source, /trusted-publisher creator permission/);
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
      request: new Request('https://freedesignstore.pages.dev/.well-known/oauth-protected-resource/mcp?x=1', {
        headers: { authorization: 'Bearer sample' },
      }),
      env: {},
    });

    assert.equal(response.status, 202);
    assert.equal(seen.length, 1);
    const proxied = seen[0];
    assert.equal(proxied.url, 'https://freedesignstore-mcp.serge-the-dev.workers.dev/.well-known/oauth-protected-resource/mcp?x=1');
    assert.equal(proxied.headers.get('authorization'), 'Bearer sample');
    assert.equal(proxied.headers.get('x-fds-forwarded-host'), 'freedesignstore.pages.dev');
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
  for (const tool of ['list_design_skills', 'get_design_skill', 'apply_design_skill']) {
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
  assert.match(consoleHtml, /Trusted publisher/);
  assert.match(consoleHtml, /tools\/call/);
  assert.match(consoleHtml, /create_svg_asset/);
  assert.match(consoleHtml, /my_assets/);
  assert.doesNotMatch(consoleHtml, /bearer token|sessionStorage|localStorage|freeappstore\.online|api\.freeappstore|fds-mcp\.freeappstore/i);
});

test('published design skills mirror FIS/PAGS skill publishing pattern', async () => {
  const manifest = JSON.parse(await readRepo('store/skills/manifest.json'));
  const skillsPage = await readRepo('store/skills/index.html');
  const mcpSource = await readRepo('workers/mcp/src/index.ts');
  const homeHtml = await readRepo('store/index.html');
  const sitemap = await readRepo('store/sitemap.xml');

  assert.equal(manifest.mcp, 'https://freedesignstore.pages.dev/mcp');
  assert.ok(Array.isArray(manifest.skills));
  assert.equal(manifest.skills.length, 6);
  assert.match(homeHtml, /href="\/skills\/"/);
  assert.match(skillsPage, /list_design_skills/);
  assert.match(skillsPage, /apply_design_skill/);
  assert.match(sitemap, /https:\/\/freedesignstore\.pages\.dev\/skills\//);

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
