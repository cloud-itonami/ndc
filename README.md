# ndc — 医薬品コードの登録簿（US FDA NDC + WHO ATC）

**`ndc` は 3 文字の略語で、それ自体は何も説明しない。** 中身は **National Drug Code**
（米国 FDA が個々の医薬品パッケージに与えるコード）と **ATC**（WHO の
Anatomical Therapeutic Chemical 分類）で医薬品を引けるようにする登録簿であり、
レコードは AT Protocol の PDS に書かれる。

**実際に在るのは 3 コマンド・261 行の TypeScript**（`kotoba/src/`）と、それを XRPC
エンドポイントとして露出する Cloudflare Worker 112 行（`xrpc-adapter/src/`）である。

| コマンド | すること |
|---|---|
| `registerDrug` | 医薬品を登録する。主キーは **NDC 優先、無ければ ATC** |
| `lookupByCode`  | NDC または ATC で 1 件引く（NDC を先に試し、無ければ ATC） |
| `listDrugs`     | 一覧。`dosageForm` / `manufacturer` で絞り、cursor で辿る |

## 動かす

**最初に踏む手順は [`docs/operator-quickstart.md`](docs/operator-quickstart.md)。**
実際に踏んだ実測出力と、コードを読んだだけでは見えない罠を書いてある。最短だけ再掲する:

```bash
cd kotoba
npm install
npm test        # → Test Files 1 passed / Tests 13 passed
```

**`npm install` が `EALLOWSCRIPTS` で落ちるマシンがある。** 原因はこの repo ではなく
`~/.npmrc` で、切り分けと回避策は quickstart §1 に実測付きで書いた。

## 1 つの医薬品が 2 行に見える（設計上の挙動）

`registerDrug` に **NDC と ATC を両方渡すと、同じレコードを 2 つの rkey に書く**
（`kotoba/src/registry.ts:79-85`）。`lookupByCode({ atc })` が走査なしで引けるようにする
ための二次索引で、意図的なものである。ただし副作用として:

- **`listDrugs` はその医薬品を 2 回数える。** 1 件だけ登録した状態で `total: 2` が返る
  （quickstart §4 に実測出力）。
- 引く経路によって `drugUri` が変わる（`…/drug-ndc-5977946708` と `…/drug-atc-n02ba01`）。
  `did` と中身は同一。

**既存の 13 テストはこれを踏んでいない** —— `listDrugs` のテストは NDC だけで登録した
3 件を使い、NDC + ATC を両方渡すのは `lookupByCode` のテストだけで、そこでは
`listDrugs` を呼ばない。つまりこの重複は**テストの死角**にある。直すべきか（`listDrugs`
で別名行を畳む）、仕様として残すかは決まっていない。**この README は挙動を可視化した
だけで、コードは変えていない。**

## この repo は 3 か所で別々のことを言っている

読む場所によって「ndc とは何か」の答えが変わる。**2026-08-14 (UTC) に実測した現在地**:

| 読む場所 | そこに書いてあること | コードに在るか |
|---|---|---|
| `kotoba/src/**` | 3 コマンド・collection は `com.etzhayyim.ndc.drug` の 1 本 | **これが実体**（13 テストが緑） |
| `AGENTS.md` | **8 コマンド**（`check-interactions` / `get-adverse-events` / `get-coverage` / `validate-ndc` / `search-drugs` 等）・**6 collection**・WIT capability export 3 種・60s heartbeat | **無い** —— `interaction` / `adverse` / `coverage` / `heartbeat` / `WIT` は `kotoba/src` と `xrpc-adapter/src` に **1 件もヒットしない**（case-sensitive 実測） |
| `xrpc-adapter/README.md` | エンドポイントは `/xrpc/com.etzhayyim.ndc.<cmd>` | **違う** —— コードの `NSID_BASE` は `com.etzhayyim.apps.ndc`（`xrpc-adapter/src/index.ts:22`） |

`AGENTS.md` は移行前の seed（`etzhayyim/root` の `60-apps/etzhayyim-project-ndc`、
`migration.edn` が revision `c3a74d2` として記録している）の設計文書で、`kotoba/` は
その後に書かれた実装である。**この README はどちらも消していない** —— 消すのは別の
仕事で、まず食い違いを可視化した。

**adapter README の NSID のずれは実害が具体的**で、あのパスを叩いたクライアントは
`404 MethodNotFound` を受け取る。この周で README 側を実装に合わせて直した。
なお collection NSID（`com.etzhayyim.ndc.drug`）と XRPC method NSID
（`com.etzhayyim.apps.ndc.*`）が食い違っているのは**コード自身の状態**であり、
どちらが正かは決まっていない。

## デプロイされていない

`wrangler.jsonc` は `ndc.etzhayyim.com/*` を production route として宣言しているが、
**2026-08-14 (UTC) 時点で `ndc.etzhayyim.com` は DNS を引けない**（`etzhayyim.com` と
`pds.etzhayyim.com` は Cloudflare に解決する）。Worker は未デプロイである。

**しかも現状では deploy できない。** `xrpc-adapter/` で `npm install` を叩くと
`EUNSUPPORTEDPROTOCOL: Unsupported URL Type "workspace:"` で落ちる（実測）——
`@etzhayyim/ndc-kotoba` を `workspace:*` で参照しているのに、**この repo に
workspace root が無い**（git 管理下のトップレベルは `AGENTS.md` / `README.edn` /
`migration.edn` の 3 つだけ）。workspace root を作るか `file:../kotoba` に変えるのが
deploy の前提条件で、まだ誰もやっていない。詳細は quickstart §5。

## 構成

```
kotoba/          判断の核。ここだけが単体テストの対象（13 本）
  src/types.ts     DrugRecord / 入出力型 / rkey・DID 導出（96 行）
  src/registry.ts  registerDrug / lookupByCode / listDrugs（152 行）
  src/index.ts     barrel（13 行）
  test/ndc.test.ts 13 テスト（173 行）
xrpc-adapter/    機構。3 コマンドを CF Worker の XRPC endpoint に配線（112 行）
README.edn       repo メタデータ（etzhayyim.repository/v1）
migration.edn    etzhayyim/root からの切り出し元 revision
AGENTS.md        移行前 seed の設計文書（上表のとおり実装と乖離している）
```

## Identity

| key | value |
|---|---|
| domain | `ndc.etzhayyim.com`（未デプロイ） |
| controller DID | `did:web:ndc.etzhayyim.com` |
| drug DID（NDC 主キー） | `did:web:ndc.etzhayyim.com:drug:{ndc}` |
| drug DID（ATC 別名） | `did:web:ndc.etzhayyim.com:atc:{atc}` |
| collection | `com.etzhayyim.ndc.drug` |
| XRPC method NSID | `com.etzhayyim.apps.ndc.*` |
