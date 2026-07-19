/**
 * ndc XRPC adapter — CF Worker.
 *
 * Wires the kotoba reference impl (National Drug Code registry)
 * into a deployable CF Worker that exposes each function as an XRPC endpoint
 * at https://ndc.etzhayyim.com/xrpc/com.etzhayyim.apps.ndc.<cmd>
 */

import { createAuthedEtzhayyim, extractBearerToken } from "@etzhayyim/sdk-auth";
import * as ndcRwFree from "@etzhayyim/ndc-kotoba";

interface Env {
  ACTOR_DID: string;
  PDS_URL: string;
  L2_RPC_URL: string;
  PDS_ACCESS_JWT?: string;
  PDS_REFRESH_JWT?: string;
}

type Handler = (e: any, input: unknown) => Promise<unknown>;

const NSID_BASE = "com.etzhayyim.apps.ndc";

interface RouteConfig {
  method: "POST" | "GET";
  handler: Handler;
}

const routes: Record<string, RouteConfig> = {
  // Registry operations
  [`${NSID_BASE}.registerDrug`]: {
    method: "POST",
    handler: (e, input) => ndcRwFree.registerDrug(e, input as any),
  },
  [`${NSID_BASE}.lookupByCode`]: {
    method: "GET",
    handler: (e, input) => ndcRwFree.lookupByCode(e, input as any),
  },
  [`${NSID_BASE}.listDrugs`]: {
    method: "GET",
    handler: (e, input) => ndcRwFree.listDrugs(e, input as any),
  },
};

function mapStatus(status?: string): number {
  if (
    status === "rejected" ||
    status?.includes("invalid") ||
    status?.includes("notFound")
  ) {
    return status?.includes("notFound") ? 404 : 400;
  }
  return 200;
}

function jsonResponse(
  body: unknown,
  status: number = 200,
  init?: ResponseInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (!url.pathname.startsWith("/xrpc/")) {
      return jsonResponse({ error: "NotFound" }, 404);
    }

    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];

    if (!route) {
      return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    }

    if (req.method !== route.method) {
      return jsonResponse({ error: "MethodNotAllowed" }, 405);
    }

    // Instantiate Etzhayyim SDK with auth
    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({ env, bearerToken });

    try {
      const input =
        route.method === "POST"
          ? await req.json().catch(() => ({}))
          : Object.fromEntries(url.searchParams.entries());

      const result = await route.handler(e, input);
      return jsonResponse(result, mapStatus((result as any)?.status));
    } catch (err) {
      return jsonResponse(
        {
          error: "InternalError",
          message: err instanceof Error ? err.message : String(err),
        },
        500
      );
    }
  },
} satisfies ExportedHandler<Env>;
