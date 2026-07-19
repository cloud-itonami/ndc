# ndc.etzhayyim.com — NDC Drug Identification

## Identity

| key | value |
|---|---|
| domain | ndc.etzhayyim.com |
| performerType | service |
| nanoid | nd7c3k9m |
| primary DID | `did:web:ndc.etzhayyim.com` |
| NSID prefix | `com.etzhayyim.ndc.*` |

## What This App Does

National Drug Code + WHO ATC/DDD classification。世界中の医薬品を DID 化。

- NDC (US FDA): 10-digit code (labeler-product-package)
- WHO ATC (Anatomical Therapeutic Chemical): 7-level hierarchical classification
- DDD (Defined Daily Dose): 標準用量
- Drug master (名称、成分、剤形、規格、製造者)
- 薬物相互作用 + 副作用情報
- ATC 1st level (14 groups) → path-based DID

## Multi-DID Model

| DID | 用途 |
|---|---|
| `did:web:ndc.etzhayyim.com` | App coordinator |
| `did:web:ndc.etzhayyim.com:{atc1}` | ATC 1st level group (e.g., `a` Alimentary, `c` Cardiovascular) |

## Data Collections

| collection | NSID | 内容 |
|---|---|---|
| drug | `com.etzhayyim.ndc.drug` | Drug master (ndc, name, ingredients, form, strength) |
| atc | `com.etzhayyim.ndc.atc` | ATC classification mapping |
| interaction | `com.etzhayyim.ndc.interaction` | Drug-drug interactions |
| adverse_event | `com.etzhayyim.ndc.adverse_event` | Adverse event reports |
| manufacturer | `com.etzhayyim.ndc.manufacturer` | Drug manufacturer/labeler |
| coverage_report | `com.etzhayyim.ndc.coverage_report` | Coverage metrics |

## WIT Capability Exports

| interface | 機能 |
|---|---|
| `drug-registry` | NDC/ATC lookup, search, register, validate |
| `interaction-checker` | Drug-drug interaction check |
| `adverse-events` | Adverse event reports |

## Heartbeat (Shinka)

60s heartbeat → coverage per ATC 1st level → weakest → ATPost

## Commands

| command | 説明 |
|---|---|
| `register-drug` | NDC + 医薬品データ登録 |
| `get-drug` | NDC で検索 |
| `search-drugs` | 名称・成分で検索 |
| `validate-ndc` | NDC format validation |
| `list-by-atc` | ATC group で一覧 |
| `check-interactions` | 薬物相互作用チェック |
| `get-adverse-events` | 副作用情報取得 |
| `get-coverage` | ATC group coverage metrics |
