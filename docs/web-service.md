# 画像生成Webサービス 設計書

## 概要
CLIツール `generate-images.js` のワークフローをWebサービス化。
ベース画像+プロンプトで画像生成→良いものを選んで再生成、を繰り返す。
モバイル対応が主目的。

## 技術スタック
- Express + better-sqlite3 + multer
- バニラHTML/JS/CSS
- 既存の `@google/generative-ai` を流用

## DB (SQLite)

```sql
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  parent_id TEXT,
  prompt TEXT,
  created_at TEXT NOT NULL,
  is_uploaded INTEGER DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES images(id)
);
```

## API

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/images` | ルート画像一覧 |
| GET | `/api/images/:id` | 画像詳細 + 親・子画像 |
| POST | `/api/upload` | ベース画像アップロード |
| POST | `/api/generate` | 画像生成 (parent_id, prompt, count) |
| GET | `/uploads/:filename` | 画像ファイル配信 |

## ファイル構成

```
server.js
public/
  index.html
  style.css
  app.js
uploads/
```

## 画面

### ギャラリー（トップ）
- ルート画像をグリッド表示
- 各画像に子孫数バッジ
- 「新規生成」「画像アップロード」ボタン

### 画像詳細（画像クリック時）
- 選択画像を大きく表示 + プロンプト
- 親画像サムネイル
- 子画像一覧グリッド
- 「この画像をベースに生成」→ プロンプト入力+枚数指定

### レスポンシブ
- モバイル2列、デスクトップ4列
