# ComiPath - Comiket TSP Web App Project Context

回答には日本語を使用せよ

## プロジェクト概要

コミックマーケット（コミケ）でのサークル巡回を効率化するための Web アプリケーション。
Google スプレッドシートで管理された「行きたいサークルリスト」を読み込み、現在地から最も近いサークルを提示する（TSP: 巡回セールスマン問題の簡易版）。スマホでの片手操作・一覧性を最優先に設計されている。

## 技術スタック

- **Frontend**: HTML5, CSS3 (Mobile-first, Flexbox/Grid), JavaScript (ES Modules)
- **Backend/Data**: Google Apps Script (GAS) Web App, Google Spreadsheets
- **Libs**: FontAwesome (Icons), Zen Maru Gothic (Font), Twitter Widgets JS
- **Storage**: LocalStorage (データキャッシュ, 送信キュー, 設定)

## 主要ファイルの関数詳細解説

### `js/app.js`

アプリケーションのメインコントローラー。UI とデータロジックの橋渡しを行う。

- **`init()`**
  - アプリ起動時の初期化処理。
  - `UIManager` の初期化、イベントリスナーの設定を行う。
  - `processQueue` を呼び出し、オフライン中に溜まったデータの送信を試みる。
  - 保存されたデータがあれば即座に表示し、なければ自動でデータ更新 (`refreshData`) を試みる。
- **`setupEvents()`**
  - ボタン（設定、更新、検索、購入、保留、Undo、Redo、リセット）へのクリックイベント登録。
  - GAS URL 入力欄の変更検知。
  - `window` の `online` イベントを監視し、ネットワーク復帰時に自動で同期処理 (`processQueue`) を走らせる。
- **`refreshData(force)`**
  - スプレッドシートから最新データを取得する。
  - 取得前に `processQueue` を呼び、未送信データを先に送る。
  - 成功時、件数を Toast で通知し、カウント表示を更新する。
- **`searchNext()`**
  - 「次の目的地を検索」ボタンの処理。
  - 現在地の入力値を取得し、`DataManager` から未訪問リストを取得。
  - `TspSolver.solve` を呼び出して経路を計算し、次の目的地 (`path[1]`) を決定。
  - 結果を `UIManager` に渡して画面表示する（完了時は完了画面）。
- **`handleAction(type)`**
  - 「購入済」「保留」ボタンの処理。
  - `DataManager` に状態変更を依頼し、同期処理 (`syncUpdate`) を呼ぶ。
  - `UIManager.updateCurrentLocation` を呼び、処理したサークルの場所を「現在地」として自動セットする。
  - その後、自動的に `searchNext()` を呼び出し、次のサークルを表示する（ユーザーの手間を省く）。
- **`handleUndo()`**
  - 「Undo」ボタンの処理。
  - 履歴から直前の操作を取り消し、GAS へ Undo 情報を送信。
  - 現在地も操作前の場所に戻す。
- **`handleRedo()`**
  - 「Redo」ボタンの処理。
  - 取り消した操作をやり直し、GAS へ再送信。
  - 現在地を更新し、自動で次の目的地を検索する。

### `js/data-manager.js`

データの管理、GAS との通信、LocalStorage への永続化、オフライン対応を担当。

- **`fetchFromSheet(forceRefresh)`**
  - GAS の Web アプリ URL から JSON データを取得 (GET)。
  - `forceRefresh` が false の場合、まず LocalStorage のキャッシュを返す（高速化）。
  - 取得成功時、データを LocalStorage にキャッシュする。
- **`syncUpdate(space, isUndo, isBatch)`**
  - データ更新（購入/Undo）のエントリーポイント。
  - データを直接送信せず、`addToQueue` で送信待ちキューに追加し、その後 `processQueue` を呼び出す（非同期・オフライン対応の要）。
- **`addToQueue(payload)`**
  - 送信データに一意な ID とタイムスタンプを付与し、LocalStorage の `syncQueue` 配列に追加保存する。
- **`processQueue()`**
  - 送信待ちキューを処理するバックグラウンドタスク的関数。
  - キューの先頭から順に `sendToGas` を実行。
  - **成功時**: キューから削除し、次へ。
  - **失敗時**: 処理を中断し、データはキューに残す（次回再送のため順序を維持）。
- **`sendToGas(url, payload)`**
  - 実際に `fetch` (POST) を行うヘルパー関数。
- **`addPurchased(space) / addHold(space)`**
  - メモリ上および LocalStorage のリストにサークルを追加し、履歴 (`actionHistory`) にも記録する。
  - 新しい操作が行われたため、`redoStack` をクリアする。
- **`undoLastAction()`**
  - 直前の操作を履歴から取り消し、`redoStack` に積む。
- **`redoAction()`**
  - `redoStack` から操作を取り出し、再度適用する。
- **`getUnvisited()`**
  - 全リストから、購入済み・保留中を除いた「行くべきサークル」のリストを返す。

### `js/ui-manager.js`

DOM の直接操作、表示の更新、カスタム UI の制御を担当。

- **`setupCustomSelect(nativeSelect, onChangeCallback)`**
  - ネイティブの `<select>` を非表示にし、カスタムデザインの `div` 要素（トリガーとオプションリスト）を生成・挿入する。
  - クリックによる開閉、選択時の値の同期、表示更新 (`render`) 機能を実装。
- **`updateLabelOptions(updateCustom)`**
  - 現在地の「ホール (EWSN)」選択に応じて、「ブロック (Label)」の選択肢を動的に書き換える。
- **`showTarget(target, startSpace)`**
  - 次の目的地カードの描画。
  - サークル名、距離、優先度を表示。
  - 地図画像について、URLが変更された場合のみ `src` を更新し、不要なリロードを抑制する。
- **`updateCounts(dm)`**
  - 残りサークル数と保留サークル数を、エリア別（東 456, 東 7, 西, 南）に集計。
  - **テーブル形式** (`.stats-table`) で表示し、視認性を向上。
  - 保留行 (`.hold-row`) はクリック可能で、保留リストのリセットアクションに繋がる。
- **`updateCurrentLocation(space)`**
  - 引数で渡されたスペース文字列を解析し、現在地入力欄を更新する。
- **`setupZoom(container, img)`**
  - モーダル表示およびメイン画面の地図画像に対し、タッチ操作によるピンチズームとパン（ドラッグ移動）機能を設定する。
  - ジェスチャーイベントを制御し、ブラウザ全体のズームを防止しつつ地図のみを操作可能にする。

### `js/tsp-solver.js`

巡回セールスマン問題（TSP）の簡易ソルバー。

- **`parseSpace(space)`**
  - スペース文字列を解析し、ホール群、ブロック記号、番号に分解する。
  - 全角数字の半角変換も行う。
- **`calcDist(spaceA, spaceB)`**
  - 2 つのスペース間の「移動コスト」を計算する独自のヒューリスティック関数。
- **`solve(startSpace, candidates)`**
  - Nearest Neighbor 法（貪欲法）を用いた経路探索。

### `js/config.js`

- **`Config`**
  - アプリ全体の設定値。
  - `LABEL_OPTIONS`: 各ホールのブロック記号定義。
  - `STORAGE_KEYS`: LocalStorage キー。
  - `MAP_LINKS`: 各エリアの地図画像のパス（`./maps/` 内のローカルファイルを指定）。

## 最新の機能実装状況 (2025/12/24)

1.  **モバイルUX/地図機能強化**:
    - ブラウザ全体のズームを抑制し、**地図エリアのみ**をピンチ操作で拡大・縮小できるように改善。
    - メイン画面の地図表示エリアにもズーム機能を適用。
    - iOS Safari等での意図しない画面全体の拡大（ジェスチャーイベント）を防止し、アプリライクな操作感を実現。
2.  **UIレイアウト改善**:
    - ステータス表示（残り/保留数）をテーブル形式に変更し、一覧性を向上。
    - 「直前の操作を取り消す」ボタンを廃止し、**Undo / Redo** ボタンを実装。
3.  **機能追加**:
    - **Redo（やり直し）機能**: Undo した操作を元に戻せるように実装（LocalStorage で永続化）。
    - **オフライン対応**: 送信キューによる堅牢なデータ同期（継続）。

## 設計・構造の改善 (2025/12/25)

1.  **UIManagerのリファクタリング (進行中)**:
    - 巨大化した `UIManager` を機能単位で分割し、保守性を向上させる作業に着手。
    - **ModalManager**: PDF（画像）モーダル、ギャラリー一覧、画像のピンチズーム制御を担当。
    - **StatsRenderer**: 残り件数・保留件数テーブルの描画とイベント設定を担当。
    - （予定）**MapRenderer**: 地図表示エリアの制御を担当。
2.  **設定の外部化 (予定)**:
    - `config.js` に `AREA_DEFINITIONS` を定義し、コード内に分散していたエリア区分ロジックを集約する予定。