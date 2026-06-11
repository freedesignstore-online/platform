import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createAuthChallenge, handleOAuthRoute, readMcpSessionCookie, resolveOAuthToken, type CreatorAccount } from './oauth-provider.js';
import { verifySession } from './session.js';

interface Env {
  FDS_STOCK_BUCKET?: R2Bucket;
  FDS_STOCK_KV?: KVNamespace;
  STOCK_ADMIN_TOKEN?: string;
  MCP_ADMIN_TOKEN?: string;
  FDS_CREATOR_TOKENS?: string;
  CREATOR_TOKENS?: string;
  API_BASE?: string;
  OAUTH_KV?: KVNamespace;
  SESSION_SIGNING_KEY?: string;
  PUBLIC_BASE_URL?: string;
  PUBLIC_MCP_BASE_URL?: string;
  MCP_OBJECT: DurableObjectNamespace;
}

interface McpProps extends Record<string, unknown> {
  isAdmin?: boolean;
  canPublish?: boolean;
  accountId?: string;
  accountName?: string;
}

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  assetType: AssetType;
  author: string;
  license: string;
  tags: string[];
  status: 'pending' | 'public' | 'rejected';
  objectKey: string;
  filename: string;
  contentType: string;
  size: number;
  source?: 'community' | 'mcp';
  sourceUrl?: string;
  ownerAccountId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt?: string;
}

type AssetType = 'photo' | 'illustration' | 'icon' | 'pattern' | 'texture' | 'background' | 'ui';

const PUBLIC_INDEX = 'stock:index:public';
const PENDING_INDEX = 'stock:index:pending';
const ACCOUNT_INDEX_PREFIX = 'stock:index:account:';
const ITEM_PREFIX = 'stock:item:';
const MAX_ITEMS = 500;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_SVG_SIZE = 1024 * 1024;
const PUBLIC_BASE_FALLBACK = 'https://freedesignstore.pages.dev';
const PUBLIC_MCP_BASE_FALLBACK = 'https://freedesignstore.pages.dev';

const assetTypes = ['photo', 'illustration', 'icon', 'pattern', 'texture', 'background', 'ui'] as const;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);
const unsafeSvg = [
  /<script[\s>]/i,
  /<foreignObject[\s>]/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /data:text\/html/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
];

const txt = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const jsonText = (value: unknown) => txt(JSON.stringify(value, null, 2));

function cleanText(value: unknown, fallback: string, max = 120): string {
  return String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((tag) => cleanText(tag, '', 28).toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }
  return String(value || '')
    .split(',')
    .map((tag) => cleanText(tag, '', 28).toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function safeFilename(name: string, contentType: string): string {
  const ext = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  }[contentType] || 'jpg';
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'asset';
  return `${base}.${ext}`;
}

function publicBase(env: Env): string {
  return (env.PUBLIC_BASE_URL || PUBLIC_BASE_FALLBACK).replace(/\/$/, '');
}

function publicMcpBase(env: Env, requestUrl: URL): string {
  return (env.PUBLIC_MCP_BASE_URL || (requestUrl.host ? `${requestUrl.protocol}//${requestUrl.host}` : PUBLIC_MCP_BASE_FALLBACK)).replace(/\/$/, '');
}

function publicItem(env: Env, item: CatalogItem) {
  const base = publicBase(env);
  return {
    id: item.id,
    source: item.source || 'community',
    title: item.title,
    category: item.category,
    assetType: item.assetType || 'photo',
    author: item.author,
    license: item.license,
    tags: item.tags || [],
    url: `${base}/api/stock/image/${item.id}`,
    download: `${base}/api/stock/image/${item.id}?download=1`,
    createdAt: item.createdAt,
    status: item.status,
  };
}

function requireStore(env: Env): { bucket: R2Bucket; kv: KVNamespace } | string {
  if (!env.FDS_STOCK_BUCKET || !env.FDS_STOCK_KV) {
    return 'Catalog storage is not configured. Bind FDS_STOCK_BUCKET to R2 and FDS_STOCK_KV to KV.';
  }
  return { bucket: env.FDS_STOCK_BUCKET, kv: env.FDS_STOCK_KV };
}

function assertAdmin(props: McpProps): string | null {
  return props.isAdmin ? null : 'Not authorized. Connect with Authorization: Bearer <STOCK_ADMIN_TOKEN> or MCP_ADMIN_TOKEN.';
}

function assertAccount(props: McpProps): string | null {
  return props.accountId ? null : 'Not authenticated. Connect with a creator token or admin token.';
}

function currentProps(props: McpProps | undefined): McpProps {
  return props || {};
}

function safeAccountId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'creator';
}

function accountIndexKey(accountId: string): string {
  return `${ACCOUNT_INDEX_PREFIX}${safeAccountId(accountId)}`;
}

function itemForAccount(env: Env, item: CatalogItem) {
  return {
    ...publicItem(env, item),
    ownerAccountId: item.ownerAccountId,
    ownerName: item.ownerName,
    filename: item.filename,
    contentType: item.contentType,
    size: item.size,
    sourceUrl: item.sourceUrl,
  };
}

function isOwner(props: McpProps, item: CatalogItem): boolean {
  return Boolean(props.accountId && item.ownerAccountId && safeAccountId(props.accountId) === safeAccountId(item.ownerAccountId));
}

function parseCreatorAccounts(env: Env): CreatorAccount[] {
  const raw = env.FDS_CREATOR_TOKENS || env.CREATOR_TOKENS || '';
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => ({
          accountId: cleanText(entry?.accountId || entry?.id, '', 80),
          name: cleanText(entry?.name, entry?.accountId || entry?.id || 'Creator', 80),
          token: String(entry?.token || ''),
          canPublish: Boolean(entry?.canPublish || entry?.publisher || (Array.isArray(entry?.roles) && entry.roles.includes('publisher'))),
        }))
        .filter((entry) => entry.accountId && entry.token);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, { name?: string; token?: string; canPublish?: boolean; publisher?: boolean; roles?: string[] } | string>)
        .map(([accountId, value]) => {
          const token = typeof value === 'string' ? value : String(value?.token || '');
          const name = typeof value === 'string' ? accountId : cleanText(value?.name, accountId, 80);
          const canPublish = typeof value === 'string' ? false : Boolean(value?.canPublish || value?.publisher || (Array.isArray(value?.roles) && value.roles.includes('publisher')));
          return { accountId: cleanText(accountId, '', 80), name, token, canPublish };
        })
        .filter((entry) => entry.accountId && entry.token);
    }
  } catch {}
  return [];
}

async function readIndex(kv: KVNamespace, key: string): Promise<string[]> {
  const value = await kv.get<string[]>(key, 'json');
  return Array.isArray(value) ? value : [];
}

async function writeIndex(kv: KVNamespace, key: string, ids: string[]): Promise<void> {
  await kv.put(key, JSON.stringify([...new Set(ids)].slice(0, MAX_ITEMS)));
}

async function getItem(kv: KVNamespace, id: string): Promise<CatalogItem | null> {
  return kv.get<CatalogItem>(`${ITEM_PREFIX}${id}`, 'json');
}

async function putItem(kv: KVNamespace, item: CatalogItem): Promise<void> {
  await kv.put(`${ITEM_PREFIX}${item.id}`, JSON.stringify(item));
}

async function deleteItem(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(`${ITEM_PREFIX}${id}`);
}

async function addToIndex(kv: KVNamespace, key: string, id: string): Promise<void> {
  const ids = await readIndex(kv, key);
  await writeIndex(kv, key, [id, ...ids.filter((itemId) => itemId !== id)]);
}

async function removeFromIndex(kv: KVNamespace, key: string, id: string): Promise<void> {
  const ids = await readIndex(kv, key);
  await writeIndex(kv, key, ids.filter((itemId) => itemId !== id));
}

function validateSvg(svg: string): Uint8Array | string {
  if (new TextEncoder().encode(svg).byteLength > MAX_SVG_SIZE) return 'SVG assets must be under 1 MB.';
  if (!/<svg[\s>]/i.test(svg) || unsafeSvg.some((pattern) => pattern.test(svg))) {
    return 'SVG contains unsupported or unsafe markup.';
  }
  return new TextEncoder().encode(svg);
}

function isBlockedMirrorHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === 'unsplash.com' || host.endsWith('.unsplash.com');
}

function isBlockedFetchHost(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === 'metadata.google.internal' || host.endsWith('.local')) return true;
  if (/^(0|10|127|169\.254|192\.168)\./.test(host)) return true;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && parts[1] === 18) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
  }
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  return false;
}

async function createAsset(params: {
  env: Env;
  bucket: R2Bucket;
  kv: KVNamespace;
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
  title: string;
  assetType: AssetType;
  category?: string;
  author?: string;
  license?: string;
  tags?: string[] | string;
  publish?: boolean;
  sourceUrl?: string;
  ownerAccountId?: string;
  ownerName?: string;
}) {
  const size = params.bytes.byteLength;
  if (!allowedTypes.has(params.contentType)) return { ok: false, error: 'Only JPG, PNG, WebP, AVIF, and SVG assets are accepted.' };
  if (params.contentType === 'image/svg+xml' && size > MAX_SVG_SIZE) return { ok: false, error: 'SVG assets must be under 1 MB.' };
  if (!size || size > MAX_FILE_SIZE) return { ok: false, error: 'Image assets must be under 8 MB.' };

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const title = cleanText(params.title, 'Community asset', 96);
  const filename = safeFilename(title, params.contentType);
  const objectKey = `stock/${id}/${filename}`;
  const status = params.publish ? 'public' : 'pending';

  await params.bucket.put(objectKey, params.bytes, {
    httpMetadata: {
      contentType: params.contentType,
      contentDisposition: `inline; filename="${filename}"`,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      title,
      assetType: params.assetType,
      license: cleanText(params.license, 'Free community license', 80),
    },
  });

  const item: CatalogItem = {
    id,
    title,
    category: cleanText(params.category, params.assetType, 64).toLowerCase(),
    assetType: params.assetType,
    author: cleanText(params.author, 'FreeDesignStore contributor', 80),
    license: cleanText(params.license, 'Free community license', 80),
    tags: cleanTags(params.tags),
    status,
    objectKey,
    filename,
    contentType: params.contentType,
    size,
    source: 'mcp',
    sourceUrl: params.sourceUrl,
    ownerAccountId: params.ownerAccountId ? safeAccountId(params.ownerAccountId) : undefined,
    ownerName: params.ownerName,
    createdAt: now,
  };

  await putItem(params.kv, item);
  await addToIndex(params.kv, status === 'public' ? PUBLIC_INDEX : PENDING_INDEX, id);
  if (item.ownerAccountId) await addToIndex(params.kv, accountIndexKey(item.ownerAccountId), id);

  return { ok: true, item: itemForAccount(params.env, item), admin: { id, status, objectKey, size, ownerAccountId: item.ownerAccountId } };
}

export class FdsCatalogMcp extends McpAgent<Env, unknown, McpProps> {
  server = new McpServer({ name: 'FreeDesignStore Catalog', version: '0.1.0' });

  async setAuth(props: McpProps): Promise<void> {
    this.props = props;
    try {
      await (this as unknown as { ctx: { storage: { put(k: string, v: unknown): Promise<void> } } }).ctx.storage.put('props', props);
    } catch {}
  }

  async init() {
    this.server.tool(
      'asset_policy',
      'Return the FreeDesignStore catalog policy, including legal rules for Unsplash.',
      {},
      async () => txt([
        '# FreeDesignStore Catalog Policy',
        '',
        '- FDS/community assets may be hosted in our R2 bucket only when the uploader owns the rights or has permission to release them for free.',
        '- SVG uploads are sanitized and unsafe scripting/embedded content is rejected.',
        '- Unsplash assets are not mirrored into our catalog by MCP. Show attribution, embed/hotlink only where allowed by the Unsplash API, and link users to Unsplash for download.',
        '- The MCP `create_asset_from_url` tool rejects unsplash.com and images.unsplash.com URLs.',
        '- Generated illustrations/icons/patterns can be stored when the submitter has rights to share the output.',
      ].join('\n')),
    );

    this.server.tool(
      'catalog_status',
      'Check whether catalog storage is configured and count public/pending assets.',
      {},
      async () => {
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const [publicIds, pendingIds] = await Promise.all([
          readIndex(store.kv, PUBLIC_INDEX),
          readIndex(store.kv, PENDING_INDEX),
        ]);
        return jsonText({
          ok: true,
          storage: 'configured',
          publicCount: publicIds.length,
          pendingCount: pendingIds.length,
          publicBaseUrl: publicBase(this.env),
          accountAuthenticated: Boolean(currentProps(this.props).accountId),
          accountId: currentProps(this.props).accountId,
          isAdmin: Boolean(currentProps(this.props).isAdmin),
          canPublish: Boolean(currentProps(this.props).canPublish || currentProps(this.props).isAdmin),
        });
      },
    );

    this.server.tool(
      'whoami',
      'Show the authenticated creator/admin account for this MCP session.',
      {},
      async () => {
        const props = currentProps(this.props);
        return jsonText({
          authenticated: Boolean(props.accountId),
          accountId: props.accountId || null,
          accountName: props.accountName || null,
          isAdmin: Boolean(props.isAdmin),
          canPublish: Boolean(props.canPublish || props.isAdmin),
        });
      },
    );

    this.server.tool(
      'my_assets',
      'List assets owned by the authenticated creator account.',
      {
        status: z.enum(['all', 'public', 'pending', 'rejected']).optional().describe('Filter by asset status'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum assets to return'),
      },
      async ({ status = 'all', limit = 50 }) => {
        const props = currentProps(this.props);
        const authError = assertAccount(props);
        if (authError) return txt(authError);
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const ids = await readIndex(store.kv, accountIndexKey(props.accountId || ''));
        const items = (await Promise.all(ids.map((id) => getItem(store.kv, id)))).filter((item): item is CatalogItem => Boolean(item));
        const filtered = items.filter((item) => status === 'all' || item.status === status).slice(0, limit);
        return jsonText(filtered.map((item) => itemForAccount(this.env, item)));
      },
    );

    this.server.tool(
      'list_assets',
      'List catalog assets. Pending assets require admin auth.',
      {
        status: z.enum(['public', 'pending']).optional().describe('Asset status to list'),
        asset_type: z.enum(assetTypes).optional().describe('Filter by asset type'),
        category: z.string().optional().describe('Filter by category'),
        q: z.string().optional().describe('Search title/tags/author'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum assets to return'),
      },
      async ({ status = 'public', asset_type, category, q, limit = 50 }) => {
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const props = currentProps(this.props);
        if (status === 'pending' && !props.isAdmin) return txt(assertAdmin(props) || 'Not authorized.');

        const ids = await readIndex(store.kv, status === 'public' ? PUBLIC_INDEX : PENDING_INDEX);
        const items = (await Promise.all(ids.map((id) => getItem(store.kv, id)))).filter((item): item is CatalogItem => Boolean(item));
        const needle = cleanText(q, '', 80).toLowerCase();
        const categoryFilter = cleanText(category, '', 64).toLowerCase();
        const filtered = items
          .filter((item) => !asset_type || item.assetType === asset_type)
          .filter((item) => !categoryFilter || item.category === categoryFilter)
          .filter((item) => !needle || [item.title, item.author, item.category, ...(item.tags || [])].join(' ').toLowerCase().includes(needle))
          .slice(0, limit);
        return jsonText(filtered.map((item) => publicItem(this.env, item)));
      },
    );

    this.server.tool(
      'get_asset',
      'Get one catalog asset by id. Pending assets require admin auth.',
      { id: z.string().describe('Catalog asset id') },
      async ({ id }) => {
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const item = await getItem(store.kv, id);
        if (!item) return txt(`Asset not found: ${id}`);
        const props = currentProps(this.props);
        if (item.status !== 'public' && !props.isAdmin && !isOwner(props, item)) return txt('Not authorized to view this asset.');
        return jsonText(itemForAccount(this.env, item));
      },
    );

    this.server.tool(
      'create_svg_asset',
      'Create a hosted SVG illustration, icon, pattern, background, or UI asset under the authenticated creator account.',
      {
        title: z.string().describe('Asset title'),
        svg: z.string().describe('Complete SVG markup'),
        asset_type: z.enum(assetTypes).optional().describe('Catalog asset type'),
        category: z.string().optional().describe('Catalog category'),
        author: z.string().optional().describe('Author or contributor credit'),
        license: z.string().optional().describe('License label shown to users'),
        tags: z.array(z.string()).optional().describe('Search tags'),
        publish: z.boolean().optional().describe('Publish immediately instead of leaving pending. Requires admin or trusted-publisher creator permission.'),
      },
      async ({ title, svg, asset_type = 'illustration', category, author, license, tags, publish = false }) => {
        const props = currentProps(this.props);
        const authError = assertAccount(props);
        if (authError) return txt(authError);
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const bytes = validateSvg(svg);
        if (typeof bytes === 'string') return txt(bytes);
        const result = await createAsset({
          env: this.env,
          bucket: store.bucket,
          kv: store.kv,
          bytes,
          contentType: 'image/svg+xml',
          title,
          assetType: asset_type,
          category,
          author: author || props.accountName,
          license,
          tags,
          publish: Boolean((props.isAdmin || props.canPublish) && publish),
          ownerAccountId: props.accountId,
          ownerName: props.accountName,
        });
        return jsonText(result);
      },
    );

    this.server.tool(
      'create_asset_from_url',
      'Fetch a public image URL and host it in the FDS catalog under the authenticated creator account. Unsplash URLs are rejected.',
      {
        url: z.string().url().describe('Direct public image URL to ingest'),
        title: z.string().describe('Asset title'),
        asset_type: z.enum(assetTypes).optional().describe('Catalog asset type'),
        category: z.string().optional().describe('Catalog category'),
        author: z.string().optional().describe('Author or contributor credit'),
        license: z.string().optional().describe('License label shown to users'),
        tags: z.array(z.string()).optional().describe('Search tags'),
        publish: z.boolean().optional().describe('Publish immediately instead of leaving pending. Requires admin or trusted-publisher creator permission.'),
      },
      async ({ url, title, asset_type = 'photo', category, author, license, tags, publish = false }) => {
        const props = currentProps(this.props);
        const authError = assertAccount(props);
        if (authError) return txt(authError);
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);

        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return txt('Only HTTPS image URLs are accepted.');
        if (isBlockedFetchHost(parsed)) return txt('Private, local, and metadata network URLs are not accepted.');
        if (isBlockedMirrorHost(parsed)) {
          return txt('Unsplash assets must not be mirrored into FDS. Link users to Unsplash for download instead.');
        }

        const res = await fetch(parsed.toString(), {
          headers: { 'User-Agent': 'FreeDesignStore-MCP/0.1' },
        });
        if (!res.ok) return txt(`Could not fetch image: ${res.status}`);
        const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!allowedTypes.has(contentType)) return txt(`Unsupported image content type: ${contentType || 'unknown'}`);
        const contentLength = Number(res.headers.get('content-length') || 0);
        if (contentLength > MAX_FILE_SIZE) return txt('Image assets must be under 8 MB.');
        const bytes = await res.arrayBuffer();
        if (contentType === 'image/svg+xml') {
          const checked = validateSvg(new TextDecoder().decode(bytes));
          if (typeof checked === 'string') return txt(checked);
        }

        const result = await createAsset({
          env: this.env,
          bucket: store.bucket,
          kv: store.kv,
          bytes,
          contentType,
          title,
          assetType: asset_type,
          category,
          author: author || props.accountName,
          license,
          tags,
          publish: Boolean((props.isAdmin || props.canPublish) && publish),
          sourceUrl: parsed.toString(),
          ownerAccountId: props.accountId,
          ownerName: props.accountName,
        });
        return jsonText(result);
      },
    );

    this.server.tool(
      'moderate_asset',
      'Publish or reject a pending asset. Requires admin auth.',
      {
        id: z.string().describe('Catalog asset id'),
        action: z.enum(['publish', 'reject']).describe('Moderation action'),
      },
      async ({ id, action }) => {
        const authError = assertAdmin(currentProps(this.props));
        if (authError) return txt(authError);
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const item = await getItem(store.kv, id);
        if (!item) return txt(`Asset not found: ${id}`);

        item.status = action === 'publish' ? 'public' : 'rejected';
        item.updatedAt = new Date().toISOString();
        await putItem(store.kv, item);
        await removeFromIndex(store.kv, PENDING_INDEX, id);
        if (action === 'publish') await addToIndex(store.kv, PUBLIC_INDEX, id);
        else await removeFromIndex(store.kv, PUBLIC_INDEX, id);

        return jsonText({ ok: true, item: publicItem(this.env, item) });
      },
    );

    this.server.tool(
      'delete_asset',
      'Delete a catalog asset and its R2 object. Admins can delete any asset; creators can delete their own unpublished assets.',
      { id: z.string().describe('Catalog asset id') },
      async ({ id }) => {
        const props = currentProps(this.props);
        const authError = assertAccount(props);
        if (authError) return txt(authError);
        const store = requireStore(this.env);
        if (typeof store === 'string') return txt(store);
        const item = await getItem(store.kv, id);
        if (!item) return txt(`Asset not found: ${id}`);
        if (!props.isAdmin && !isOwner(props, item)) return txt('Not authorized to delete this asset.');
        if (!props.isAdmin && item.status === 'public') return txt('Published assets require admin removal.');

        await store.bucket.delete(item.objectKey);
        await deleteItem(store.kv, id);
        await removeFromIndex(store.kv, PUBLIC_INDEX, id);
        await removeFromIndex(store.kv, PENDING_INDEX, id);
        if (item.ownerAccountId) await removeFromIndex(store.kv, accountIndexKey(item.ownerAccountId), id);
        return jsonText({ ok: true, deleted: id });
      },
    );
  }
}

async function authenticateRequest(request: Request, env: Env, options: { allowSessionCookie?: boolean } = {}): Promise<McpProps> {
  const auth = request.headers.get('Authorization') || '';
  let sessionToken = options.allowSessionCookie ? readMcpSessionCookie(request) || '' : '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const adminToken = env.MCP_ADMIN_TOKEN || env.STOCK_ADMIN_TOKEN;
    if (adminToken && token === adminToken) {
      return { isAdmin: true, accountId: 'admin', accountName: 'FreeDesignStore Admin' };
    }
    const creator = parseCreatorAccounts(env).find((account) => account.token === token);
    if (creator) {
      return { isAdmin: false, canPublish: Boolean(creator.canPublish), accountId: safeAccountId(creator.accountId), accountName: creator.name };
    }
    sessionToken = token;
    if (env.OAUTH_KV) {
      const resolved = await resolveOAuthToken(token, env.OAUTH_KV);
      if (resolved) sessionToken = resolved;
    }
  }
  if (!sessionToken) return {};
  if (env.SESSION_SIGNING_KEY) {
    const session = await verifySession(sessionToken, env.SESSION_SIGNING_KEY);
    if (session?.uid) {
      const roles = [...(session.roles || []), ...((session.appRoles?.fds) || [])];
      return {
        isAdmin: false,
        canPublish: roles.includes('publisher'),
        accountId: safeAccountId(session.uid),
        accountName: session.name || session.uid,
      };
    }
  }
  return {};
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const issuer = publicMcpBase(env, url);
    const creatorAccounts = parseCreatorAccounts(env);
    const browserAuthEnabled = Boolean(env.OAUTH_KV && env.SESSION_SIGNING_KEY && creatorAccounts.length);

    if (env.OAUTH_KV && env.SESSION_SIGNING_KEY && creatorAccounts.length) {
      const oauthRes = await handleOAuthRoute(request, {
        issuer,
        kv: env.OAUTH_KV,
        sessionSigningKey: env.SESSION_SIGNING_KEY,
        creatorAccounts,
      });
      if (oauthRes) return oauthRes;
    }

    if (url.pathname === '/' || url.pathname === '') {
      return new Response([
        'FreeDesignStore Catalog MCP Server v0.1.0',
        '',
        'Connect: npx mcp-remote https://freedesignstore.pages.dev/mcp',
        browserAuthEnabled
          ? 'Browser sign-in: https://freedesignstore.pages.dev/.fds/auth/start'
          : 'Browser sign-in: not enabled until FDS auth is configured.',
        '',
        'Read:     asset_policy, catalog_status, whoami, list_assets, my_assets, get_asset',
        'Create:   create_svg_asset, create_asset_from_url (creator/admin token)',
        'Admin:    moderate_asset, delete_asset',
        '',
        browserAuthEnabled
          ? 'Auth: FDS OAuth 2.1 browser sign-in, or Authorization: Bearer <creator token, STOCK_ADMIN_TOKEN, or MCP_ADMIN_TOKEN>'
          : 'Auth: Authorization: Bearer <creator token, STOCK_ADMIN_TOKEN, or MCP_ADMIN_TOKEN>',
        'Unsplash: link off for download; do not mirror into FDS.',
      ].join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (url.pathname === '/health') {
      const store = requireStore(env);
      return Response.json({
        ok: typeof store !== 'string',
        storage: typeof store === 'string' ? 'missing' : 'configured',
        tools: 10,
      });
    }

    if (url.pathname.startsWith('/mcp')) {
      const auth = await authenticateRequest(request, env, { allowSessionCookie: browserAuthEnabled });
      if (request.method !== 'OPTIONS' && browserAuthEnabled && !auth.accountId) {
        const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
        return createAuthChallenge({ issuer }, bearer ? 'invalid_token' : undefined);
      }
      if (request.method !== 'OPTIONS' && !browserAuthEnabled && !auth.accountId) {
        return new Response('Authentication required. Use an FDS creator/admin bearer token.', {
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
      if (auth.accountId) {
        (ctx as unknown as { props?: McpProps }).props = {
          ...((ctx as unknown as { props?: McpProps }).props || {}),
          ...auth,
        };
      }
      const sessionId = request.headers.get('mcp-session-id');
      if (auth.accountId && sessionId) {
        try {
          const id = env.MCP_OBJECT.idFromName(`streamable-http:${sessionId}`);
          const stub = env.MCP_OBJECT.get(id) as unknown as { setAuth(p: McpProps): Promise<void> };
          await stub.setAuth(auth);
        } catch {}
      }
      return FdsCatalogMcp.serve('/mcp').fetch(request, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },
};
