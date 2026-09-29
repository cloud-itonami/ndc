# operator quickstart — ndc（医薬品コード登録簿）

clone から「医薬品を登録し、NDC でも ATC でも引ける」までの手順。**下の各段は
2026-08-14 (UTC) に実際に踏んで、出力をそのまま貼ってある**（macOS arm64 /
node v26.3.0 / npm 11.16.0、および fleet ノード 2 台で相互確認）。踏んでいない段は
そう明記した —— **読んだだけの手順と走らせた手順を混ぜない。**

作業ディレクトリは §1〜§4 とも:

```bash
cd kotoba
```

---

## 1. 依存を入れる —— 最初の罠はここ

```bash
npm install
```

**マシンによっては、そのまま落ちる**（実測）:

```
npm error code 1
npm error git dep preparation failed
npm error npm error code EALLOWSCRIPTS
npm error npm error --allow-scripts is not allowed in project-scoped installs.
npm error npm error Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.
```

**原因はこの repo ではなく、ユーザーの `~/.npmrc` と npm のバージョンの組み合わせである。**
`~/.npmrc` に `allow-scripts[]=…` が 1 行でも在ると、npm が git 依存を準備するために
内側で起動する install が「project-scoped install なのに `allow-scripts` がある」と判定して
自分で自分を拒否する。この repo は git 依存を 2 本持つ（`@etzhayyim/sdk` と
devDependency の `@etzhayyim/sdk-mock`）。**`prepare: tsc` を持つのは `sdk` の方**
（`sdk-mock` の script は `typecheck` だけだが、その `sdk` を依存に持つ）。`sdk` は
直接依存なので、install は必ずこの経路を通る。

**`--ignore-scripts` を付けても同じ場所で同じように落ちる**（実測）。内側の install に
渡るフラグの問題なので、スクリプト実行の有無とは無関係である。

**切り分けと回避（実測で 3 通り確かめた）**:

| 環境 | 結果 |
|---|---|
| 手元 macOS / npm **11.16.0** / `~/.npmrc` に `allow-scripts[]` 有り | **落ちる** |
| 手元 macOS / npm 11.16.0 / `--userconfig` で `~/.npmrc` を迂回 | **通る** |
| fleet ノード simeon / npm **10.9.8** | **通る**（`added 134 packages in 1m`） |
| fleet ノード judah / npm **11.17.0** | **通る**（警告は出るが git 依存は準備される） |

回避策 —— 空の userconfig を渡して `~/.npmrc` を迂回する:

```bash
: > /tmp/empty-npmrc
npm install --userconfig /tmp/empty-npmrc
```

`~/.npmrc` の他の設定（社内 registry の認証など）が要る作業では、この迂回は使えない。
その場合は npm を 11.17 以上に上げるか、10.x のノードで回す。**「ndc は install
できない」と結論しないこと** —— 症状はマシンの設定で決まり、repo は無関係である。

## 2. テストを通す

```bash
npm test
```

実測（手元・simeon・judah の 3 台とも同じ件数。所要 ms だけ台ごとに違う）:

```
 RUN  v4.1.10

 ✓ test/ndc.test.ts (13 tests)

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

テストは PDS を叩かない。`@etzhayyim/sdk-mock` の `MockEtzhayyim`（インメモリ）に
対して走るので、ネットワークも認証情報も要らない。

## 3. 実データで 1 件登録して引く

**この repo にコマンドラインは無い。** `kotoba/src` はライブラリで、`xrpc-adapter` は
Worker である。手で触るには数行書くのが最短。

**置き場所には制約がある** —— `vitest.config.ts` の `include` が `test/**/*.test.ts`
なので、**`test/` の下に、`.test.ts` で終わる名前で**置く。`test/smoke.probe.ts` に
すると `No test files found, exiting with code 1` になる（実測）。ここでは
`test/smoke.probe.test.ts` とする:

```ts
// kotoba/test/smoke.probe.test.ts
import { it } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import { registerDrug, lookupByCode, listDrugs } from "../src/index.js";

it("smoke", async () => {
const e = new MockEtzhayyim({ did: "did:web:ndc.etzhayyim.com" });

// NDC 59779-467-08 は openFDA で実在を確認したもの（CVS Pharmacy の
// チュアブル・アスピリン）。ATC N02BA01 は WHO ATC/DDD index の
// acetylsalicylic acid（DDD 3 g 経口 = 3000 mg）。
console.log(await registerDrug(e, {
  ndc: "59779-467-08",
  atc: "N02BA01",
  genericName: "aspirin",
  brandName: "Aspirin",
  dosageForm: "TABLET, CHEWABLE",
  routeOfAdministration: "ORAL",
  manufacturer: "CVS Pharmacy",
  dddMg: 3000,
}));

console.log(await lookupByCode(e, { atc: "N02BA01" }));
console.log(await lookupByCode(e, { ndc: "99999-9999-99" }));
console.log(await listDrugs(e, {}));
});
```

走らせる。**`--disable-console-intercept` が要る** —— 付けないと vitest が
`console.log` を飲み込み、テストは緑になるのに出力が 1 行も出ない（実測）:

```bash
npx vitest run test/smoke.probe.test.ts --disable-console-intercept --reporter=verbose
```

`vitest` は `node_modules/.bin` に在るので npx は何もダウンロードしない
（`npx vite-node` にすると **vite-node は依存に無いので別途取りに行く** —— 実測で
`vite-node@6.0.0 will be installed` になった）。

実測出力（`console.log` なので JSON ではなく node の inspect 形式。
`createdAt` は実行時刻。`listDrugs` の分は §4 に置いた）:

```
{
  status: 'registered',
  drugUri: 'at://did:web:ndc.etzhayyim.com/com.etzhayyim.ndc.drug/drug-ndc-5977946708',
  did: 'did:web:ndc.etzhayyim.com:drug:5977946708',
  ndc: '5977946708',
  atc: 'N02BA01'
}
{
  drug: {
    did: 'did:web:ndc.etzhayyim.com:drug:5977946708',
    ndc: '5977946708',
    atc: 'N02BA01',
    dddMg: 3000,
    genericName: 'aspirin',
    brandName: 'Aspirin',
    dosageForm: 'TABLET, CHEWABLE',
    routeOfAdministration: 'ORAL',
    manufacturer: 'CVS Pharmacy',
    createdAt: '2026-08-14T21:51:42.708Z',
    drugUri: 'at://did:web:ndc.etzhayyim.com/com.etzhayyim.ndc.drug/drug-atc-n02ba01'
  }
}
{ error: 'notFound' }
```

読み取れること:

- **NDC は数字だけに正規化される。** `59779-467-08` → `5977946708`
  （`ndcKey` がハイフン等を落とす。`types.ts:78`）。ATC は大文字化される。
- **同じ入力で 2 回呼ぶと 2 回目は `{ status: "alreadyExists" }`** で、`drugUri` は
  1 回目と同じ。冪等性の判定は **rkey** で、rkey は NDC があれば NDC から作る。
- **ATC で引いても NDC で引いても、返る `did` と中身は同一。** 違うのは `drugUri`
  だけで、ATC 経路は別名行（`drug-atc-n02ba01`）を指す。

## 4. 1 件しか登録していないのに `listDrugs` が 2 と答える

§3 の最後の `console.log(await listDrugs(e, {}))` の実測（各 item のフィールドは
同一なので `drugUri` 以外を畳んで示す。`total` と `drugUri` は出力そのまま）:

```
{
  items: [
    { …, drugUri: 'at://…/com.etzhayyim.ndc.drug/drug-ndc-5977946708' },
    { …, drugUri: 'at://…/com.etzhayyim.ndc.drug/drug-atc-n02ba01' }
  ],
  cursor: undefined,
  total: 2
}
```

**2 つの item は `did` も `createdAt` も中身も完全に同一で、違うのは `drugUri` だけ**
である（実測）。

**バグではなく、二次索引がそのまま見えている。** `registerDrug` は NDC と ATC を
両方渡されたとき、同じレコードを `drug-ndc-*` と `drug-atc-*` の 2 つの rkey に書く
（`src/registry.ts:79-85`）。`lookupByCode({ atc })` を走査なしにするための設計で、
`listDrugs` はその 2 行をどちらも返す。

**運用上の含意**: `listDrugs` の `total` は**医薬品の数ではなく行の数**である。
NDC と ATC を両方持つ医薬品が n 件あれば 2n 行返る。件数を数える用途には使えない。

**既存の 13 テストはこれを検出しない** —— `listDrugs` のテストは NDC のみで登録した
3 件を使い、NDC + ATC の同時登録は `lookupByCode` のテスト側にあるが、そこでは
`listDrugs` を呼ばない。畳むべきか仕様として残すかは未決定で、**この quickstart は
挙動を実測して書いただけで、コードは変えていない。**

## 5. Worker を動かす —— ここは踏んでいない

**以下は未実測である。** `xrpc-adapter` は 3 コマンドを XRPC endpoint として露出する
Cloudflare Worker だが、この quickstart を書いた時点で:

- **`ndc.etzhayyim.com` は DNS を引けない**（`etzhayyim.com` と `pds.etzhayyim.com` は
  Cloudflare に解決する）。**Worker は未デプロイ**である。
- **そもそも現状では動かせない。** `xrpc-adapter/` で `npm install` を実際に叩くと
  落ちる（実測）:

  ```
  npm error code EUNSUPPORTEDPROTOCOL
  npm error Unsupported URL Type "workspace:": workspace:*
  ```

  `@etzhayyim/ndc-kotoba` を `workspace:*` で参照しているのに、**この repo に
  workspace root が無い**（root `package.json` も `pnpm-workspace.yaml` も無く、
  git 管理下のトップレベルは `AGENTS.md` / `README.edn` / `migration.edn` の 3 つだけ）。
  解決先が存在しない。workspace root を作るか `file:../kotoba` に変えるかが
  deploy の前提条件で、**まだ誰もやっていない。**
- したがって `wrangler dev` / `wrangler deploy` は踏んでいない。実行には
  `ACTOR_DID` / `PDS_URL` / `L2_RPC_URL` と PDS の JWT も要る（`src/index.ts` の `Env`）。

**エンドポイントのパスは `xrpc-adapter/README.md` が長らく誤っていた。** 実装の
`NSID_BASE` は `com.etzhayyim.apps.ndc`（`src/index.ts:22`）であり、README にあった
`com.etzhayyim.ndc.<cmd>` を叩くと `404 MethodNotFound` が返る。README は実装に
合わせて直した。正しいパスは:

```
POST /xrpc/com.etzhayyim.apps.ndc.registerDrug
GET  /xrpc/com.etzhayyim.apps.ndc.lookupByCode?ndc=59779-467-08
GET  /xrpc/com.etzhayyim.apps.ndc.listDrugs?dosageForm=TABLET,%20CHEWABLE
```

なお **collection NSID（`com.etzhayyim.ndc.drug`）と XRPC method NSID
（`com.etzhayyim.apps.ndc.*`）は今も食い違っている。** これはコード自身の状態で、
どちらが正かは決まっていない。

## 6. `AGENTS.md` を仕様として読まないこと

`AGENTS.md` には 8 コマンド・6 collection・WIT capability export・60s heartbeat が
書いてあるが、**`interaction` / `adverse` / `coverage` / `heartbeat` / `WIT` は
`kotoba/src` と `xrpc-adapter/src` に 1 件もヒットしない**（case-sensitive で実測）。
あれは移行前の seed（`migration.edn` の revision `c3a74d2`）の設計文書であり、
実装はその後に書かれた別物である。詳細は [`../README.md`](../README.md) の対照表。
