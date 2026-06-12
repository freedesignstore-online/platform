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
  authBase?: string;
  kv: KVNamespace;
  sessionSigningKey: string;
  creatorAccounts: CreatorAccount[];
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
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

type ProviderId = 'github' | 'google';

interface ProviderState {
  p: ProviderId;
  r?: string;
  a?: string;
  n: string;
}

interface ProviderProfile {
  provider: ProviderId;
  accountId: string;
  name: string;
  login?: string;
  avatarUrl?: string;
  email?: string;
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
  if (path === `${AUTH_PREFIX}/github/start`) return providerStart(request, config, 'github');
  if (path === `${AUTH_PREFIX}/github/callback`) return providerCallback(request, config, 'github');
  if (path === `${AUTH_PREFIX}/google/start`) return providerStart(request, config, 'google');
  if (path === `${AUTH_PREFIX}/google/callback`) return providerCallback(request, config, 'google');
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

function b64urlString(value: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(value)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return atob(padded);
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

function configuredProviders(config: OAuthConfig): ProviderId[] {
  const providers: ProviderId[] = [];
  if (config.githubClientId && config.githubClientSecret) providers.push('github');
  if (config.googleClientId && config.googleClientSecret) providers.push('google');
  return providers;
}

function providerLabel(provider: ProviderId): string {
  return provider === 'github' ? 'GitHub' : 'Google';
}

function providerIcon(provider: ProviderId): string {
  return provider === 'github'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"/></svg>';
}

function providerConfigured(config: OAuthConfig, provider: ProviderId): boolean {
  return provider === 'github'
    ? Boolean(config.githubClientId && config.githubClientSecret)
    : Boolean(config.googleClientId && config.googleClientSecret);
}

function authBase(config: OAuthConfig): string {
  return (config.authBase || config.issuer).replace(/\/$/, '');
}

function providerCallbackUrl(config: OAuthConfig, provider: ProviderId): string {
  return new URL(`${AUTH_PREFIX}/${provider}/callback`, authBase(config)).toString();
}

function encodeProviderState(state: ProviderState): string {
  return b64urlString(JSON.stringify(state));
}

function decodeProviderState(value: string): ProviderState | null {
  try {
    const parsed = JSON.parse(b64urlDecode(value)) as Partial<ProviderState>;
    if ((parsed.p === 'github' || parsed.p === 'google') && typeof parsed.n === 'string') return parsed as ProviderState;
  } catch {}
  return null;
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
  const providers = configuredProviders(params.config);
  const name = params.clientName ? escapeHtml(params.clientName) : 'FreeDesignStore';
  const heading = params.authNonce ? 'Connect FreeDesignStore MCP' : 'Sign in to FreeDesignStore';
  const intro = params.authNonce
    ? `${name} wants to create and manage catalog assets as your FDS creator account.`
    : 'Sign in to manage your creator catalog and MCP submissions.';
  const providerLinks = providers.map((provider) => {
    const href = new URL(`${AUTH_PREFIX}/${provider}/start`, authBase(params.config));
    if (params.returnPath) href.searchParams.set('return_to', params.returnPath);
    if (params.authNonce) href.searchParams.set('auth_nonce', params.authNonce);
    return `<a class="provider ${provider}" href="${escapeHtml(href.toString())}">${providerIcon(provider)}<span>Continue with ${providerLabel(provider)}</span></a>`;
  }).join('');
  const fallbackForm = '<div class="error">GitHub/Google sign-in is not configured on this deployment yet. Add the FDS OAuth app secrets to enable creator login.</div>';
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
    .providers{display:grid;gap:10px}
    .provider{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #cfd6e3;border-radius:8px;background:#fff;color:#17202a;text-decoration:none;padding:12px 16px;font-weight:850}
    .provider:hover{border-color:#111827}
    .provider svg{width:20px;height:20px;flex:0 0 auto}
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
    ${providerLinks ? `<div class="providers">${providerLinks}</div>` : fallbackForm}
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
  const consoleUrl = new URL('/console/', authBase(config));
  const meUrl = new URL(`${AUTH_PREFIX}/me`, authBase(config));
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
  const returnPath = sameOriginPath(new URL(authBase(config)), url.searchParams.get('return_to') || '/console/');
  if (session) return redirect(new URL(returnPath, authBase(config)).toString(), 303);
  const nonce = crypto.randomUUID();
  return signInPage({ config, nonce, returnPath });
}

async function authLogin(request: Request, config: OAuthConfig): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const url = new URL(request.url);
  const form = await request.formData();
  const nonce = String(form.get('nonce') || '');
  const returnPath = sameOriginPath(new URL(authBase(config)), String(form.get('return_to') || '/console/'));
  const authNonce = String(form.get('auth_nonce') || '');

  if (!nonceMatches(request, nonce)) {
    return authNonce
      ? new Response('Invalid or expired sign-in state. Restart authorization from your MCP client.', { status: 400 })
      : redirectWithAuthError(authBase(config), returnPath, 'invalid_state', [clearNonceCookie()]);
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
  return redirect(new URL(returnPath, authBase(config)).toString(), 303, cookies);
}

async function providerStart(request: Request, config: OAuthConfig, provider: ProviderId): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  if (!providerConfigured(config, provider)) return new Response(`${providerLabel(provider)} sign-in is not configured for this FDS deployment.`, { status: 503 });
  const session = await currentSession(request, config);
  const url = new URL(request.url);
  const returnPath = sameOriginPath(new URL(authBase(config)), url.searchParams.get('return_to') || '/console/');
  const authNonce = url.searchParams.get('auth_nonce') || '';
  if (session && authNonce) return issueAuthorizationCode(config, authNonce, session.token, [clearInFlightCookie()]);
  if (session) return redirect(new URL(returnPath, authBase(config)).toString(), 303);
  const state = encodeProviderState({
    p: provider,
    r: returnPath,
    a: authNonce || undefined,
    n: crypto.randomUUID(),
  });
  const authUrl = provider === 'github'
    ? new URL('https://github.com/login/oauth/authorize')
    : new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', provider === 'github' ? config.githubClientId! : config.googleClientId!);
  authUrl.searchParams.set('redirect_uri', providerCallbackUrl(config, provider));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  if (provider === 'github') {
    authUrl.searchParams.set('scope', 'read:user user:email');
    authUrl.searchParams.set('allow_signup', 'true');
  } else {
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('prompt', 'select_account');
  }
  return redirect(authUrl.toString(), 302, [nonceCookie(state)]);
}

async function providerCallback(request: Request, config: OAuthConfig, provider: ProviderId): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const url = new URL(request.url);
  const rawState = url.searchParams.get('state') || '';
  const state = decodeProviderState(rawState);
  const returnPath = sameOriginPath(new URL(authBase(config)), state?.r || '/console/');
  if (url.searchParams.get('error')) {
    return redirectWithAuthError(authBase(config), returnPath, url.searchParams.get('error') || 'oauth_denied', [clearNonceCookie()]);
  }
  if (!state || state.p !== provider || !nonceMatches(request, rawState)) {
    return redirectWithAuthError(authBase(config), returnPath, 'invalid_state', [clearNonceCookie()]);
  }
  const code = url.searchParams.get('code');
  if (!code) return redirectWithAuthError(authBase(config), returnPath, 'missing_code', [clearNonceCookie()]);

  let profile: ProviderProfile;
  try {
    profile = provider === 'github'
      ? await githubProfile(config, code)
      : await googleProfile(config, code);
  } catch {
    return redirectWithAuthError(authBase(config), returnPath, 'profile_fetch_failed', [clearNonceCookie()]);
  }

  const sessionToken = await sessionForProvider(config, profile);
  const cookies = [sessionCookie(sessionToken), clearNonceCookie()];
  if (state.a) return issueAuthorizationCode(config, state.a, sessionToken, cookies);
  return redirect(new URL(returnPath, authBase(config)).toString(), 303, cookies);
}

async function sessionForProvider(config: OAuthConfig, profile: ProviderProfile): Promise<string> {
  const roles = ['creator'];
  return signSession(
    {
      uid: profile.accountId,
      name: profile.name,
      provider: profile.provider,
      login: profile.login,
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      roles,
      appRoles: { fds: roles },
    },
    config.sessionSigningKey,
    SESSION_TTL_SECONDS,
  );
}

async function githubProfile(config: OAuthConfig, code: string): Promise<ProviderProfile> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: providerCallbackUrl(config, 'github'),
    }),
  });
  const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error || 'GitHub token exchange failed');
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FreeDesignStore',
    },
  });
  const user = await userRes.json<{ id?: number; login?: string; name?: string | null; avatar_url?: string; email?: string | null }>();
  if (!userRes.ok || !user.id || !user.login) throw new Error('GitHub profile fetch failed');
  return {
    provider: 'github',
    accountId: `github:${user.id}`,
    name: user.name || user.login,
    login: user.login,
    avatarUrl: user.avatar_url,
    email: user.email || undefined,
  };
}

async function googleProfile(config: OAuthConfig, code: string): Promise<ProviderProfile> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.googleClientId || '',
      client_secret: config.googleClientSecret || '',
      code,
      redirect_uri: providerCallbackUrl(config, 'google'),
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error || 'Google token exchange failed');
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
  });
  const user = await userRes.json<{ sub?: string; name?: string; email?: string; picture?: string }>();
  if (!userRes.ok || !user.sub) throw new Error('Google profile fetch failed');
  return {
    provider: 'google',
    accountId: `google:${user.sub}`,
    name: user.name || user.email || `google:${user.sub}`,
    login: user.email,
    avatarUrl: user.picture,
    email: user.email,
  };
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
    provider: payload.provider || null,
    login: payload.login || null,
    avatarUrl: payload.avatarUrl || null,
    email: payload.email || null,
    isAdmin: roles.includes('admin'),
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
