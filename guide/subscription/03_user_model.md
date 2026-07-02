# 03. ユーザーモデル（認証）

サブスクリプションは「ユーザーごと」に管理する（[02_データモデル](./02_data_model.md) の `users 1 --- N subscriptions`）。
そのため、まず**ユーザー登録とログインの仕組み**を用意する。Rails 8 標準の `authentication` ジェネレーターを土台にする。

## 作りたいフロー

```
サインアップ（新規登録）
  └ メールアドレスを入力
        │  この時点では「仮登録」。パスワードはまだ無い
        ▼
  仮登録完了メールを送信
        └ 本文の「パスワード設定リンク」（署名付きトークン）をクリック
              │
              ▼
        パスワード設定画面でパスワードを入力 → 本登録完了
              │
              ▼
        ログイン（メールアドレス＋パスワード）
```

> **仮パスワードは不要です。** メール本文のリンクに**署名付きトークン**（有効期限つき）を埋め込むため、リンク自体が「本人確認」の役割を果たす。ユーザーはリンクを踏んだ先で**最初のパスワードを自分で決めるだけ**でよい。仮パスワードを発行・通知する方式は、メール盗み見リスクと「仮パスto新パス」の二度手間があるため採用しない（このリンク方式は Rails 標準のパスワードリセットと同じ仕組み）。

## 方針まとめ

- 認証の土台は `bin/rails generate authentication` が生成するものをそのまま使う（ログイン／ログアウト＋パスワードリセット）。
- ジェネレーターは**新規登録（サインアップ）画面は作らない**ので、そこは自分で追加する。
- サインアップは「メールアドレスだけで仮登録 → メールのリンクでパスワード設定」の**パスワードレス初期登録**にする（＝仮パスワード不要）。
- 表示名として `name` カラムを1つ足す（シードが `name` を前提にしているため）。

---

## 1. authentication ジェネレーターを実行する

```bash
bin/rails generate authentication
```

これで以下が生成される（Rails 8 標準）。

| 種類 | ファイル | 役割 |
|---|---|---|
| モデル | `app/models/user.rb` | `has_secure_password`・`email_address` の正規化 |
| モデル | `app/models/session.rb` | ログインセッション（`belongs_to :user`） |
| モデル | `app/models/current.rb` | リクエスト単位の `Current.user` / `Current.session` |
| Concern | `app/controllers/concerns/authentication.rb` | `before_action` 認証・`require_authentication` など |
| コントローラ | `app/controllers/sessions_controller.rb` | ログイン（`new`/`create`）・ログアウト（`destroy`） |
| コントローラ | `app/controllers/passwords_controller.rb` | パスワード再設定（`new`/`create`/`edit`/`update`） |
| ビュー | `app/views/sessions/new.html.erb` | ログインフォーム |
| ビュー | `app/views/passwords/new.html.erb` / `edit.html.erb` | 再設定メール依頼・新パスワード入力 |
| メーラー | `app/mailers/passwords_mailer.rb` + `app/views/passwords_mailer/*` | 再設定リンクの送信 |
| マイグレーション | `db/migrate/*_create_users.rb` / `*_create_sessions.rb` | `users` / `sessions` テーブル |
| ルーティング | `config/routes.rb` に追記 | `resource :session` / `resources :passwords` |
| Gem | `Gemfile` に `bcrypt` | パスワードハッシュ化 |

生成される `users` テーブルは `email_address` と `password_digest` のみ。追記されるルートはこの形：

```ruby
# config/routes.rb（ジェネレーターが追記する分）
resource  :session
resources :passwords, param: :token
```

> ジェネレーターは**ログインとパスワードリセットのみ**を用意する。新規登録（サインアップ）画面は含まれないので、後半（手順4）で追加する。

---

## 2. 表示名 `name` カラムを足す

シード（[db/seeds/01_users.rb](../../db/seeds/01_users.rb)）が `name:` を使っているため、`users` に `name` を追加する。
`create_users` マイグレーションに直接足すか、追加マイグレーションを作る。ここでは生成された `create_users` に1行足す。

```ruby
# db/migrate/*_create_users.rb
class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name, null: false                       # ← 追加
      t.string :email_address, null: false
      t.string :password_digest, null: false
      t.timestamps
    end
    add_index :users, :email_address, unique: true
  end
end
```

`User` モデルに関連とバリデーションを足す（[02_データモデル](./02_data_model.md#user-モデル) の関連もここでまとめる）。

```ruby
# app/models/user.rb
class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  # サブスクリプション関連（02 の定義）
  has_many :subscriptions, dependent: :destroy
  has_many :subscription_events, through: :subscriptions
  has_many :subscription_price_changes, through: :subscriptions
  has_many :subscription_payments, through: :subscriptions

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :name, presence: true
  validates :email_address, presence: true, uniqueness: true
end
```

マイグレーションを流す：

```bash
bin/rails db:migrate
```

---

## 3. 既定のログイン／ログアウトを確認する

ジェネレーターの生成物だけで、ログイン・ログアウトは動く。

- `GET  /session/new` … ログインフォーム
- `POST /session`     … ログイン（`email_address` + `password`）
- `DELETE /session`   … ログアウト

`ApplicationController` は `Authentication` concern を include しており、**既定で全ページが認証必須**になる。公開したいページ（例: サインアップ）は各コントローラで `allow_unauthenticated_access` を宣言して除外する。

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  include Authentication
end
```

シードのユーザーでログインできることを確認：

```bash
bin/rails db:seed          # user1@example.com / Password1234 を作成
bin/rails server           # /session/new からログイン
```

---

## 4. サインアップ（新規登録）を「メールリンク方式」で追加する

ジェネレーターに無い新規登録を追加する。ポイントは **登録時にパスワードを取らない**こと。

### 4.1 全体像

```
POST /sign_up   … メールアドレス（+ name）だけ受け取り、パスワード無しで User を作成（仮登録）
      ↓
仮登録完了メールを送信（パスワード設定リンク = 署名付きトークン付き）
      ↓
GET  /set_password/:token  … トークンを検証し、パスワード入力フォームを表示
      ↓
PATCH /set_password/:token … パスワードを保存（本登録完了）→ そのままログイン
```

### 4.2 トークン発行の準備（`generates_token_for`）

Rails の `generates_token_for` を使うと、DB にトークン列を持たずに**有効期限つき署名トークン**を発行できる。`password_digest` を含めることで「パスワードを設定したら（＝digest が変わったら）そのリンクは失効する」性質になる。

```ruby
# app/models/user.rb に追記
class User < ApplicationRecord
  # ...（前掲の has_secure_password 等）...

  # パスワード設定用トークン（24時間有効・設定済みになると失効）
  generates_token_for :password_setup, expires_in: 24.hours do
    password_salt&.last(10)
  end
end
```

> `password_salt` は `has_secure_password` が提供する。パスワードが設定・変更されると値が変わるため、リンクは自動的に一度きり（失効）になる。仮登録直後（未設定）でも発行できる。

### 4.3 ルーティング

```ruby
# config/routes.rb（自分で追記する分）
get  "sign_up",             to: "registrations#new"
post "sign_up",             to: "registrations#create"
get  "set_password/:token", to: "registrations#edit",   as: :set_password
patch "set_password/:token", to: "registrations#update"
```

### 4.4 RegistrationsController

```ruby
# app/controllers/registrations_controller.rb
class RegistrationsController < ApplicationController
  allow_unauthenticated_access   # サインアップは未ログインで通す

  # メールアドレス（+ name）だけで仮登録
  def new
    @user = User.new
  end

  def create
    @user = User.new(sign_up_params)
    # パスワード未設定でも保存できるよう、create 時は password バリデーションを外す
    if @user.save(context: :sign_up)
      RegistrationsMailer.with(user: @user).welcome.deliver_later
      redirect_to new_session_path, notice: "確認メールを送りました。メール内のリンクからパスワードを設定してください。"
    else
      render :new, status: :unprocessable_entity
    end
  end

  # メールのリンク先：トークンを検証してパスワード入力フォームを表示
  def edit
    @user = User.find_by_token_for(:password_setup, params[:token])
    redirect_to(new_session_path, alert: "リンクの有効期限が切れています。") and return unless @user
  end

  def update
    @user = User.find_by_token_for(:password_setup, params[:token])
    redirect_to(new_session_path, alert: "リンクの有効期限が切れています。") and return unless @user

    if @user.update(password_params)
      start_new_session_for @user   # Authentication concern が提供
      redirect_to root_path, notice: "パスワードを設定しました。ログインしました。"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def sign_up_params
    params.require(:user).permit(:name, :email_address)
  end

  def password_params
    params.require(:user).permit(:password, :password_confirmation)
  end
end
```

`start_new_session_for` は生成された `Authentication` concern に含まれるメソッド。名称が異なる場合は `app/controllers/concerns/authentication.rb` を確認して合わせる。

### 4.5 「パスワード未設定でも保存できる」ようにする

`has_secure_password` は既定でパスワード必須。仮登録（＝パスワード未設定で保存）を許すため、**保存コンテキストで出し分ける**。

```ruby
# app/models/user.rb
has_secure_password validations: false
validates :password, presence: true, confirmation: true, length: { minimum: 8 },
          unless: -> { validation_context == :sign_up }
```

- 仮登録: `@user.save(context: :sign_up)` … パスワード検証をスキップ
- パスワード設定: 通常の `update` … パスワード検証あり（8文字以上・confirmation 一致）

### 4.6 メーラー（仮登録完了 → パスワード設定リンク）

```ruby
# app/mailers/registrations_mailer.rb
class RegistrationsMailer < ApplicationMailer
  def welcome
    @user  = params[:user]
    @token = @user.generate_token_for(:password_setup)
    mail to: @user.email_address, subject: "仮登録が完了しました（パスワードを設定してください）"
  end
end
```

```erb
<%# app/views/registrations_mailer/welcome.html.erb %>
<p><%= @user.name %> さん、仮登録が完了しました。</p>
<p>以下のリンクからパスワードを設定すると本登録が完了します（有効期限24時間）。</p>
<p><%= link_to "パスワードを設定する", set_password_url(token: @token) %></p>
```

```text
<%# app/views/registrations_mailer/welcome.text.erb %>
<%= @user.name %> さん、仮登録が完了しました。

以下のリンクからパスワードを設定すると本登録が完了します（有効期限24時間）。
<%= set_password_url(token: @token) %>
```

### 4.7 ビュー

```erb
<%# app/views/registrations/new.html.erb（サインアップ） %>
<h1>新規登録</h1>
<%= form_with model: @user, url: sign_up_path do |f| %>
  <%= f.label :name %><%= f.text_field :name %>
  <%= f.label :email_address %><%= f.email_field :email_address %>
  <%= f.submit "確認メールを送る" %>
<% end %>
<p><%= link_to "ログインはこちら", new_session_path %></p>
```

```erb
<%# app/views/registrations/edit.html.erb（パスワード設定） %>
<h1>パスワードを設定</h1>
<%= form_with model: @user, url: set_password_path(token: params[:token]), method: :patch do |f| %>
  <%= f.label :password, "パスワード（8文字以上）" %><%= f.password_field :password %>
  <%= f.label :password_confirmation, "パスワード（確認）" %><%= f.password_field :password_confirmation %>
  <%= f.submit "パスワードを設定して開始" %>
<% end %>
```

---

## 5. 開発環境でメールを確認する

`deliver_later` の送信内容はローカルでは実際に送らず、`letter_opener` などで確認するのが手軽。
（本番のメール配信サービス選定は [README の未決定項目](./README.md#-未決定の項目) を参照。ここでは開発時のプレビューのみ。）

```ruby
# config/environments/development.rb
config.action_mailer.delivery_method = :letter_opener
config.action_mailer.default_url_options = { host: "localhost", port: 3000 }
```

---

## まとめ

| 機能 | 実装元 |
|---|---|
| ログイン／ログアウト | ジェネレーター生成物（`sessions`） |
| パスワードリセット（既存ユーザー） | ジェネレーター生成物（`passwords`） |
| サインアップ（新規登録・メールリンクでパスワード設定） | 手動追加（`registrations`＋`generates_token_for`） |
| 表示名 `name` | `users` に追加 |

**仮パスワードは発行しない。** 署名付きトークンのリンクで本人確認を代替し、ユーザーは設定画面で最初のパスワードを自分で決める（Rails 標準のパスワードリセットと同じ仕組みを、新規登録に流用した形）。
