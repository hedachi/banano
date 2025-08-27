# Banano Image Generator

Gemini APIを使用してプロンプトベースで複数の画像を並列生成するCLIツール

## 機能

- プロンプトベースの画像生成
- 並列実行による高速処理（デフォルト10枚同時生成）
- カスタマイズ可能な生成枚数

## セットアップ

1. Google AI Studioで API キーを取得
   https://aistudio.google.com/app/apikey

2. `.env`ファイルを作成してAPIキーを設定
   ```bash
   echo "GOOGLE_API_KEY=your-api-key-here" > .env
   ```

3. パッケージをインストール
   ```bash
   npm install
   npm install -g .
   ```

## 使い方

```bash
generate-images <画像パス> <プロンプト> [生成数]
```

### 引数

1. **画像パス** - ベースとなる入力画像のパス
2. **プロンプト** - 画像生成の指示文
3. **生成数** - 生成する画像の数（デフォルト: 10）

### 例

```bash
# 10枚の画像を生成（デフォルト）
generate-images input.jpg "transform into cyberpunk style"

# 5枚の画像を生成
generate-images photo.png "add fantasy elements" 5

# 20枚の画像を並列生成
generate-images base.jpg "make it look like oil painting" 20
```

## 出力

生成された画像は入力画像と同じディレクトリに以下の形式で保存されます：
- `{元のファイル名}_generated_1.{拡張子}`
- `{元のファイル名}_generated_2.{拡張子}`
- ...

## サポートする画像形式

- JPEG/JPG
- PNG
- GIF
- WebP

## ライセンス

MIT