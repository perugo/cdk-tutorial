# Step 01 — CDK プロジェクトの初期化

空の CDK プロジェクトを作成し、AWS にデプロイできる状態にするステップです。

## 1. infra ディレクトリに移動

```bash
cd ./infra
```

## 2. CDK プロジェクトを初期化

```bash
npx cdk init app --language=typescript
```

`bin/infra.ts`（エントリーポイント）と `lib/infra-stack.ts`（スタック定義）が生成されます。

## 3. 環境変数の設定

AWS アカウント ID を `.env` で管理する


## 4. 依存パッケージのインストール

```bash
npm install
```

## 5. 差分確認

デプロイ前に、現在の状態との差分を確認します。

```bash
cdk diff
```

## 6. デプロイ

```bash
cdk deploy
```

AWS コンソール → CloudFormation を開き、`CdkTutorialStack` のステータスが `CREATE_COMPLETE` になっていることを確認してください。
