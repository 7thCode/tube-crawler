# Tube Crawler

macOS向けYouTube動画ライブラリ管理アプリケーション (v0.1.0)

## 必要要件

1. **yt-dlp** (動画メタデータ取得・ダウンロードに必要)
   ```bash
   brew install yt-dlp
   ```

2. **ffmpeg** (yt-dlpが必要とします)
   ```bash
   brew install ffmpeg
   ```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発モードで起動
npm run electron:dev
```

## ビルド

```bash
# DMG + ZIP の両方をビルド
npm run build

# DMGのみビルド
npm run build:dmg

# ZIPのみビルド
npm run build:zip
```

ビルド成果物は `release/` ディレクトリに出力されます。

## 実装済み機能

✅ YouTube URLで動画を追加
✅ 動画メタデータ取得（タイトル、サムネイル、再生時間、チャンネル）
✅ 動画リスト表示
✅ 動画の削除
✅ 動画ダウンロード（進捗表示付き）
✅ オフライン動画再生（Plyrプレイヤー）
✅ SQLiteによる永続的なストレージ
✅ Tailwind CSSによるモダンなUI

## 今後の機能追加予定

❌ 検索・フィルタリング機能
❌ プレイリスト整理機能
❌ タグ・カテゴリ管理

## 技術スタック

- **Electron**: デスクトップアプリフレームワーク
- **Svelte**: フロントエンドフレームワーク
- **TypeScript**: 型安全性
- **Vite**: ビルドツール
- **better-sqlite3**: SQLiteデータベース
- **Plyr**: 動画プレイヤー
- **Tailwind CSS**: ユーティリティファーストCSS
- **yt-dlp**: YouTube動画ダウンロードツール

## プロジェクト構成

```
tube-crawler/
├── src/
│   ├── main/                  # Electronメインプロセス
│   │   ├── main.ts           # エントリーポイント
│   │   ├── preload.ts        # IPCブリッジ
│   │   └── services/         # サービス層
│   │       ├── database.service.ts  # SQLiteデータベース
│   │       └── download.service.ts  # ダウンロード管理
│   ├── renderer/             # Svelteフロントエンド
│   │   ├── App.svelte        # ルートコンポーネント
│   │   ├── components/       # UIコンポーネント
│   │   │   ├── AddVideoInput.svelte
│   │   │   ├── VideoList.svelte
│   │   │   ├── VideoItem.svelte
│   │   │   └── VideoPlayer.svelte
│   │   ├── app.css          # Tailwindスタイル
│   │   └── main.ts          # レンダラーエントリー
│   └── types.d.ts           # TypeScript型定義
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## データ保存場所

- **データベース**: `~/Library/Application Support/tube-crawler/database/videos.db`
- **ダウンロード**: `~/Library/Application Support/tube-crawler/downloads/`

## 使い方

1. アプリを起動
2. YouTube URLを入力欄に貼り付けて「Add」をクリック
3. 動画が追加されたら「⬇️ Download」ボタンでダウンロード
4. ダウンロード完了後、「▶️ Play」ボタンで再生

## ライセンス

MIT
