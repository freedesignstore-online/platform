import { verifySession } from './session.js';

const AUTH_PREFIX = '/.fds/auth';
const SESSION_COOKIE_NAME = '__Host-fds_mcp_session';
const NONCE_COOKIE_NAME = '__Host-fds_mcp_auth_nonce';
const AUTH_IN_FLIGHT_COOKIE = 'fds_mcp_oauth_inflight';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const NONCE_TTL_SECONDS = 10 * 60;
const AUTH_PROVIDERS = ['github', 'google'] as const;
type AuthProvider = (typeof AUTH_PROVIDERS)[number];

interface OAuthConfig {
  issuer: string;
  authStart: string;
  kv: KVNamespace;
  sessionSigningKey: string;
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
  if (path === `${AUTH_PREFIX}/callback`) return authCallback(request, config);
  if (path === `${AUTH_PREFIX}/me`) return authMe(request, config);
  if (path === `${AUTH_PREFIX}/logout`) return authLogout(request);
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
  if (path === '/authorize/continue' && request.method === 'GET') return continueAuthorize(request, config);
  if (path === '/oauth/callback' && request.method === 'GET') return oauthCallback(request, config);
  if (path === '/token' && request.method === 'POST') return tokenExchange(request, config);
  return null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
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

function nonceMatches(request: Request, url: URL): boolean {
  const nonce = url.searchParams.get('nonce');
  if (!nonce) return false;
  return readCookie(request.headers.get('Cookie'), NONCE_COOKIE_NAME) === nonce;
}

function authProvider(raw: string | null): AuthProvider | null {
  return AUTH_PROVIDERS.includes(raw as AuthProvider) ? (raw as AuthProvider) : null;
}

function authStartUrl(config: OAuthConfig, callbackUrl: URL, provider: AuthProvider): string {
  const authUrl = new URL(config.authStart);
  if (provider !== 'github') authUrl.pathname = authUrl.pathname.replace('/auth/github/', `/auth/${provider}/`);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('app_id', 'mcp');
  authUrl.searchParams.set('return_to', callbackUrl.toString());
  return authUrl.toString();
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

function authPage(config: OAuthConfig, nonce: string, clientName: string | null): Response {
  const continueUrl = (provider: AuthProvider) => {
    const url = new URL('/authorize/continue', config.issuer);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('provider', provider);
    return url.toString();
  };
  const name = clientName ? escapeHtml(clientName) : 'your MCP client';
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect FreeDesignStore MCP</title>
  <style>
    :root{color-scheme:light;background:#f6f7f9;color:#17202a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(100%,460px);background:#fff;border:1px solid #d9dee7;border-radius:10px;box-shadow:0 18px 50px rgba(25,36,55,.12);padding:30px}
    h1{font-size:24px;line-height:1.2;margin:0 0 12px}
    p{line-height:1.55;color:#4b5563;margin:0 0 22px}
    .actions{display:flex;gap:10px;flex-wrap:wrap}
    a{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:11px 16px;text-decoration:none;font-weight:750;background:#111827;color:#fff}
    a.secondary{background:#fff;color:#111827;border:1px solid #cfd6e3}
    small{display:block;margin-top:18px;color:#697386;line-height:1.45}
  </style>
</head>
<body>
  <main>
    <h1>Connect FreeDesignStore MCP</h1>
    <p>${name} wants to use FreeDesignStore catalog tools as your creator account.</p>
    <div class="actions">
      <a href="${escapeHtml(continueUrl('github'))}" autofocus>Continue with GitHub</a>
      <a class="secondary" href="${escapeHtml(continueUrl('google'))}">Continue with Google</a>
    </div>
    <small>This signs you in through FreeAppStore auth and returns control to your MCP client.</small>
  </main>
</body>
</html>`, 200, {
    'Set-Cookie': `${AUTH_IN_FLIGHT_COOKIE}=1; Max-Age=120; Path=/; Secure; HttpOnly; SameSite=Lax`,
  });
}

function directSignedInPage(config: OAuthConfig, userId: string): Response {
  const meUrl = new URL(`${AUTH_PREFIX}/me`, config.issuer);
  return html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signed in to FreeDesignStore MCP</title>
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
    <h1>Signed in to FreeDesignStore MCP</h1>
    <p>You are signed in as <code>${escapeHtml(userId)}</code>. MCP clients can continue their authorization flow from here.</p>
    <p><a href="${escapeHtml(meUrl.toString())}">Check current MCP auth session</a></p>
  </main>
</body>
</html>`);
}

function redirectWithAuthError(url: URL, returnPath: string, reason: string, cookies: string[] = []): Response {
  const dest = new URL(returnPath, url.origin);
  dest.hash = `auth_error=${encodeURIComponent(reason)}`;
  return redirect(dest.toString(), 303, cookies);
}

function directCallbackUrl(config: OAuthConfig, nonce: string, returnPath: string): URL {
  const callback = new URL(`${AUTH_PREFIX}/callback`, config.issuer);
  callback.searchParams.set('nonce', nonce);
  callback.searchParams.set('return_to', returnPath);
  return callback;
}

function oauthCallbackUrl(config: OAuthConfig, nonce: string): URL {
  const callback = new URL('/oauth/callback', config.issuer);
  callback.searchParams.set('nonce', nonce);
  return callback;
}

async function authStart(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const url = new URL(request.url);
  const provider = authProvider(url.searchParams.get('provider')) ?? 'github';
  const returnPath = sameOriginPath(url, url.searchParams.get('return_to'));
  const nonce = crypto.randomUUID();
  return redirect(authStartUrl(config, directCallbackUrl(config, nonce, returnPath), provider), 302, [nonceCookie(nonce)]);
}

async function authCallback(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const url = new URL(request.url);
  const returnPath = sameOriginPath(url, url.searchParams.get('return_to'));
  if (!nonceMatches(request, url)) return redirectWithAuthError(url, returnPath, 'invalid_state', [clearNonceCookie()]);

  const fasSession = url.searchParams.get('fas_session');
  if (!fasSession) return redirectWithAuthError(url, returnPath, 'missing_session', [clearNonceCookie()]);

  const payload = await verifySession(fasSession, config.sessionSigningKey);
  if (!payload) return redirectWithAuthError(url, returnPath, 'invalid_session', [clearNonceCookie()]);

  if (returnPath === '/') {
    const response = directSignedInPage(config, payload.uid);
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', sessionCookie(fasSession));
    headers.append('Set-Cookie', clearNonceCookie());
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  return redirect(new URL(returnPath, url.origin).toString(), 303, [sessionCookie(fasSession), clearNonceCookie()]);
}

async function authMe(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const token = readMcpSessionCookie(request);
  if (!token) return noStore(json({ authenticated: false, error: 'not signed in' }, 401));
  const payload = await verifySession(token, config.sessionSigningKey);
  if (!payload) {
    const res = noStore(json({ authenticated: false, error: 'invalid session' }, 401));
    const headers = new Headers(res.headers);
    headers.append('Set-Cookie', clearSessionCookie());
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
  return noStore(json({ authenticated: true, accountId: payload.uid, accountName: payload.uid }));
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
  const client = JSON.parse(clientRaw) as { redirect_uris: string[]; client_name?: string | null };
  if (!client.redirect_uris.includes(redirectUri)) return new Response('redirect_uri not registered', { status: 400 });

  const nonce = crypto.randomUUID();
  await config.kv.put(`authreq:${nonce}`, JSON.stringify({ clientId, redirectUri, codeChallenge, state }), { expirationTtl: 600 });

  return authPage(config, nonce, client.client_name ?? null);
}

async function continueAuthorize(request: Request, config: OAuthConfig): Promise<Response> {
  const url = new URL(request.url);
  const nonce = url.searchParams.get('nonce');
  const provider = authProvider(url.searchParams.get('provider')) ?? 'github';
  if (!nonce) return new Response('missing nonce', { status: 400 });
  const reqRaw = await config.kv.get(`authreq:${nonce}`);
  if (!reqRaw) return new Response('invalid or expired nonce', { status: 400 });
  return redirect(authStartUrl(config, oauthCallbackUrl(config, nonce), provider));
}

async function oauthCallback(request: Request, config: OAuthConfig): Promise<Response> {
  const url = new URL(request.url);
  const nonce = url.searchParams.get('nonce');
  const fasSession = url.searchParams.get('fas_session');
  if (!nonce || !fasSession) return new Response('missing nonce or fas_session', { status: 400 });

  const reqRaw = await config.kv.get(`authreq:${nonce}`);
  if (!reqRaw) return new Response('invalid or expired nonce', { status: 400 });
  await config.kv.delete(`authreq:${nonce}`);

  const payload = await verifySession(fasSession, config.sessionSigningKey);
  if (!payload) return new Response('invalid session', { status: 400 });

  const authReq = JSON.parse(reqRaw) as { clientId: string; redirectUri: string; codeChallenge: string; state: string | null };
  const code = crypto.randomUUID();
  await config.kv.put(
    `code:${code}`,
    JSON.stringify({ fasSession, codeChallenge: authReq.codeChallenge, redirectUri: authReq.redirectUri, clientId: authReq.clientId }),
    { expirationTtl: 600 },
  );

  const clientRedirect = new URL(authReq.redirectUri);
  clientRedirect.searchParams.set('code', code);
  if (authReq.state) clientRedirect.searchParams.set('state', authReq.state);
  return redirect(clientRedirect.toString(), 302, [clearInFlightCookie()]);
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

  const codeData = JSON.parse(codeRaw) as { fasSession: string; codeChallenge: string; redirectUri: string; clientId: string };
  if (codeData.redirectUri !== redirectUri || codeData.clientId !== clientId) return json({ error: 'invalid_grant' }, 400);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (computed !== codeData.codeChallenge) return json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);

  const accessToken = crypto.randomUUID();
  await config.kv.put(`token:${accessToken}`, codeData.fasSession, { expirationTtl: 86_400 });
  return json({ access_token: accessToken, token_type: 'bearer', expires_in: 86_400 });
}
