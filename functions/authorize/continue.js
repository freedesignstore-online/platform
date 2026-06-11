import { proxyMcpRequest } from "../_mcpProxy.js";

export async function onRequest(context) {
  return proxyMcpRequest(context);
}
