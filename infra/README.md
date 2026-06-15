# インフラ (AWS CDK)

AWS CDK (TypeScript) によるインフラ定義です。

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、自分の AWS アカウント ID を設定します。

## コマンド

| コマンド | 内容 |
|---------|------|
| `cdk synth` | CloudFormation テンプレートを出力（構文確認） |
| `cdk diff` | 現在デプロイ中との差分を確認 |
| `cdk deploy` | AWS にデプロイ |
| `cdk bootstrap` | 初回のみ必要なセットアップ |
