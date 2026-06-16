# Step 04 — ALB + HTTPS で Web アプリを公開する

step03 では Private Subnet 内の Fargate に **ecspresso 経由でしかアクセスできない** 状態だった。
このステップでは ALB（Application Load Balancer）+ Route53 + ACM を加えて、**ブラウザから HTTPS で叩ける Web アプリ** にする。

```
step03                                step04
──────                                ──────
ローカル → ecspresso exec             ブラウザ → https://example.com
              ↓                                       ↓
       Fargate (Private)              Route53 → ALB (HTTPS) → Fargate (Private)
```

---

## 1. 事前準備：Route53 でドメインを用意する

ACM 証明書の DNS 検証と ALB のドメイン紐付けに必要なので、**Route53 にホストゾーンが先に存在している前提**で進める。

### 1.1 ドメインの取得方法（3 通り）

| 方法 | 概要 | 向いているケース |
|---|---|---|
| ① **Route53 で新規取得** | コンソール → Route53 → 「ドメインの登録」で購入 | 新規ドメインがほしい |
| ② **外部レジストラのドメインを Route53 に委任** | お名前.com 等で取得済みのドメインの NS を Route53 のホストゾーンに向ける | すでに持っているドメインがある |
| ③ **会社/共有ドメインのサブドメインを払い出してもらう** | 親ホストゾーンに `your-name.example.com` の NS レコードを足してもらう | 個人開発・社内検証 |

このリポジトリでは ③ を想定し、`girard.fusic.dev` のサブドメインを払い出してもらった構成。

### 1.2 ホストゾーンの確認

```bash
aws route53 list-hosted-zones --query "HostedZones[].Name"
# → 自分のドメイン名が含まれていれば OK
```

ホストゾーンが Route53 にあれば、CDK は `HostedZone.fromLookup` で参照できる（**新規作成はしない**ので、既存リソースを壊す心配はない）。

---

## 2. 共通設定にドメインを書く

[infra/lib/config/common.ts](infra/lib/config/common.ts)

```ts
export const commonConfig = {
  appName: "cdk-tutorial",
  baseDomain: "girard.fusic.dev", // ← 自分のドメインに置き換える
  region: "ap-northeast-1"
};
```

`Route53` / `Acm` / `LoadBalancedFargateService` の 3 Construct で参照されるため、ここを変えるだけでドメイン設定が一気通貫で切り替わる。

---

## 3. CDK の構成変更

step03 の `FargateService` を捨てて、**ALB 入りの新 Construct** に置き換える。

```
infra/lib/constructs/
├── vpc.ts
├── ecr.ts
├── route53.ts                       # ← 新規（既存ホストゾーンの参照のみ）
├── acm.ts                           # ← 新規（HTTPS 証明書）
└── load_balanced_fargate_service.ts # ← 新規（ALB + Fargate）
   #   fargate_service.ts は削除
```

### 3.1 Route53（既存ホストゾーンの取得）

### 3.2 ACM（HTTPS 証明書）

### 3.3 ALB + ECS Fargate（一括で立てる）

[infra/lib/constructs/load_balanced_fargate_service.ts](infra/lib/constructs/load_balanced_fargate_service.ts) で **`ApplicationLoadBalancedFargateService`**（CDK の高レベルパターン）を使うと、以下が **1 つのコンストラクタ呼び出しで全部用意される**：

- ECS Cluster
- Task Definition / Service
- ALB（Public）
- Target Group
- Listener（HTTPS:443 + HTTP:80 → 443 リダイレクト）
- ACM 証明書の紐付け
- Route53 の A レコード（ALB を指す Alias）

---

## 4. アプリ側を Web ページ化

step03 までは `app.get('/')` で `"Hello World!"` を返すだけだったのを、**ブラウザで見れる HTML** に置き換える。

### 4.1 `index.html` を追加

[index.html](index.html) — ヘルスチェックボタン付きのデモページ。

### 4.2 `server.js` を静的配信に変更

### 4.3 手元の Docker で動作確認

デプロイ前に、ローカルでイメージをビルドして起動し、ブラウザから見られる状態を作る。

```bash
docker build --platform=linux/arm64 -t cdk-tutorial-app:latest .
docker run --rm -p 3000:3000 cdk-tutorial-app:latest
```

起動したら http://localhost:3000/ をブラウザで開いて確認

---

## 5. デプロイ

```bash
cd infra
cdk diff
cdk deploy
```

1. Route53 のホストゾーン参照（`fromLookup` のキャッシュ作成）
2. ACM 証明書を作成 → DNS 検証用 TXT を Route53 に書き込み → 検証成功で `ISSUED`
3. ALB / Target Group / Listener 作成
4. Fargate Service 起動（DockerImageAsset の build & push 含む）
5. Route53 の A レコード作成（`baseDomain` → ALB の Alias）

すべて完了すると、ターミナルに ALB の DNS 名が出る。

---

## 6. 動作確認

### 6.1 ブラウザで開く

```
https://girard.fusic.dev/
```

ロード時に自動で `/health` が実行され、画面上に `healthy` が表示されれば疎通成功。

## このステップで作ったもの・触ったもの

| レイヤ | 成果物 |
|---|---|
| アプリ | `index.html` 追加。`server.js` を静的配信に変更 |
| インフラ（CDK） | `route53.ts` / `acm.ts` / `load_balanced_fargate_service.ts` を追加。`fargate_service.ts` を削除 |
| AWS 上のリソース | ACM 証明書 + ALB + Listener (HTTPS/HTTP) + Target Group + Route53 A レコード |
| 設定 | `commonConfig.baseDomain` を実ドメインに |

---

## まとめ

step03 までは「コンテナの中身に届く」のがゴールだったが、step04 で **インターネットから HTTPS で叩ける Web アプリ** になった。

次のステップでは、外部からの不正アクセスを抑える（WAF）/ ステージごとの環境分け / DB 接続 などに進むイメージ。
