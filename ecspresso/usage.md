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
