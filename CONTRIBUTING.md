# コントリビュート

blastengine MCP サーバーへの関心をお寄せいただきありがとうございます。

## コントリビューションの方針

blastengine MCP サーバーでは Issue ベースのコントリビューションを採用しています。

歓迎していること:

- バグ報告: 再現手順を含めた Issue の作成
- 機能要望: ユースケースを含めた提案 Issue の作成
- フィードバック: 使い勝手や改善点についてのコメント
- 質問・議論: Issue での質問

外部からの Pull Request は受け付けておりません。コードの変更を提案する場合は、まず Issue を
作成してください。これは、プロジェクトの品質と一貫性を維持するための方針です。コードは MIT
ライセンスのため、自由に fork できます。

なお、認証情報やトークンなどの機微な情報は Issue に記載しないでください。

## コードの取り扱い（fork・監査）

```sh
npm ci
npm run build
npm run typecheck
npm test
```

### プロジェクト構成

- `src/` — TypeScript ソース
  - `index.ts` — stdio エントリポイント
  - `server.ts` — MCP ツールの登録
  - `operations.ts` — ツールごとの処理。機能ゲートはここで強制
  - `schemas.ts` — Zod 入力スキーマ（クライアントへツール入力スキーマとして提示される）
  - `blastengine-client.ts` — HTTP クライアント、認証ヘッダ、エラー変換
  - `config.ts` — 環境変数の設定
- `tests/` — vitest のユニット / HTTP モックテストと stdio スモークテスト

### 維持すべき設計ルール

- MCP トランスポートはローカル stdio を維持する。
- **stdout は MCP JSON-RPC 専用。** ログを stdout に出さず、stderr（`Logger`）を使う。
- Bearer トークン、メール本文、宛先一覧、件名、CSV 内容、ユーザープロンプトをログ出力しない。
- 送信系ツールは既定で無効のまま、`BLASTENGINE_ENABLE_*` ゲートの内側に維持する。
- blastengine API の `POST` / `PATCH` に自動リトライを追加しない。
- ツールの入力を変更する場合は `schemas.ts` の Zod スキーマを更新し（ここの説明文は AI
  クライアントに提示される）、テストを追加する。HTTP モックを使い、実際の認証情報や宛先
  アドレスをフィクスチャに入れない。

## メンテナ向けリリースチェック

1. `package.json`・`package-lock.json`・`manifest.json` のバージョンを揃えて更新
   （`src/version.ts` は `package.json` から自動導出）
2. 以下を実行して問題がないことを確認:

```sh
npm run typecheck
npm test
npm_config_cache=/tmp/npm-cache npm pack --dry-run
npm run build:mcpb
```

3. `npm pack --dry-run` の出力に内部メモ・認証情報・実アドレスを含むフィクスチャ・`.env` が含まれないことを確認
4. `build/*.mcpb` が生成されることを確認
5. `v<バージョン>` タグを push — Release ワークフローが CI（typecheck・test・pack）を再実行し、MCPB バンドル・チェックサム・来歴attestationを含むドラフトリリースを作成します
6. GitHub Releases でドラフトを確認し、公開
