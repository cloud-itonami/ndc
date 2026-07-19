# ndc XRPC Adapter

CF Worker that exposes the 3 kotoba commands as XRPC endpoints.

## Endpoints

### Drug Registry (US FDA NDC + WHO ATC)
- `POST /xrpc/com.etzhayyim.ndc.registerDrug` — register drug
- `GET /xrpc/com.etzhayyim.ndc.lookupByCode` — lookup by code
- `GET /xrpc/com.etzhayyim.ndc.listDrugs` — paginated list

## Deploy

```bash
wrangler deploy
# Deploys to ndc.etzhayyim.com/xrpc/*
```

See ADR-2605210000 for design context.
