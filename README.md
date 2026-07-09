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
- 送信系ツールは既定で無効（設定で明示的に有効化）

## 利用開始

### 必要条件

- Node.js 22.15 以上（手動セットアップの場合。MCPB でのインストールでは macOS / Windows 環境向けに Node.js がバンドルされます）
- blastengine アカウント

### アカウントの準備

ご利用には blastengine のアカウントが必要です。お持ちでない場合、まずは[無料トライアル申し込みフォーム](https://app.engn.jp/be/order/request-form)から登録してください。

登録後、[管理画面](https://app.engn.jp/be/admin/login) でログイン ID と API キーを確認できます。

### インストール（MCPB — Claude Desktop 向け・推奨）

Claude Desktop をお使いの場合は、MCPB バンドル（`.mcpb` ファイル）で簡単にインストールできます:

1. [GitHub Releases](https://github.com/rakus-lc/blastengine-mcp/releases/latest) から
   `blastengine-mcp-server-<バージョン>.mcpb` をダウンロードします
2. ダウンロードしたファイルをダブルクリックするか、Claude Desktop の
   「設定 → エクステンション」画面へドラッグ＆ドロップします
3. 拡張の設定画面で blastengine のログイン ID と API キーを入力します
   （認証情報は OS のキーチェーンに保存されます）
4. 必要に応じて送信系機能（トランザクション送信・一斉配信・CSV インポート）の
   トグルを有効化します（既定はすべて無効です）

> **更新について**: 手動でインストールした MCPB は自動更新されません。新しい
> バージョンがリリースされたら、Releases から新しい `.mcpb` をダウンロードして
> 再度インストール（上書き）してください。設定済みの認証情報は引き継がれます。

### インストール（手動セットアップ）

リポジトリをクローンし、ビルドします:

```sh
npm install
npm run build
```

stdio のエントリポイント `dist/index.js` が生成されます。

### MCP クライアント設定

お使いの MCP クライアントの設定ファイル（例: Claude Desktop の場合は
`claude_desktop_config.json`）に、ビルドしたエントリポイントを次のように追加します:

```json
{
  "mcpServers": {
    "blastengine": {
      "command": "node",
      "args": ["/path/to/blastengine-mcp/dist/index.js"],
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
の機能は既定で無効です。MCPB インストールの場合は拡張の設定画面のトグルで、手動セットアップ
の場合は対応する環境変数を `true` にして、それぞれ有効化してください。

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

以下は手動セットアップ向けの一覧です。MCPB インストールでは大半の項目を拡張の設定画面
から入力・切り替えできます（`BLASTENGINE_CLIENT_HEADERS` を除く。詳細は「送信される
識別情報について」を参照）。

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
| `BLASTENGINE_ACCEPT_LANGUAGE` | `ja-JP` | API エラーメッセージの言語（`ja-JP` または `en-US`） |
| `BLASTENGINE_LOG_LEVEL` | `info` | ログ出力レベル（`silent` / `error` / `warn` / `info` / `debug`） |
| `BLASTENGINE_CLIENT_HEADERS` | `true` | 利用状況把握のための識別ヘッダ（mcp 経由・バージョン・ツール名）の送信可否。本文・宛先・認証情報は含まれません。詳細は「送信される識別情報について」を参照 |

※ `BLASTENGINE_BULK_MAX_RECIPIENTS` に 50 を超える値を指定しても blastengine API 側で弾かれます。50 通を超える宛先を登録したい場合は `blastengine_bulk_import_recipients_csv` を使ってください。

## 社内ネットワーク（HTTPS 検査）

HTTPS 検査プロキシ環境では、Node.js は既定で社内ルート CA を信頼せず、API 呼び出しが
証明書エラー（`SELF_SIGNED_CERT_IN_CHAIN`）で失敗します。対処するには、OS の証明書スト
ア（IT 部門が社内 CA を導入している場所）を Node.js に信頼させる設定が必要です。

**MCPB でインストールした場合**: この設定は自動で適用されます。
それでも証明書エラーが出る場合は、お使いの Claude Desktop がこの設定に対応していないため、
下記の手動セットアップをご利用ください。

**手動セットアップの場合**: `node` の起動引数に `--use-system-ca` を追加してください:

```json
{
  "mcpServers": {
    "blastengine": {
      "command": "node",
      "args": ["--use-system-ca", "/path/to/blastengine-mcp/dist/index.js"],
      "env": {
        "BLASTENGINE_LOGIN_ID": "...",
        "BLASTENGINE_API_KEY": "..."
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

認証情報はローカルプロセス内に留まり、ログ出力されません。
送信系ツールは実際にメールを送信するため、最小権限の API キーを使い、信頼できる環境で
実行してください。認証情報やトークンなどの機微な情報を GitHub Issue に記載しないでください。

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

手動セットアップの場合、`BLASTENGINE_CLIENT_HEADERS=false` を設定すると、上記
`X-Blastengine-*` ヘッダの付与を無効化できます（MCPB インストールではこの設定項目は
提供していません）。なお `User-Agent` はこの設定に関わらず常に付与されます。

## プライバシーポリシー（Privacy Policy）

認証情報（ログイン ID・API キー・Bearer トークン）はローカルプロセス内でのみ使用され、
本サーバーの外部（AI クライアントなど）には送信されません（詳細は「セキュリティ」を参照）。

一方、メール本文・宛先・CSV 内容・配信ログなど、ツールの入力および実行結果は、ご利用の
MCP クライアント（AI エージェント）とのやり取りの一部として扱われます。Claude Desktop
のようにクラウド型の AI をお使いの場合、これらの内容は当該 AI クライアントの提供元にも
送信されます。その扱いについては、お使いの AI クライアントのプライバシーポリシーをご確認
ください。

本サーバーから blastengine API へのリクエスト（認証情報・メール本文・宛先や、識別ヘッダ。
詳細は「送信される識別情報について」を参照）については、提供元である株式会社ラクスライト
クラウドの個人情報保護方針に従います。本方針は姉妹サービス blastmail と共通です:

- <https://blastmail.jp/privacy/>

## コントリビュート

ご要望・ご質問・不具合の報告は GitHub Issue でお願いします。外部からの Pull Request は
受け付けていません。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
