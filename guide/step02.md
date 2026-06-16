# Step 02 — アプリのコンテナ化と AWS への手動デプロイ

Hello World を返すだけの Node.js アプリを Docker イメージにし、AWS（ECR + EC2）へ **手動で** デプロイするステップです。
このステップではまだ CD パイプラインは組まず、「コンソール / CLI で動くこと」を確認するのがゴールです。

```
Mac (ローカル)                    AWS
┌──────────────┐               ┌────────────────────────────┐
│ docker build │ ─ push ─────▶ │ ECR (Docker レジストリ)     │
└──────────────┘               └─────────────┬──────────────┘
                                             │ pull
                                             ▼
                               ┌────────────────────────────┐
                               │ EC2 (t4g / ARM64)          │
                               │  └─ docker run             │
                               └────────────────────────────┘
```

---

## 1. アプリケーションコードの準備

ルートディレクトリにアプリ本体を用意します。

### 1.1 `package.json` を作成

```bash
# プロジェクトルートで実行
npm init -y
npm install express
```

### 1.2 `server.js`

`/` で `Hello World!`、`/health` でヘルスチェックを返すだけの最小サーバーです。

---

## 2. Dockerfile の作成とローカル動作確認

ローカルで build & run

EC2 を ARM64 で作るので、イメージも **`linux/arm64` で揃える** のがポイント。

```bash
docker build --platform=linux/arm64 -t cdk-tutorial-app:latest .
docker run --rm -p 3000:3000 cdk-tutorial-app:latest

# 別ターミナルで確認
curl http://localhost:3000/        # → Hello World!
curl http://localhost:3000/health  # → healthy
```

---

## 3. CDK で AWS リソースを定義

### 3.1 VPC

東京リージョン（`ap-northeast-1`）には AZ が 4 つありますが、**コスト抑制のため `maxAzs: 2`** とし、CDK が自動で 2 つの AZ を選びます。
NAT Gateway は 1 つに集約してさらに節約。

### 3.2 ECR

Docker イメージの置き場所。リポジトリ名はアプリ名と揃えて `cdk-tutorial`。

### 3.3 EC2（ARM64 / Graviton2）

ARM64 で動かすため、**arm64 （ARMアーキテクチャ）のDockerイメージと ARMプロセッサを搭載したEC2インスタンスに揃える** 必要があります。

cdk deploy完了後に EC2に接続し、ECRから docker-imageをpullできるように 
- ssm接続を行える Policyを追加する
-  CLI で 参照しやすいよう、インスタンス ID を SSM Parameter Store に保存

---

## 4. デプロイ

```bash
cd infra
npx cdk diff       # 差分確認
npx cdk deploy     # デプロイ
```

CloudFormation コンソールで `CdkTutorialStack` が `CREATE_COMPLETE` になれば OK。

---

## 5. 手動でアプリを動かす

### 5.1 Docker イメージを ECR に push

ECR のコンソール画面 → 作成された `cdk-tutorial` リポジトリ → **「プッシュコマンドの表示」** に手順が出るので、それに沿って実行します。

![alt text](README_images/ecr_manual_image_push.png)

### 5.2 EC2 に SSM で接続

CDK で SSM Parameter Store に保存しているインスタンス ID を使って接続します。

```bash
# AZ ap-northeast-1a のインスタンス ID を取得
INSTANCE_ID=$(aws ssm get-parameter \
  --name /myapp/ec2/instance-id/ap-northeast-1a \
  --query "Parameter.Value" --output text)

echo "接続先: $INSTANCE_ID"

# Session Manager で接続
aws ssm start-session --target "$INSTANCE_ID"
```

### 5.3 EC2 上で docker pull → run

EC2 内で Docker をインストールし、ECR のイメージを起動します。

```bash
sudo dnf install -y docker
sudo systemctl start docker

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-northeast-1
ECR=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

echo "ECR: $ECR"

# ECR ログイン
aws ecr get-login-password --region $REGION \
  | sudo docker login --username AWS --password-stdin $ECR

# pull & run
sudo docker pull $ECR/cdk-tutorial:latest
sudo docker run -d -p 3000:3000 $ECR/cdk-tutorial:latest

# 動作確認
curl http://localhost:3000/health  # → healthy
```

---

次のステップでは AWS ECS（Amazon Elastic Container Service）on Fargate を使い、コンテナ実行基盤をマネージド化する。
EC2 への SSH（SSM）接続や `docker pull` / `docker run` を手で叩く必要がなくなり、コンテナの起動・停止・入れ替えを ECS に任せられる。
