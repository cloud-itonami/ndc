# ndc XRPC Adapter

CF Worker that exposes the 3 kotoba commands as XRPC endpoints.

## Endpoints

The NSID base is **`com.etzhayyim.apps.ndc`** (`src/index.ts:22`), not
`com.etzhayyim.ndc`. This README claimed the latter until 2026-08-14; requests to
that path get `404 MethodNotFound`.

### Drug Registry (US FDA NDC + WHO ATC)
- `POST /xrpc/com.etzhayyim.apps.ndc.registerDrug` — register drug
- `GET /xrpc/com.etzhayyim.apps.ndc.lookupByCode?ndc=59779-467-08` — lookup by NDC or ATC
- `GET /xrpc/com.etzhayyim.apps.ndc.listDrugs?dosageForm=…` — paginated list

`GET` inputs come from the query string; `POST` from the JSON body. Non-`/xrpc/`
paths and unknown NSIDs return 404; a known NSID with the wrong HTTP method
returns 405 (read from `src/index.ts:75-98` — **not executed**, see Deploy below).

Note the **collection** NSID is still `com.etzhayyim.ndc.drug`
(`../kotoba/src/registry.ts:30`) — collection and method namespaces disagree in
the code itself, and which one is canonical has not been decided.

## Deploy — not yet done

```bash
wrangler deploy
# would deploy to ndc.etzhayyim.com/xrpc/*
```

**As of 2026-08-14 (UTC) this has not been run**: `ndc.etzhayyim.com` does not
resolve in DNS, while `etzhayyim.com` and `pds.etzhayyim.com` do.

**It cannot be run as-is.** `npm install` in this directory fails (measured):

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

`@etzhayyim/ndc-kotoba` is declared `workspace:*`, but the repository has **no
workspace root** — no root `package.json`, no `pnpm-workspace.yaml`; the only
tracked top-level files are `AGENTS.md`, `README.edn` and `migration.edn`. So
the dependency has nothing to resolve against. Fixing this (adding a workspace
root, or pointing at `../kotoba` with `file:`) is a prerequisite for any deploy,
and has not been done.

The Worker also needs `ACTOR_DID` / `PDS_URL` / `L2_RPC_URL` plus PDS JWTs
(`src/index.ts`, `interface Env`); `wrangler.jsonc` sets the first three only
under `env.production`.

See ADR-2605210000 for design context, and
[`../docs/operator-quickstart.md`](../docs/operator-quickstart.md) for the parts
that have actually been walked.
