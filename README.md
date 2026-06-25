# blastengine MCP Server

blastengine 公式の MCP サーバーです。[blastengine](https://blastengine.jp/) は、
トランザクションメール・一斉配信・配信ログ確認に対応した国内向けのメール配信サービスです。

本サーバーはローカル stdio の [MCP](https://modelcontextprotocol.io/) として、blastengine
API の一部の操作を MCP 対応 AI クライアントから利用できるようにします。
認証情報はローカルプロセス内に留まり、ログ出力されません。送信系ツールは既定で無効です。

## 主な機能

- トランザクションメールの送信（1 宛先）
- 一斉配信（下書き作成・宛先登録・プレビュー・即時/予約の確定）
- CSV ファイルからの宛先一括インポート
- 配信の検索・詳細取得
- メール配信ログの検索・詳細取得
- 使用量の確認（最新・月次）
- 送信系ツールは既定で無効（環境変数で明示的に有効化）

## 利用開始

### 必要条件

- Node.js 22 LTS 以上
- blastengine アカウント

### アカウントの準備

ご利用には blastengine のアカウントが必要です。お持ちでない場合、まずは[無料トライアル申し込みフォーム](https://app.engn.jp/be/order/request-form)から登録してください。

登録後、[管理画面](https://app.engn.jp/be/admin/login) でログイン ID と API キーを確認できます。

### インストール（手動セットアップ）

リポジトリをクローンし、ビルドします:

```sh
npm install
npm run build
```

stdio のエントリポイント `dist/index.js` が生成されます。

### MCP クライアント設定

お使いの MCP クライアントの設定に、ビルドしたエントリポイントを追加します:

1. MCP 設定を開きます
2. MCP 設定セクションに移動します
3. 次の設定を追加します：

```json
{
  "mcpServers": {
    "blastengine": {
      "command": "node",
      "args": ["/path/to/blastengine_mcp/dist/index.js"],
      "env": {
        "BLASTENGINE_LOGIN_ID": "...",
        "BLASTENGINE_API_KEY": "...",
        "BLASTENGINE_ENABLE_SEND": "false",
        "BLASTENGINE_ENABLE_BULK": "false",
        "BLASTENGINE_ENABLE_CSV_IMPORT": "false"
      }
    }
  }
}
```

認証は `BLASTENGINE_LOGIN_ID` と `BLASTENGINE_API_KEY` を推奨します。サーバーは Bearer
トークンをローカルで生成し（`login_id + api_key` の SHA-256 を小文字 hex 化して Base64）、
ログには出力しません。生成済みの `BLASTENGINE_BEARER_TOKEN` も利用でき、設定時はそちらが
優先されます。認証情報はリポジトリや `.env` にコミットしないでください。

## 機能モード（送信系の有効化）

サーバーは参照のみの状態で起動します。メール送信は取り消せないため（誤配信リスク）、送信系
の機能は既定で無効で、対応する環境変数を `true` にして初めて有効になります。

- `BLASTENGINE_ENABLE_SEND` … トランザクション送信に必要
- `BLASTENGINE_ENABLE_BULK` … 一斉配信に必要
- `BLASTENGINE_ENABLE_CSV_IMPORT` … CSV 宛先インポートに必要

参照系（配信検索・ログ・使用量など）は、認証情報があれば常時利用できます。

## 使用例

MCP サーバーを AI エージェントに設定すると、会話の中で直接ツールを使えます。以下は例です:

- 直近の配信を確認

```
先週の配信結果を一覧で見せてください。
```

- 特定の宛先のログを確認

```
foo@example.com 宛のメール配信ログを表示してください。
```

- 使用量の確認

```
今月のメール使用量を教えてください。
```

- トランザクションメールの送信（要 `BLASTENGINE_ENABLE_SEND=true`）

```
yamada@example.com に件名「ご請求のご案内」で本文を作成して送信してください。
```

- 一斉配信のプレビュー（要 `BLASTENGINE_ENABLE_BULK=true`）

```
配信ID 123 の一斉配信の内容をプレビューしてください。
```

## 利用可能なツール

参照系ツールは認証情報が必要ですが副作用はありません。送信系ツールは上記の機能フラグで
ゲートされています。

| ツール | 種別 | 必要条件 |
| --- | --- | --- |
| `blastengine_deliveries_list` | 参照 | 認証情報 |
| `blastengine_delivery_get` | 参照 | 認証情報 |
| `blastengine_mail_results_list` | 参照 | 認証情報 |
| `blastengine_mail_log_get` | 参照 | 認証情報 |
| `blastengine_usage_latest_get` | 参照 | 認証情報 |
| `blastengine_usage_month_get` | 参照 | 認証情報 |
| `blastengine_bulk_import_status` | 参照 | 認証情報 |
| `blastengine_bulk_import_error_download` | 参照（ローカルにファイル保存） | 認証情報 |
| `blastengine_bulk_preview` | 参照（情報提示のみ） | `BLASTENGINE_ENABLE_BULK` |
| `blastengine_send_transaction` | 書き込み（送信） | `BLASTENGINE_ENABLE_SEND` |
| `blastengine_bulk_begin` | 書き込み | `BLASTENGINE_ENABLE_BULK` |
| `blastengine_bulk_update_recipients` | 書き込み | `BLASTENGINE_ENABLE_BULK` |
| `blastengine_bulk_commit_scheduled` | 書き込み（送信） | `BLASTENGINE_ENABLE_BULK` |
| `blastengine_bulk_commit_immediate` | 書き込み（送信） | `BLASTENGINE_ENABLE_BULK` |
| `blastengine_bulk_import_recipients_csv` | 書き込み | `BLASTENGINE_ENABLE_BULK` + `BLASTENGINE_ENABLE_CSV_IMPORT` |

## 環境変数

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `BLASTENGINE_LOGIN_ID` | なし | Bearer トークン生成に使う blastengine ログイン ID |
| `BLASTENGINE_API_KEY` | なし | Bearer トークン生成に使う blastengine API キー |
| `BLASTENGINE_BEARER_TOKEN` | なし | 生成済み Bearer トークン。設定時はログイン ID / API キーより優先 |
| `BLASTENGINE_ENABLE_SEND` | `false` | トランザクション送信を有効化 |
| `BLASTENGINE_ENABLE_BULK` | `false` | 一斉配信ツールを有効化 |
| `BLASTENGINE_ENABLE_CSV_IMPORT` | `false` | CSV 宛先インポートを有効化 |
| `BLASTENGINE_BULK_MAX_RECIPIENTS` | `50` | `blastengine_bulk_update_recipients` の最大宛先数 |
| `BLASTENGINE_TIMEOUT_MS` | `30000` | HTTP タイムアウト（ミリ秒） |
| `BLASTENGINE_ACCEPT_LANGUAGE` | `ja-JP` | API リクエストの `Accept-Language`（`ja-JP` または `en-US`） |
| `BLASTENGINE_LOG_LEVEL` | `info` | stderr 診断ログのレベル（`silent` / `error` / `warn` / `info` / `debug`） |
| `BLASTENGINE_CLIENT_HEADERS` | `true` | 利用状況把握のための識別ヘッダ（mcp 経由・バージョン・ツール名）の送信可否。本文・宛先・認証情報は含まれません。詳細は「送信される識別情報について」を参照 |

※ `BLASTENGINE_BULK_MAX_RECIPIENTS` に 50 を超える値を指定しても blastengine API 側で弾かれます。50 通を超える宛先を登録したい場合は `blastengine_bulk_import_recipients_csv` を使ってください。

## 社内ネットワーク（HTTPS 検査）

HTTPS 検査プロキシ環境では、Node.js は既定で社内ルート CA を信頼せず、API 呼び出しが
`SELF_SIGNED_CERT_IN_CHAIN` で失敗します。サーバーの `env` に `NODE_USE_SYSTEM_CA=1` を
追加し、OS の証明書ストア（IT が社内 CA を導入している場所）を信頼させてください
（`node --use-system-ca` での起動と同等です）:

```json
{
  "mcpServers": {
    "blastengine": {
      "command": "node",
      "args": ["/path/to/blastengine_mcp/dist/index.js"],
      "env": {
        "BLASTENGINE_LOGIN_ID": "...",
        "BLASTENGINE_API_KEY": "...",
        "NODE_USE_SYSTEM_CA": "1"
      }
    }
  }
}
```

## トラブルシューティング

| エラーコード / 症状 | 原因と対処 |
| --- | --- |
| `missing_credentials` | `BLASTENGINE_LOGIN_ID` + `BLASTENGINE_API_KEY`、または `BLASTENGINE_BEARER_TOKEN` を設定 |
| `send_disabled` / `bulk_disabled` / `csv_import_disabled` | その機能が無効。対応する `BLASTENGINE_ENABLE_*` を設定 |
| `SELF_SIGNED_CERT_IN_CHAIN` | HTTPS 検査環境。上記「社内ネットワーク（HTTPS 検査）」を参照 |
| クライアントが接続できない | stdout は MCP JSON-RPC 専用（診断は stderr）。`command` / `args` がビルド済みの `dist/index.js` を指しているか確認 |

## セキュリティ

認証情報はローカルプロセス内に留まり、メール本文・宛先一覧・CSV 内容・プロンプトとともに
ログ出力されません。送信系ツールは実際にメールを送信するため、最小権限の API キーを使い、
信頼できる環境で実行してください。認証情報やトークンなどの機微な情報を GitHub Issue に記載
しないでください。

## 送信される識別情報について
 
本サーバーは blastengine API を呼び出す際、利用状況の把握のために、リクエストが MCP 経由で
あることを示す識別ヘッダを付与します。これらのヘッダにメール本文・宛先・件名・認証情報・
プロンプトは含まれません。
 
常に付与されるヘッダ:
 
- `User-Agent: blastengine-mcp/<version>` … MCP サーバー経由であることとそのバージョン
`BLASTENGINE_CLIENT_HEADERS=true`（既定）のとき、追加で次のヘッダを付与します:
 
- `X-Blastengine-Client: mcp`
- `X-Blastengine-Client-Version: <version>`
- `X-Blastengine-MCP-Tool: <ツール名>` … 呼び出したツール名（例: `blastengine_deliveries_list`）
- `X-Blastengine-MCP-Mode: <モード>` … 一斉配信など一部操作の種別
`BLASTENGINE_CLIENT_HEADERS=false` を設定すると、上記 `X-Blastengine-*` ヘッダの付与を
無効化できます。なお `User-Agent` はこの設定に関わらず常に付与されます。

## コントリビュート

ご要望・ご質問・不具合の報告は GitHub Issue でお願いします。外部からの Pull Request は
受け付けていません。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
