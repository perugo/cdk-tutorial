# 02. データモデル

## 方針

- **イベントソーシング**を採用する。ユーザーが記録する正本は「ライフサイクルのイベント（`subscription_events`）」と「金額の履歴（`subscription_price_changes`）」の2つだけ。
- 支払い履歴（`subscription_payments`）は、この2つを時系列にマージして再生（リプレイ）して生成する**派生データ（キャッシュ）**。実績だけでなく、画面表示（今月〜来月の料金）のために**翌月末までの予定（未来の請求）も含めて生成する**。実績／予定は `paid_on <= 当日` かどうかで区別する。
- 稼働区間（period）はテーブルとして持たず、リプレイ中に導出する。
- 過去の訂正は「イベント/価格を追加・編集 → 再投影（rebuild）」で行う。支払いログは毎回作り直されるため矛盾しない。
- モデルにはメソッドを置かず、関連・enum・バリデーションのみ記載。投影（リプレイ）ロジックはサービスオブジェクトに置く。
- 更新日計算は Rails の `next_month` / `next_month(3)` / `next_year` に委ねる。

## モデル構成（4テーブル）

| テーブル | 役割 | 性質 |
|---|---|---|
| `subscriptions` | サービス定義（Netflix など） | 不変寄りの設定 |
| `subscription_events` | 加入/解約/再開のライフサイクル | **正本（唱働状態）** |
| `subscription_price_changes` | 金額の履歴（初期価格・値上げ） | **正本（金額）** |
| `subscription_payments` | 支払い履歴（実績＋翌月末までの予定） | **派生キャッシュ（再生成可能）** |

イベントを「ライフサイクル（加入/解約/再開）」と「金額（いくら）」の2ストリームに分ける。これにより `price` を nullable にせず NOT NULL で扱える。

```
subscriptions (Netflix)
  events（唱働状態・ユーザーが記録）
    2026-01-01  subscribed
    2026-05-15  canceled
  price_changes（金額・ユーザーが記録）
    2026-01-01  1000
    2026-03-01  1200
        │ 2つを effective_on 順にマージしてリプレイ（投影）
        ▼
  payments（派生・自動生成）
    2026-01-01  1000
    2026-02-01  1000
    2026-03-01  1200
    2026-04-01  1200
    2026-05-01  1200
```

解約（`canceled`）以降は課金日を生成しないため、解約期間中の支払いは構造的に作られない。再開（`resumed`）すれば、その日からまた課金日が生成される。金額は常に `price_changes` の「`effective_on <= 課金日` で最新の行」を参照する。

## マイグレーション設計

### 1. subscriptions テーブル

サービスの定義情報を保持する。価格・状態は持たず、イベント側で表現する。

ドキュメント（請求書など）は Active Storage で複数添付する。専用カラムは持たず、`has_many_attached :documents` で扱う（添付情報は `active_storage_*` テーブルに保存される）。

マイグレーションに記述する主な内容:

- `t.references :user, null: false, foreign_key: true`
- `t.string :name, null: false`
- `t.string :provider_name, null: false`
- `t.string :billing_cycle, null: false`
- `t.text :memo`
- `t.timestamps`

サンプル:

```ruby
class CreateSubscriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :provider_name, null: false
      t.string :billing_cycle, null: false
      t.text :memo
      t.timestamps
    end
  end
end
```

> `documents` は Active Storage の複数添付（`has_many_attached :documents`）。`bin/rails active_storage:install` で `active_storage_blobs` / `active_storage_attachments` / `active_storage_variant_records` を用意しておく。

### 2. subscription_events テーブル

唱働状態の正本。出来事を「いつ（`effective_on`）」「何が（`event_type`）」で記録する。
金額は持たず（`subscription_price_changes` へ分離）、`event_type` は `subscribed` / `canceled` / `resumed` の3種。

マイグレーションに記述する主な内容:

- `t.references :subscription, null: false, foreign_key: true`
- `t.string :event_type, null: false`
- `t.date :effective_on, null: false`
- `t.timestamps`
- `add_index :subscription_events, [:subscription_id, :effective_on], unique: true`

サンプル:

```ruby
class CreateSubscriptionEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :subscription_events do |t|
      t.references :subscription, null: false, foreign_key: true
      t.string :event_type, null: false
      t.date :effective_on, null: false
      t.timestamps
    end

    add_index :subscription_events, [:subscription_id, :effective_on], unique: true
  end
end
```

### 3. subscription_price_changes テーブル

金額の正本（価格の履歴）。初期価格も値上げも、このテーブルの1行として表現する（最初の行＝初期価格）。ある課金日の実効価格は「`effective_on <= 課金日` の中で最新の行」。

マイグレーションに記述する主な内容:

- `t.references :subscription, null: false, foreign_key: true`
- `t.date :effective_on, null: false`
- `t.integer :price, null: false`
- `t.timestamps`
- `add_index :subscription_price_changes, [:subscription_id, :effective_on], unique: true`

サンプル:

```ruby
class CreateSubscriptionPriceChanges < ActiveRecord::Migration[8.0]
  def change
    create_table :subscription_price_changes do |t|
      t.references :subscription, null: false, foreign_key: true
      t.date :effective_on, null: false
      t.integer :price, null: false
      t.timestamps
    end

    add_index :subscription_price_changes, [:subscription_id, :effective_on], unique: true
  end
end
```

### 4. subscription_payments テーブル

イベントのリプレイで生成される派生キャッシュ。`subscription` に直接紐づく。
イベントを編集したら、その subscription 分を作り直す（delete & rebuild）。

実績だけでなく**翌月末までの予定（未来の請求）も含めて保持する**。テーブル名は「payments」だが、中身は「確定（実績）＋予定」の両方。`paid_on <= 当日` を確定（発生済み）、それより先を予定として画面で出し分ける（区別用のカラムは持たない）。

マイグレーションに記述する主な内容:

- `t.references :subscription, null: false, foreign_key: true`
- `t.date :paid_on, null: false`
- `t.integer :amount, null: false`
- `t.timestamps`
- `add_index :subscription_payments, :paid_on`

サンプル:

```ruby
class CreateSubscriptionPayments < ActiveRecord::Migration[8.0]
  def change
    create_table :subscription_payments do |t|
      t.references :subscription, null: false, foreign_key: true
      t.date :paid_on, null: false
      t.integer :amount, null: false
      t.timestamps
    end

    add_index :subscription_payments, :paid_on
  end
end
```

## ER図

```
users 1 --- N subscriptions 1 --- N subscription_events          （唱働状態・正本）
                          1 --- N subscription_price_changes   （金額・正本）
                          1 --- N subscription_payments        （派生キャッシュ）
```

## モデル定義（メソッドなし）

### User モデル

```ruby
class User < ApplicationRecord
  has_many :subscriptions, dependent: :destroy
  has_many :subscription_events, through: :subscriptions
  has_many :subscription_price_changes, through: :subscriptions
  has_many :subscription_payments, through: :subscriptions
end
```

### Subscription モデル

```ruby
class Subscription < ApplicationRecord
  belongs_to :user
  has_many :subscription_events, dependent: :destroy
  has_many :subscription_price_changes, dependent: :destroy
  has_many :subscription_payments, dependent: :destroy

  enum :billing_cycle, {
    monthly: 'monthly',
    quarterly: 'quarterly',
    yearly: 'yearly'
  }, validate: true

  has_many_attached :documents

  validates :name, :provider_name, :billing_cycle, presence: true
end
```

### SubscriptionEvent モデル

```ruby
class SubscriptionEvent < ApplicationRecord
  belongs_to :subscription

  enum :event_type, {
    subscribed: 'subscribed',
    canceled: 'canceled',
    resumed: 'resumed'
  }, validate: true

  validates :effective_on, presence: true
end
```

### SubscriptionPriceChange モデル

```ruby
class SubscriptionPriceChange < ApplicationRecord
  belongs_to :subscription

  validates :effective_on, presence: true
  validates :price, numericality: { only_integer: true, greater_than: 0 }
end
```

### SubscriptionPayment モデル

```ruby
class SubscriptionPayment < ApplicationRecord
  belongs_to :subscription

  validates :paid_on, :amount, presence: true
end
```

## 投影（リプレイ）ロジック

支払いはイベントから生成する。モデルにメソッドを置かない方針のため、サービスオブジェクトに実装する。

```ruby
# app/services/subscription_projector.rb（概念コード）
class SubscriptionProjector
  # ライフサイクルと価格の2ストリームを effective_on 順にマージして再生し、
  # payments を作り直す。必ずトランザクション内で実行。
  # as_of に未来日（例: 翌月末）を渡すと、その日までの「予定」も生成される。
  def self.rebuild(subscription, as_of: Date.current.next_month.end_of_month)
    events  = subscription.subscription_events.order(:effective_on, :created_at)
    prices  = subscription.subscription_price_changes.order(:effective_on, :created_at)

    subscription.subscription_payments.delete_all

    active   = false
    price    = nil   # 直近の price_changes から追跡
    next_due = nil

    # events と prices を effective_on 順にマージして状態を更新:
    #   price_changes -> price = row.price
    #   subscribed    -> active=true, next_due=ev.effective_on
    #   canceled      -> active=false
    #   resumed       -> active=true, next_due=ev.effective_on
    #
    # active の間、next_due <= as_of の各課金日について
    #   amount = 「 effective_on <= next_due で最新の price_changes 」の price
    #   subscription.subscription_payments.create!(paid_on: next_due, amount: amount)
    # を行い、billing_cycle に応じて next_due を
    #   monthly   -> next_due.next_month
    #   quarterly -> next_due.next_month(3)
    #   yearly    -> next_due.next_year
    # で進める。
  end
end
```

`next_renewal_on`（次の更新日）はテーブルに持たず、リプレイ結果として導出する。継続中なら、**最後の `subscribed` / `resumed` イベントの `effective_on`** を起点に `billing_cycle` で進めた日（当日を超えるまで進めた直近の課金予定日）。これはリプレイ後の `next_due` に一致する。表示を高速化したい場合のみ `subscriptions` にキャッシュ列を持たせてもよい。

## 状態と操作

| 操作 | 処理 |
|---|---|
| 新規登録 | `subscription` を作成し、`subscribed`（`effective_on`=開始日）イベントと初期価格の `price_change`（`effective_on`=開始日, `price`=初期価格）を記録 → rebuild |
| 値上げ | `price_change`（`effective_on`=改定日, `price`=新価格）を記録 → rebuild |
| 解約 | `canceled`（`effective_on`=解約日）イベントを記録 → rebuild |
| 再開 | `resumed`（`effective_on`=再開日）イベントを記録。価格を変えるなら `price_change` も追加 → rebuild |
| 過去の訂正 | 該当イベント/価格の `effective_on` / `price` を編集、または不足レコードを追加 → rebuild |
| 論理削除 | `subscription` を削除（関連 events / price_changes / payments も削除） |

過去訂正の例:
- 「もうこの時期には加入していた」→ `subscribed` の `effective_on` を前にずらす（または欠けていれば追加）→ rebuild
- 「もうこの時期には値上げされていた」→ `price_change` を該当日付で追加／日付を修正 → rebuild

いずれの操作も「イベントを直す → rebuild」の一方向。payments は再生成されるので矛盾しない。

## バッチ運用方針

- 毎日1回、日次バッチを実行。
- 各 subscription について `SubscriptionProjector.rebuild(subscription, as_of: Date.current.next_month.end_of_month)` を実行し、**翌月末まで**の payments（実績＋予定）を最新化する。地平線（どこまで未来を生成するか）は定数化して表示・バッチで揃える。
- 継続中（最後のイベントが `canceled` でない）なら、地平線までの各課金日について payment が生成される。`paid_on <= 当日` が実績、それより先が予定。
- 日次で実行するため地平線も毎日1日ずつ前進し、常に「今月〜来月」が埋まった状態が保たれる。
- 更新日計算は Rails の `next_month` / `next_month(3)` / `next_year` を使用。

## 整合性の担保

- rebuild は必ずトランザクション内で実行（delete & recreate をアトミックに）。
- payments は派生キャッシュなので、ユーザーが直接編集しない（イベント/価格経由でのみ変更）。
- イベント・価格は追記が基本。誤記録の訂正は該当レコードの編集で行い、変更履歴を残したい場合は `paper_trail` / `logidze` で監査ログを取る。

## 仕様決定（確定）

- [x] 1ユーザーが複数サブスクを登録可能
- [x] イベントソーシングを採用（正本は `subscription_events` と `subscription_price_changes`）
- [x] ライフサイクルと金額を別テーブルに分離（`price` は NOT NULL）
- [x] 支払い履歴 `subscription_payments` はイベントから生成する派生キャッシュ（実績＋翌月末までの予定を含む。実績／予定は `paid_on <= 当日` で区別）
- [x] 稼働区間（period）はテーブルを持たず、リプレイ中に導出
- [x] ライフサイクルは `subscribed` / `canceled` / `resumed` で表現、金額は `price_changes` で表現
- [x] 過去の訂正はイベント/価格の編集 + rebuild で反映
- [x] billing_cycle は `monthly` / `quarterly` / `yearly` の enum
- [x] 価格は JPY（円）固定・integer、`subscription_price_changes` が保持
- [x] documents は Active Storage（`has_many_attached :documents`）で複数添付
- [x] memo は text 型（文字数制約はフロント側）
