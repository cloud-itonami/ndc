# ndc kotoba

Phase E Option B reference implementation of ndc (US FDA National Drug Code + WHO ATC registry) on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), ndc migrates to **Option B** — PDS XRPC writes via `@etzhayyim/sdk e.write()`.

Coverage: **3 commands** (1 canonical vendor lexicon `lookupByCode` + 2 helpers).

| Tier | Commands | Slice |
|---|---|---|
| Drug Registry | registerDrug, lookupByCode, listDrugs | **1** |

## Authority-chain DIDs

```
did:web:ndc.etzhayyim.com:drug:{ndc}    — NDC-keyed (primary)
did:web:ndc.etzhayyim.com:atc:{atc}     — ATC-keyed (alias)
```

NDC is preferred as the primary key; falls back to ATC when NDC is unavailable.

## Sibling reference impls (17 actors after this PR)
