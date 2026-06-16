#!/usr/bin/env bash
# 指定したコンテナ内で対話的に bash を実行する。
#
# 前提:
#   - ECS サービスで enableExecuteCommand が有効化されていること
#   - ローカルに ecspresso / session-manager-plugin がインストール済みであること
#   - 対象 AWS アカウントへの認証情報 (AWS_PROFILE 等) が設定済みであること

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

exec ecspresso exec --command bash
