import { signSession, verifySession } from './session.js';

const AUTH_PREFIX = '/.fds/auth';
const SESSION_COOKIE_NAME = '__Host-fds_mcp_session';
const NONCE_COOKIE_NAME = '__Host-fds_mcp_auth_nonce';
const AUTH_IN_FLIGHT_COOKIE = 'fds_mcp_oauth_inflight';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const NONCE_TTL_SECONDS = 10 * 60;

export interface CreatorAccount {
  accountId: string;
  name: string;
  token: string;
  canPublish?: boolean;
}

interface OAuthConfig {
  issuer: string;
  kv: KVNamespace;
  sessionSigningKey: string;
  creatorAccounts: CreatorAccount[];
}

interface ClientRegistration {
  client_id: string;
  redirect_uris: string[];
  client_name?: string | null;
}

interface AuthRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
}

export function createAuthChallenge(config: Pick<OAuthConfig, 'issuer'>, error?: 'invalid_token'): Response {
  const metadata = new URL('/.well-known/oauth-protected-resource/mcp', config.issuer);
  const params = [`resource_metadata="${metadata.toString()}"`];
  if (error) params.push(`error="${error}"`);
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer ${params.join(', ')}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function resolveOAuthToken(bearer: string, kv: KVNamespace): Promise<string | null> {
  return kv.get(`token:${bearer}`);
}

export function readMcpSessionCookie(request: Request): string | null {
  return readCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
}

export async function handleOAuthRoute(request: Request, config: OAuthConfig): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS' && (path.startsWith('/.well-known/') || path.startsWith(`${AUTH_PREFIX}/`) || ['/register', '/authorize', '/authorize/continue', '/oauth/callback', '/token'].includes(path))) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (path === AUTH_PREFIX || path === `${AUTH_PREFIX}/start`) return authStart(request, config);
  if (path === `${AUTH_PREFIX}/login`) return authLogin(request, config);
  if (path === `${AUTH_PREFIX}/approve`) return authApprove(request, config);
  if (path === `${AUTH_PREFIX}/me`) return authMe(request, config);
  if (path === `${AUTH_PREFIX}/logout`) return authLogout(request);
  if (path === `${AUTH_PREFIX}/callback` || path === '/oauth/callback' || path === '/authorize/continue') {
    return new Response('This FDS auth server signs users in directly. Restart authorization from /authorize.', { status: 410 });
  }
  if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') {
    return json({ resource: `${config.issuer}/mcp`, authorization_servers: [config.issuer] });
  }
  if (path === '/.well-known/oauth-authorization-server') {
    return json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      registration_endpoint: `${config.issuer}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  }
  if (path === '/register' && request.method === 'POST') return register(request, config);
  if (path === '/authorize' && request.method === 'GET') return authorize(request, config);
  if (path === '/token' && request.method === 'POST') return tokenExchange(request, config);
  return null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function html(body: string, status = 200, headers?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(headers || {}),
    },
  });
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function methodNotAllowed(allow: string): Response {
  return noStore(new Response('Method not allowed', { status: 405, headers: { Allow: allow } }));
}

function redirect(location: string, status: 302 | 303 = 302, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join('='));
    } catch {
      return null;
    }
  }
  return null;
}

function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

function nonceCookie(nonce: string): string {
  return [
    `${NONCE_COOKIE_NAME}=${encodeURIComponent(nonce)}`,
    `Max-Age=${NONCE_TTL_SECONDS}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

function clearNonceCookie(): string {
  return `${NONCE_COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function clearInFlightCookie(): string {
  return `${AUTH_IN_FLIGHT_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function sameOriginPath(baseUrl: URL, raw: string | null): string {
  if (!raw) return '/';
  try {
    const parsed = new URL(raw, baseUrl.origin);
    if (parsed.origin !== baseUrl.origin) return '/';
    if (parsed.pathname === AUTH_PREFIX || parsed.pathname.startsWith(`${AUTH_PREFIX}/`)) return '/';
    if (parsed.pathname === '/authorize' || parsed.pathname.startsWith('/authorize/')) return '/';
    if (parsed.pathname === '/oauth/callback' || parsed.pathname === '/token' || parsed.pathname === '/register') return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function nonceMatches(request: Request, nonce: string | null): boolean {
  if (!nonce) return false;
  return readCookie(request.headers.get('Cookie'), NONCE_COOKIE_NAME) === nonce;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]!);
}

function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function findCreator(config: OAuthConfig, accountId: string, token: string): CreatorAccount | null {
  const normalized = accountId.toLowerCase().trim();
  return config.creatorAccounts.find((account) => (
    account.accountId.toLowerCase() === normalized && timingSafeEqual(account.token, token)
  )) || null;
}

async function sessionForCreator(config: OAuthConfig, creator: CreatorAccount): Promise<string> {
  const roles = creator.canPublish ? ['creator', 'publisher'] : ['creator'];
  return signSession(
    {
      uid: creator.accountId,
      name: creator.name,
      roles,
      appRoles: { fds: roles },
    },
    config.sessionSigningKey,
    SESSION_TTL_SECONDS,
  );
}

async function currentSession(request: Request, config: OAuthConfig) {
  const token = readMcpSessionCookie(request);
  if (!token) return null;
  const payload = await verifySession(token, config.sessionSigningKey);
  if (!payload?.uid) return null;
  return { token, payload };
}

function signInPage(params: {
  config: OAuthConfig;
  nonce: string;
  returnPath?: string;
  authNonce?: string;
  clientName?: string | null;
  error?: string;
}): Response {
  const action = new URL(`${AUTH_PREFIX}/login`, params.config.issuer);
  const name = params.clientName ? escapeHtml(params.clientName) : 'FreeDesignStore';
  const heading = params.authNonce ? 'Connect FreeDesignStore MCP' : 'Sign in to FreeDesignStore';
  const intro = params.authNonce
    ? `${name} wants to create and manage catalog assets as your FDS creator account.`
    : 'Sign in to manage your creator catalog and MCP submissions.';
  const response = html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${heading}</title>
  <style>
    :root{color-scheme:light;background:#f6f7f9;color:#17202a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(100%,460px);background:#fff;border:1px solid #d9dee7;border-radius:10px;box-shadow:0 18px 50px rgba(25,36,55,.12);padding:30px}
    h1{font-size:24px;line-height:1.2;margin:0 0 12px}
    p{line-height:1.55;color:#4b5563;margin:0 0 20px}
    form{display:grid;gap:12px}
    label{display:grid;gap:6px;font-size:12px;font-weight:750;color:#364152}
    input{width:100%;border:1px solid #cfd6e3;border-radius:8px;padding:11px;font:inherit}
    button{border:1px solid #111827;background:#111827;color:#fff;border-radius:8px;padding:11px 16px;font:inherit;font-weight:800;cursor:pointer}
    .error{border:1px solid #f3b8b1;background:#fff1f0;color:#b42318;border-radius:8px;padding:10px 12px;font-size:13px}
    small{display:block;margin-top:16px;color:#697386;line-height:1.45}
  </style>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>${intro}</p>
    ${params.error ? `<div class="error">${escapeHtml(params.error)}</div>` : ''}
    <form method="post" action="${escapeHtml(action.toString())}">
      <input type="hidden" name="nonce" value="${escapeHtml(params.nonce)}">
      ${params.returnPath ? `<input type="hidden" name="return_to" value="${escapeHtml(params.returnPath)}">` : ''}
      ${params.authNonce ? `<input type="hidden" name="auth_nonce" value="${escapeHtml(params.authNonce)}">` : ''}
      <label>Creator ID<input name="account_id" autocomplete="username" required autofocus></label>
      <label>Creator sign-in code<input name="creator_code" type="password" autocomplete="current-password" required></label>
      <button type="submit">${params.authNonce ? 'Connect MCP Client' : 'Sign In'}</button>
    </form>
    <small>FDS sets a secure httpOnly session cookie. MCP clients receive OAuth access tokens; users never paste bearer tokens into the console.</small>
  </main>
</body>
</html>`, 200, {
    'Set-Cookie': `${AUTH_IN_FLIGHT_COOKIE}=1; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax`,
  });
  response.headers.append('Set-Cookie', nonceCookie(params.nonce));
  return response;
}

function consentPage(config: OAuthConfig, nonce: string, clientName: string | null, accountName: string): Response {
  const action = new URL(`${AUTH_PREFIX}/approve`, config.issuer);
  const name = clientName ? escapeHtml(clientName) : 'your MCP client';
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect FreeDesignStore MCP</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#17202a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
    main{width:min(100%,460px);background:#fff;border:1px solid #d9dee7;border-radius:10px;padding:30px;box-shadow:0 18px 50px rgba(25,36,55,.12)}
    h1{font-size:24px;line-height:1.2;margin:0 0 12px}
    p,li{line-height:1.55;color:#4b5563}
    form{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
    button{border:1px solid #111827;background:#111827;color:#fff;border-radius:8px;padding:11px 16px;font:inherit;font-weight:800;cursor:pointer}
    a{display:inline-flex;align-items:center;color:#111827;font-weight:750;text-decoration:none;padding:11px 0}
  </style>
</head>
<body>
  <main>
    <h1>Connect FreeDesignStore MCP</h1>
    <p>${name} will use FDS as <strong>${escapeHtml(accountName)}</strong>.</p>
    <ul>
      <li>Create and submit design assets to your creator catalog.</li>
      <li>List your FDS assets and catalog status.</li>
      <li>Publish only when your account has publishing permission.</li>
    </ul>
    <form method="post" action="${escapeHtml(action.toString())}">
      <input type="hidden" name="nonce" value="${escapeHtml(nonce)}">
      <button type="submit">Allow</button>
      <a href="/">Cancel</a>
    </form>
  </main>
</body>
</html>`);
}

function signedInPage(config: OAuthConfig, userId: string): Response {
  const consoleUrl = new URL('/console/', config.issuer);
  const meUrl = new URL(`${AUTH_PREFIX}/me`, config.issuer);
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signed in to FreeDesignStore</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#17202a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
    main{width:min(100%,460px);background:#fff;border:1px solid #d9dee7;border-radius:10px;padding:30px;box-shadow:0 18px 50px rgba(25,36,55,.12)}
    h1{font-size:24px;line-height:1.2;margin:0 0 12px}
    p{line-height:1.55;color:#4b5563;margin:0 0 18px}
    code{background:#eef2f7;border-radius:6px;padding:2px 6px}
    a{color:#111827;font-weight:750}
  </style>
</head>
<body>
  <main>
    <h1>Signed in to FreeDesignStore</h1>
    <p>You are signed in as <code>${escapeHtml(userId)}</code>.</p>
    <p><a href="${escapeHtml(consoleUrl.toString())}">Open Creator Console</a></p>
    <p><a href="${escapeHtml(meUrl.toString())}">Check current auth session</a></p>
  </main>
</body>
</html>`);
}

function redirectWithAuthError(origin: string, returnPath: string, reason: string, cookies: string[] = []): Response {
  const dest = new URL(returnPath, origin);
  dest.hash = `auth_error=${encodeURIComponent(reason)}`;
  return redirect(dest.toString(), 303, cookies);
}

async function authStart(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const session = await currentSession(request, config);
  const url = new URL(request.url);
  const issuerUrl = new URL(config.issuer);
  const returnPath = sameOriginPath(issuerUrl, url.searchParams.get('return_to') || '/console/');
  if (session) return redirect(new URL(returnPath, config.issuer).toString(), 303);
  const nonce = crypto.randomUUID();
  return signInPage({ config, nonce, returnPath });
}

async function authLogin(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const url = new URL(request.url);
  const form = await request.formData();
  const nonce = String(form.get('nonce') || '');
  const returnPath = sameOriginPath(new URL(config.issuer), String(form.get('return_to') || '/console/'));
  const authNonce = String(form.get('auth_nonce') || '');

  if (!nonceMatches(request, nonce)) {
    return authNonce
      ? new Response('Invalid or expired sign-in state. Restart authorization from your MCP client.', { status: 400 })
      : redirectWithAuthError(config.issuer, returnPath, 'invalid_state', [clearNonceCookie()]);
  }

  const creator = findCreator(config, String(form.get('account_id') || ''), String(form.get('creator_code') || ''));
  if (!creator) {
    return signInPage({
      config,
      nonce,
      returnPath: authNonce ? undefined : returnPath,
      authNonce: authNonce || undefined,
      error: 'Invalid creator ID or sign-in code.',
    });
  }

  const sessionToken = await sessionForCreator(config, creator);
  const cookies = [sessionCookie(sessionToken), clearNonceCookie()];
  if (authNonce) {
    return issueAuthorizationCode(config, authNonce, sessionToken, cookies);
  }

  if (returnPath === '/') {
    const response = signedInPage(config, creator.accountId);
    const headers = new Headers(response.headers);
    for (const cookie of cookies) headers.append('Set-Cookie', cookie);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return redirect(new URL(returnPath, config.issuer).toString(), 303, cookies);
}

async function authApprove(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const form = await request.formData();
  const nonce = String(form.get('nonce') || '');
  const session = await currentSession(request, config);
  if (!session) return new Response('Session expired. Restart authorization from your MCP client.', { status: 401 });
  return issueAuthorizationCode(config, nonce, session.token, [clearInFlightCookie()]);
}

async function authMe(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const token = readMcpSessionCookie(request);
  if (!token) return noStore(json({ authenticated: false }));
  const payload = await verifySession(token, config.sessionSigningKey);
  if (!payload?.uid) {
    const res = noStore(json({ authenticated: false, error: 'invalid session' }));
    const headers = new Headers(res.headers);
    headers.append('Set-Cookie', clearSessionCookie());
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
  const roles = [...(payload.roles || []), ...((payload.appRoles?.fds) || [])];
  return noStore(json({
    authenticated: true,
    accountId: payload.uid,
    accountName: payload.name || payload.uid,
    canPublish: roles.includes('publisher'),
  }));
}

function authLogout(request: Request): Response {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}

async function register(request: Request, config: OAuthConfig): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const hour = Math.floor(Date.now() / 3_600_000);
  const rlKey = `rl:reg:${ip}:${hour}`;
  const count = Number.parseInt((await config.kv.get(rlKey)) ?? '0', 10);
  if (count >= 20) return json({ error: 'rate_limit_exceeded' }, 429);
  await config.kv.put(rlKey, String(count + 1), { expirationTtl: 3600 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) return json({ error: 'invalid_redirect_uri' }, 400);

  const clientId = crypto.randomUUID();
  const client = {
    client_id: clientId,
    redirect_uris: redirectUris,
    client_name: body.client_name ?? null,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
  await config.kv.put(`client:${clientId}`, JSON.stringify(client), { expirationTtl: 90 * 86_400 });
  return json(client, 201);
}

async function authorize(request: Request, config: OAuthConfig): Promise<Response> {
  const url = new URL(request.url);
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const state = url.searchParams.get('state');

  if (responseType !== 'code') return new Response('unsupported_response_type', { status: 400 });
  if (!clientId || !redirectUri || !codeChallenge) return new Response('missing client_id, redirect_uri, or code_challenge', { status: 400 });
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') return new Response('only S256 is supported', { status: 400 });

  const clientRaw = await config.kv.get(`client:${clientId}`);
  if (!clientRaw) return new Response('invalid client_id', { status: 400 });
  const client = JSON.parse(clientRaw) as ClientRegistration;
  if (!client.redirect_uris.includes(redirectUri)) return new Response('redirect_uri not registered', { status: 400 });

  const nonce = crypto.randomUUID();
  await config.kv.put(`authreq:${nonce}`, JSON.stringify({ clientId, redirectUri, codeChallenge, state }), { expirationTtl: 600 });

  const session = await currentSession(request, config);
  if (session) return consentPage(config, nonce, client.client_name ?? null, session.payload.name || session.payload.uid);

  const signInNonce = crypto.randomUUID();
  return signInPage({ config, nonce: signInNonce, authNonce: nonce, clientName: client.client_name ?? null });
}

async function issueAuthorizationCode(config: OAuthConfig, nonce: string, sessionToken: string, cookies: string[] = []): Promise<Response> {
  const reqRaw = await config.kv.get(`authreq:${nonce}`);
  if (!reqRaw) return new Response('invalid or expired nonce', { status: 400 });
  await config.kv.delete(`authreq:${nonce}`);

  const payload = await verifySession(sessionToken, config.sessionSigningKey);
  if (!payload?.uid) return new Response('invalid session', { status: 400 });

  const authReq = JSON.parse(reqRaw) as AuthRequest;
  const code = crypto.randomUUID();
  await config.kv.put(
    `code:${code}`,
    JSON.stringify({ sessionToken, codeChallenge: authReq.codeChallenge, redirectUri: authReq.redirectUri, clientId: authReq.clientId }),
    { expirationTtl: 600 },
  );

  const clientRedirect = new URL(authReq.redirectUri);
  clientRedirect.searchParams.set('code', code);
  if (authReq.state) clientRedirect.searchParams.set('state', authReq.state);
  return redirect(clientRedirect.toString(), 302, [...cookies, clearInFlightCookie()]);
}

async function tokenExchange(request: Request, config: OAuthConfig): Promise<Response> {
  const body = new URLSearchParams(await request.text());
  if (body.get('grant_type') !== 'authorization_code') return json({ error: 'unsupported_grant_type' }, 400);
  const code = body.get('code');
  const redirectUri = body.get('redirect_uri');
  const clientId = body.get('client_id');
  const codeVerifier = body.get('code_verifier');
  if (!code || !redirectUri || !clientId || !codeVerifier) return json({ error: 'invalid_request' }, 400);

  const codeRaw = await config.kv.get(`code:${code}`);
  if (!codeRaw) return json({ error: 'invalid_grant' }, 400);
  await config.kv.delete(`code:${code}`);

  const codeData = JSON.parse(codeRaw) as { sessionToken: string; codeChallenge: string; redirectUri: string; clientId: string };
  if (codeData.redirectUri !== redirectUri || codeData.clientId !== clientId) return json({ error: 'invalid_grant' }, 400);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (computed !== codeData.codeChallenge) return json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);

  const session = await verifySession(codeData.sessionToken, config.sessionSigningKey);
  if (!session?.uid) return json({ error: 'invalid_grant', error_description: 'session expired' }, 400);

  const accessToken = crypto.randomUUID();
  await config.kv.put(`token:${accessToken}`, codeData.sessionToken, { expirationTtl: 86_400 });
  return json({ access_token: accessToken, token_type: 'bearer', expires_in: 86_400 });
}
