# CDKインフラ開発チュートリアル

# 全体構成図

# プロジェクト構成

このリポジトリはモノレポ構成です。一つのリポジトリでアプリコードとインフラコードの両方を管理しています。

インフラの環境分けはせず、**staging 環境のみ**を対象とします。

- **ルートディレクトリ**: アプリケーションコード
- **`/infra`**: インフラコード（AWS CDK）

```
cdk-tutorial/
├── infra/                  # CDK によるインフラ定義
│   ├── bin/
│   │   └── infra.ts        # スタックを登録するエントリーポイント
│   ├── lib/
│   │   └── infra-stack.ts  # スタック定義。AWS リソース（S3, Lambda など）をここに書く
│   └── parameter.ts        # アカウントID・リージョン。スタックに渡す設定値（CPU・アプリ名・ドメイン名など）を定義する
└── ...                     # アプリケーションコード
```

# 環境構築

## 前提条件

このプロジェクトを動かすには **Node.js** と **AWS CLI**、**AWS CDK** が必要です。AWS CDK は Node.js 上で動作するため、まず Node.js がインストールされていることを確認してください。

```bash
# Node.js がグローバルにインストールされていることを確認
node -v

# AWS CLI のインストール
brew install awscli
aws --version

# cdkをグローバルにインストール
npm install -g aws-cdk
```

## AWS 認証情報の設定

AWS CLI や CDK が AWS へアクセスするには、**認証情報**（誰として操作するか）と**設定**（どのリージョンを使うか）を事前に用意する必要があります。

macOS では以下の 2 ファイルに分けて管理します。

---

### `~/.aws/config` — 設定ファイル

リージョンや出力形式など、AWS CLI の動作設定を記述します。

```ini
[default]
region = ap-northeast-1
output = json
```
---

### `~/.aws/credentials` — 認証情報ファイル

AWS へのアクセスキーを記述します。**このファイルは絶対に git に含めないでください。**

```ini
[default]
aws_access_key_id = xxxxxxxxxx
aws_secret_access_key = yyyyyyyyyyyyyyyyyy
```

| キー | 説明 |
|-----|------|
| `aws_access_key_id` | IAM ユーザーのアクセスキー ID |
| `aws_secret_access_key` | IAM ユーザーのシークレットアクセスキー |

アクセスキーは AWS コンソール → IAM → ユーザー → 「セキュリティ認証情報」タブから発行できます。

---

### 設定の確認

```bash
aws sts get-caller-identity
```

以下のように自分のアカウント情報が返れば正しく設定されています。

```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user-name"
}
```
