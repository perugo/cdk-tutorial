# インフラ (AWS CDK)

AWS CDK (TypeScript) によるインフラ定義です。
手順は [../guide/](../guide/) を参照してください。

## ディレクトリ構成

```
infra/
├── bin/infra.ts                # エントリーポイント
├── lib/
│   ├── stack/                  # スタック本体
│   ├── constructs/             # 機能単位の Construct
│   └── config/common.ts        # appName / baseDomain / region
└── parameter.ts                # 環境別の値（CPU・メモリ・アカウントID）
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数とプロジェクト固有値の設定

CDK が必要とする情報は **2 箇所** に分かれています。

#### `.env`（git 管理外 / アカウント ID）

`.env.example` をコピーして `.env` を作成し、デプロイ先 AWS アカウント ID を設定します。

```ini
# .env
CDK_ACCOUNT=123456789012
```

この値は [bin/infra.ts](bin/infra.ts) が `aws sts get-caller-identity` の結果と照合し、**一致しないと deploy を中断します**（誤デプロイ防止）。

#### `lib/config/common.ts`（git 管理 / プロジェクト共通値）

アプリ名・ドメイン・リージョンなど、リポジトリ全員で共有する値です。自分のプロジェクトに合わせて書き換えます。

```ts
// lib/config/common.ts
export const commonConfig = {
  appName: "cdk-tutorial",      // リソース名のプレフィックスに使われる
  baseDomain: "girard.fusic.dev", // Route53 のホストゾーン名（事前に手動作成）
  region: "ap-northeast-1",
};
```

## コマンド

| コマンド | 内容 |
|---------|------|
| `cdk synth` | CloudFormation テンプレートを出力（構文確認） |
| `cdk diff` | 現在デプロイ中との差分を確認 |
| `cdk deploy` | AWS にデプロイ |
| `cdk destroy` | スタックを削除 |
| `cdk bootstrap` | 初回のみ必要なセットアップ |
