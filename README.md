# CDK インフラ開発チュートリアル

AWS CDK (TypeScript) を使って、Node.js の Web アプリを **コンテナ化 → ECS Fargate へデプロイ → ALB + 独自ドメイン HTTPS で公開** するまでを段階的に学べるチュートリアルリポジトリです。

各ステップは [`guide/`](guide/) 配下の Markdown に手順がまとまっています。コードと手順書がセットで進む構成なので、`git switch` でブランチを切り替えながら差分を見るのもおすすめです。

---

## チュートリアルの進め方

| Step | 内容 | ガイド |
|------|------|--------|
| 01 | CDK プロジェクトを初期化して空スタックをデプロイ | [guide/step01.md](guide/step01.md) |
| 02 | アプリを Docker 化し、EC2 へ手動デプロイ（ECR + SSM Session Manager） | [guide/step02.md](guide/step02.md) |
| 03 | ECS Fargate へ移行し、ecspresso でコンテナに入る | [guide/step03.md](guide/step03.md) |
| 04 | ALB + Route53 + ACM で独自ドメイン HTTPS 公開 | [guide/step04.md](guide/step04.md) |
| 05 | RDS (PostgreSQL) を追加し、Webアプリの `/db-health` で DB 疎通確認 | [guide/step05.md](guide/step05.md) |

---

## プロジェクト構成

このリポジトリは **モノレポ構成** です。1 つのリポジトリでアプリコードとインフラコードの両方を管理しています。
インフラの環境分けはせず、**staging 環境のみ** を対象としています。

```
cdk-tutorial/
├── guide/                          # チュートリアル本体
│
├── infra/                          # AWS CDK によるインフラ定義
│   ├── bin/infra.ts                # エントリーポイント
│   ├── parameter.ts                # アカウント ID / リージョン / CPU など
│   └── lib/
│       ├── stack/
│       │   └── cdk-tutorial-stack.ts   # スタック本体（Construct を組み立てる）
│       └── constructs/             # 機能単位の Construct 群
│
├── ecspresso/                      # ECS タスクへの ssh 代替アクセス
└── ...                             # アプリケーションコード
```

---

## 環境構築

### 必要なツール

| ツール | 用途 | 備考 |
|---|---|---|
| Node.js | CDK / アプリ実行 | v22 推奨 |
| AWS CLI v2 | 認証 / 各種操作 | `brew install awscli` |
| AWS CDK | インフラデプロイ | `npm install -g aws-cdk` |
| Docker | コンテナビルド | Apple Silicon は ARM64 ネイティブで OK |
| ecspresso | ECS Exec | step03 以降で利用。詳細は [ecspresso/usage.md](ecspresso/usage.md) |

```bash
node -v
aws --version
cdk --version
docker --version
```

### AWS 認証情報の設定

AWS CLI / CDK が AWS にアクセスするために、認証情報と既定リージョンを 2 つのファイルに分けて設定します。

**`~/.aws/config`** — 既定リージョンや出力形式

```ini
[default]
region = ap-northeast-1
output = json
```

**`~/.aws/credentials`** — アクセスキー（**絶対に git に含めない**）

```ini
[default]
aws_access_key_id = xxxxxxxxxx
aws_secret_access_key = yyyyyyyyyyyyyyyyyy
```

アクセスキーは AWS コンソール → IAM → ユーザー → 「セキュリティ認証情報」タブから発行できます。

設定後の確認：

```bash
aws sts get-caller-identity
# {
#   "UserId": "AIDAXXXXXXXXXXXXXXXX",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/your-user-name"
# }
```

### CDK 側のセットアップ

`infra/` 配下の細かい手順は [infra/README.md](infra/README.md) と [guide/step01.md](guide/step01.md) を参照してください。

---

## サーバーアクセス（ecspresso）

step03 以降、ステージング環境の ECS タスクへは ecspresso 経由でアクセスします。

```bash
# コンテナ内で bash を実行
ecspresso/staging/run_bash.sh
```

詳細は [ecspresso/usage.md](ecspresso/usage.md) を参照してください。

