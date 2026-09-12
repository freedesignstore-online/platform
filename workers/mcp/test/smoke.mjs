#!/usr/bin/env node
// Live smoke test for the deployed FDS MCP server (issue #11).
//
//   npm run smoke                          # against production
//   npm run smoke -- --base http://...     # against another deployment
//   FDS_MCP_TOKEN=<creator-or-admin> npm run smoke
//
// Deliberately NOT part of `npm test`: it needs a deployed server and network.
// `npm test` stays hermetic; the deploy workflow runs this after publishing.
//
// Unauthenticated checks run always and cover the handshake Claude and
// mcp-remote actually perform: discovery, health, the 401 + WWW-Authenticate
// challenge, and the two OAuth metadata documents that bootstrap sign-in.
//
// With FDS_MCP_TOKEN set it goes further and speaks JSON-RPC over
// streamable-http — initialize, tools/list, and a read-only tool call — then
// asserts the deployed tool schemas still expose the dry_run/confirm safety
// gates. Every authenticated check is side-effect free: nothing is created,
// published, or deleted against a live catalog.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const argBase = process.argv.indexOf('--base');
const BASE = (argBase > -1 ? process.argv[argBase + 1] : 'https://mcp.freedesignstore.online').replace(/\/$/, '');
const TOKEN = process.env.FDS_MCP_TOKEN || '';
const RETRIES = Number(process.env.SMOKE_RETRIES || 12);

const MUTATING = ['create_svg_asset', 'create_asset_from_url', 'update_asset', 'moderate_asset', 'publish_asset', 'unpublish_asset', 'delete_asset'];
const DESTRUCTIVE = ['unpublish_asset', 'delete_asset', 'moderate_asset'];

let failures = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry transient failures — a fresh deploy takes a moment to go live. */
async function check(name, fn, { retries = RETRIES } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await fn();
      console.log(`ok    ${name}`);
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(5000);
    }
  }
  failures += 1;
  console.error(`FAIL  ${name}\n      ${lastError?.message}`);
  return false;
}

function skip(name, why) {
  console.log(`skip  ${name} (${why})`);
}

/** Parse a JSON-RPC reply that may arrive as plain JSON or as an SSE frame. */
function parseRpc(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  for (const line of trimmed.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload) return JSON.parse(payload);
  }
  return null;
}

async function rpc(body, { sessionId } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(`${BASE}/mcp`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
  return { res, json: parseRpc(await res.text()) };
}

// The committed manifest is the contract. Comparing the live server against it
// catches deploy drift and means this file never hardcodes a tool count.
const manifest = JSON.parse(await readFile(resolve(repoRoot, 'store/.well-known/mcp.json'), 'utf8'));
const expectedTools = manifest.servers[0].tools.map((tool) => tool.name).sort();

console.log(`FDS MCP smoke — ${BASE}\n`);

await check('discovery matches the committed manifest', async () => {
  const res = await fetch(`${BASE}/.well-known/mcp.json`, { cache: 'no-store' });
  assert.ok(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert.equal(body.servers?.[0]?.endpoint, `${BASE}/mcp`);
  assert.equal(body.servers?.[0]?.transport, 'streamable-http');
  assert.deepEqual((body.servers?.[0]?.tools || []).map((t) => t.name).sort(), expectedTools);
});

await check('health reports configured storage and the full tool set', async () => {
  const res = await fetch(`${BASE}/health`, { cache: 'no-store' });
  assert.ok(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, true, `storage ${body.storage}`);
  assert.equal(body.tools, expectedTools.length);
});

await check('unauthenticated /mcp returns the OAuth challenge clients need', async () => {
  const res = await fetch(`${BASE}/mcp`, { cache: 'no-store' });
  assert.equal(res.status, 401);
  const challenge = res.headers.get('www-authenticate') || '';
  assert.ok(
    challenge.includes(`${BASE}/.well-known/oauth-protected-resource/mcp`),
    `missing resource metadata in: ${challenge || '(no header)'}`,
  );
});

await check('protected-resource metadata points at this issuer', async () => {
  const res = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`, { cache: 'no-store' });
  assert.ok(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert.equal(body.resource, `${BASE}/mcp`);
  assert.deepEqual(body.authorization_servers, [BASE]);
});

await check('authorization-server metadata advertises PKCE (S256)', async () => {
  const res = await fetch(`${BASE}/.well-known/oauth-authorization-server`, { cache: 'no-store' });
  assert.ok(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert.equal(body.authorization_endpoint, `${BASE}/authorize`);
  assert.equal(body.token_endpoint, `${BASE}/token`);
  assert.equal(body.registration_endpoint, `${BASE}/register`);
  assert.ok(body.code_challenge_methods_supported?.includes('S256'), 'S256 not advertised');
});

await check('a protocol client pointed at / gets 405, not a dead stream', async () => {
  const res = await fetch(`${BASE}/`, { headers: { accept: 'text/event-stream' }, cache: 'no-store' });
  assert.equal(res.status, 405);
  const body = await res.json();
  assert.match(body.error?.message || '', /\/mcp/);
});

if (!TOKEN) {
  skip('MCP protocol handshake', 'set FDS_MCP_TOKEN to enable');
  skip('tools/list matches the manifest', 'set FDS_MCP_TOKEN to enable');
  skip('safety gates exposed in live tool schemas', 'set FDS_MCP_TOKEN to enable');
  skip('catalog_status tool call', 'set FDS_MCP_TOKEN to enable');
} else {
  let sessionId = null;
  let tools = [];

  await check('MCP protocol handshake (initialize)', async () => {
    const { res, json } = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'fds-smoke', version: '1.0.0' },
      },
    });
    assert.equal(res.status, 200, `HTTP ${res.status} — is FDS_MCP_TOKEN valid?`);
    assert.ok(json?.result?.serverInfo, `no serverInfo in ${JSON.stringify(json)}`);
    sessionId = res.headers.get('mcp-session-id');
    await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, { sessionId });
  }, { retries: 3 });

  await check('tools/list matches the committed manifest', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { sessionId });
    tools = json?.result?.tools || [];
    assert.deepEqual(tools.map((t) => t.name).sort(), expectedTools);
  }, { retries: 3 });

  await check('safety gates are exposed in the live tool schemas', async () => {
    assert.ok(tools.length, 'no tools listed');
    const propsOf = (name) => {
      const tool = tools.find((t) => t.name === name);
      assert.ok(tool, `tool ${name} missing`);
      return Object.keys(tool.inputSchema?.properties || {});
    };
    for (const name of MUTATING) {
      assert.ok(propsOf(name).includes('dry_run'), `${name} does not expose dry_run`);
    }
    for (const name of DESTRUCTIVE) {
      assert.ok(propsOf(name).includes('confirm'), `${name} does not expose confirm`);
    }
    // A read tool must not have grown a gate.
    assert.ok(!propsOf('list_assets').includes('confirm'), 'list_assets exposes confirm');
  }, { retries: 1 });

  await check('catalog_status returns a configured catalog', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'catalog_status', arguments: {} },
    }, { sessionId });
    const text = json?.result?.content?.[0]?.text || '';
    const status = JSON.parse(text);
    assert.equal(status.ok, true, text);
    assert.equal(status.storage, 'configured');
    assert.equal(status.accountAuthenticated, true, 'token did not authenticate');
  }, { retries: 3 });
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
