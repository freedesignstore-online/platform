const DEFAULT_MCP_BACKEND = "https://freedesignstore-mcp.serge-the-dev.workers.dev";

export function proxyMcpRequest({ request, env }) {
  const source = new URL(request.url);
  const target = new URL(env.FDS_MCP_BACKEND_URL || DEFAULT_MCP_BACKEND);
  target.pathname = source.pathname;
  target.search = source.search;

  const headers = new Headers(request.headers);
  headers.set("X-FDS-Forwarded-Host", source.host);
  headers.set("X-FDS-Forwarded-Proto", source.protocol.replace(":", ""));

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  return fetch(new Request(target.toString(), init));
}
