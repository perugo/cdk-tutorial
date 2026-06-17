# ecspressoを利用したサーバー操作

## 準備
- [ecspresso](https://github.com/kayac/ecspresso) (v2 系) をインストールしていること
  - macOS: `brew install kayac/tap/ecspresso`
- [session-manager-plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) をインストールしていること
- AWS CLI v2 をインストールしていること
- それぞれの環境のAWSアカウントの操作権限があること（`AWS_PROFILE` 等で設定）

## スクリプト
### run_bash.sh
- 指定したコンテナ内でコマンド（既定では `bash`）を対話実行する。
- ECS Exec (SSM Session Manager) を利用するため、ECS サービス側で
  `enableExecuteCommand: true` が有効化されている必要がある。

```bash
ecspresso/staging/run_bash.sh
```


### portforward_db.sh

- 手元のPC上で実行すると、localhostの8888番を
  Auroraの5432番にポートフォワーディングします
  - ローカルからDBサーバーに繋げられるようになります
    - 接続先は `localhost:8888`
    - 実際の接続にはDBのパスワード等が必要 (Secrets Manager に保管)
    - TablePlusなどを用いて接続情報を保存しておくと楽です
  - 踏み台として web コンテナを経由する想定です

#### DB への接続例

`portforward_db.sh` を起動した状態で、別ターミナルから接続する。

```bash
# 手元のPC上で実行すると、localhostの8888番をAuroraの5432番にポートフォワーディングします
ecspresso/staging/portforward_db.sh

# 別ターミナルでpsql で接続 (ホストは localhost:8888 を指定)
# rdsのパスワード入力を求められます
psql -h localhost -p 8888 -U postgres -d postgres
```

TablePlus 等の GUI ツールを使う場合は以下を指定する。

| 項目 | 値 |
| --- | --- |
| Host | `localhost` |
| Port | `8888` |
| User | `postgres` |
| Password | Secrets Manager に保管された値 |
| Database | `postgres` |
