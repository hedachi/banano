# Fantasy Background Transformer 🏰✨

Gemini Flash 8B（旧nano-banana）を使用して画像の背景をファンタジー世界に変換するCLIツール

## 🚀 セットアップ

### 1. APIキーの取得
[Google AI Studio](https://aistudio.google.com/app/apikey)からAPIキーを取得

### 2. 環境設定
```bash
# .envファイルを作成
cp .env.example .env

# .envファイルを編集してAPIキーを設定
# GOOGLE_API_KEY=your_api_key_here
```

### 3. 依存関係のインストール
```bash
npm install
```

## 🎨 使い方

```bash
# 基本的な使用方法
node fantasy-bg.js your_image.jpg

# 出力ファイル名を指定
node fantasy-bg.js your_image.jpg -o custom_output.jpg

# グローバルにインストールして使う場合
npm link
fantasy-bg your_image.jpg
```

## 📝 機能

- 🔍 Gemini Flash 8Bで画像を分析
- 🎨 主要な被写体を識別して詳細な説明を生成
- 🏰 ファンタジー世界の背景プロンプトを自動生成
- ✨ 画像にファンタジー風のカラーフィルターとエフェクトを適用

## 📌 注意事項

現在のバージョンでは、Gemini APIを使用して：
1. 画像の分析と被写体の認識
2. ファンタジー背景のプロンプト生成
3. 基本的なカラーフィルターとエフェクトの適用

実際の背景置換には、以下のような画像生成APIが必要です：
- Stable Diffusion API
- DALL-E API
- Midjourney API

生成されたプロンプトをこれらのサービスで使用することで、完全な背景置換が可能になります。

## 📁 プロジェクト構成

```
/
├── fantasy-bg.js         # メインスクリプト
├── package.json          # プロジェクト設定
├── .env.example          # API key設定例
├── .gitignore           # Git除外設定
└── README.md            # このファイル
```

---

初回プロンプト: nano-bananaと呼ばれていたgoogleのgemini-flash-imageとかいうすごいやつをサクッとコマンドで動かしたい。コマンド実行時に画像のパスを渡すと、背景をファンタジー世界にしてくれるやつをまずは作って