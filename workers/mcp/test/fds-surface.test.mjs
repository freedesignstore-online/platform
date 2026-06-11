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
  assert.equal(discovery.servers[0].tools.length, 10);
  assert.doesNotMatch(JSON.stringify(discovery), /freeappstore|fds-mcp/i);
});

test('worker config has no FAS public route or FAS auth start', async () => {
  const wrangler = await readRepo('workers/mcp/wrangler.toml');
  assert.match(wrangler, /PUBLIC_MCP_BASE_URL = "https:\/\/freedesignstore\.pages\.dev"/);
  assert.doesNotMatch(wrangler, /freeappstore\.online|api\.freeappstore|AUTH_START\s*=/);
  assert.doesNotMatch(wrangler, /\[\[routes\]\]/);
});

test('worker landing text uses FDS endpoint and bearer-token auth when browser auth is disabled', async () => {
  const source = await readRepo('workers/mcp/src/index.ts');
  assert.match(source, /https:\/\/freedesignstore\.pages\.dev\/mcp/);
  assert.match(source, /Browser sign-in: not enabled until FDS auth is configured\./);
  assert.match(source, /Auth: Authorization: Bearer <creator token, STOCK_ADMIN_TOKEN, or MCP_ADMIN_TOKEN>/);
  assert.doesNotMatch(source, /api\.freeappstore|fds-mcp\.freeappstore/);
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
});
