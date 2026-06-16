# Step 03 — ECS on Fargate でコンテナ実行をマネージド化する

step02 では「EC2 を立てて手動で `docker pull` & `docker run`」していた部分を、**ECS on Fargate** に置き換えるステップ。
ゴールは **`cdk deploy` 1 発でインフラもアプリ（コンテナ）も同時にデプロイされる** 状態にすること。

```
step02                              step03
──────                              ──────
ローカル → docker push → ECR        ローカル → cdk deploy
                       ↓                              ↓
            EC2 (自分で pull / run)         ECS on Fargate（自動で pull / run）
```

---

## 1. step02 から削るもの

step02 で作った以下は不要になるので、Construct を整理。

| 削るもの | 理由 |
|---|---|
| `ec2.ts`（EC2 インスタンス） | Fargate がコンテナ実行を担うので EC2 自体が不要 |
| 自前 ECR への手動 `docker push` | CDK の DockerImageAsset が build → push を自動化 |
| EC2 への SSM 接続・`docker run` 手順 | ECS Service が起動・停止・再デプロイを管理 |

[infra/lib/constructs/](infra/lib/constructs) は次の 3 つに整理：

```
infra/lib/constructs/
├── vpc.ts
├── ecr.ts             # ECR リポジトリ + DockerImageAsset
└── fargate_service.ts # ECS Cluster / TaskDef / Service
```

---

## 2. ECS on Fargate を CDK で定義

[infra/lib/constructs/fargate_service.ts](infra/lib/constructs/fargate_service.ts) のポイント：

- **`runtimePlatform: ARM64`** — Dockerfile を ARM64 でビルドしているので Fargate も Graviton2 系で揃える
- **`enableExecuteCommand: true`** — 後述の ecspresso からコンテナへ入れるようにする

イメージは `DockerImageAsset` を渡すことで、`cdk deploy` 時に **build → push → タスク定義の URI 更新 → ローリング再起動** までが自動で繋がる。

---

## 3. デプロイ

```bash
cd infra
cdk diff
cdk deploy
```

`cdk deploy` 中の流れ：

1. ローカルで `docker build --platform=linux/arm64 ...` が走る
2. CDK Bootstrap の ECR にログインして push（タグはソース内容のハッシュ）
3. CFn 適用：ECS タスク定義のイメージ URI が更新され、Service がローリング更新

---

## 4. 動作確認（ecspresso でコンテナに入る）

ALB を入れる前なので、外部から HTTP で叩く手段はまだ無い。
**ecspresso + ECS Exec** を使ってコンテナの中に入り、`localhost:3000` を叩いて確認する。

> step02 の `aws ssm start-session --target $INSTANCE_ID` で EC2 に入っていたのと同じノリ。
> Fargate には EC2 が無いので、代わりに「**ECS Exec**」というタスク（コンテナ）に直接入る仕組みを使う。

### 4.1 必要なツール

```bash
brew install kayac/tap/ecspresso         # ECS 操作 CLI
brew install --cask session-manager-plugin  # ECS Exec の通信に必要
```

### 4.2 設定ファイル（既に用意済み）

[ecspresso/staging/ecspresso.yml](ecspresso/staging/ecspresso.yml)

```yaml
region: ap-northeast-1
cluster: cdk-tutorial-staging-ecs-cluster-web
service: cdk-tutorial-staging-web-service
```

クラスタ名・サービス名は CDK 側で固定して指定している

### 4.3 コンテナに入って疎通確認

```bash
ecspresso/staging/run_bash.sh
```

実行すると稼働中のタスク一覧が出るので、Task ID を 1 つコピペして Enter。
コンテナ内のシェルに入れたら以下で確認：

```sh
# alpine ベースのため curl は未インストール。その場で入れる
apk add --no-cache curl

curl http://localhost:3000/         # → Hello World!
curl http://localhost:3000/health   # → healthy
```

`wget -qO- http://localhost:3000/` でも OK（標準で入っている）。

> **詳細・前提条件は [ecspresso/usage.md](ecspresso/usage.md) を参照。**

---

## まとめ

`cdk deploy` がやってくれること：

1. **インフラコードの反映**（VPC / ECS / ECR の差分を CFn で適用）
2. **アプリコードのコンテナデプロイ**（`Dockerfile` を build → push → タスク定義更新 → ローリング再起動）

つまり **アプリ修正もインフラ修正も「`cdk deploy` 1 つで AWS に反映される」** 状態になった。
動作確認は ecspresso 経由でコンテナに入って `localhost:3000` を叩く運用。

次のステップでは ALB を前段に置き、外部から HTTP で叩けるようにする。
