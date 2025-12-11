# ComiPath - Comiket TSP Web App Project Context

## プロジェクト概要
コミックマーケット（コミケ）でのサークル巡回を効率化するためのWebアプリケーション。
Googleスプレッドシートで管理された「行きたいサークルリスト」を読み込み、現在地から最も近いサークルを提示する（TSP: 巡回セールスマン問題の簡易版）。スマホでの片手操作・一覧性を最優先に設計されている。

## 技術スタック
- **Frontend**: HTML5, CSS3 (Mobile-first, Flexbox/Grid), JavaScript (ES Modules)
- **Backend/Data**: Google Apps Script (GAS) Web App, Google Spreadsheets
- **Libs**: FontAwesome (Icons), Zen Maru Gothic (Font), Twitter Widgets JS
- **Storage**: LocalStorage (データキャッシュ, 送信キュー, 設定)

## 主要ファイルの関数詳細解説

### `js/app.js`
アプリケーションのメインコントローラー。UIとデータロジックの橋渡しを行う。

- **`init()`**
  - アプリ起動時の初期化処理。
  - `UIManager` の初期化、イベントリスナーの設定を行う。
  - `processQueue` を呼び出し、オフライン中に溜まったデータの送信を試みる。
  - 保存されたデータがあれば即座に表示し、なければ自動でデータ更新 (`refreshData`) を試みる。
- **`setupEvents()`**
  - ボタン（設定、更新、検索、購入、保留、Undo、リセット）へのクリックイベント登録。
  - GAS URL入力欄の変更検知。
  - `window` の `online` イベントを監視し、ネットワーク復帰時に自動で同期処理 (`processQueue`) を走らせる。
- **`refreshData(force)`**
  - スプレッドシートから最新データを取得する。
  - 取得前に `processQueue` を呼び、未送信データを先に送る。
  - 成功時、件数をToastで通知し、カウント表示を更新する。
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
  - 「直前の操作を取り消す」ボタンの処理。
  - 履歴から直前の操作を取り消し、GASへUndo情報を送信。
  - 現在地も操作前の場所に戻す。

### `js/data-manager.js`
データの管理、GASとの通信、LocalStorageへの永続化、オフライン対応を担当。

- **`fetchFromSheet(forceRefresh)`**
  - GASのWebアプリURLからJSONデータを取得 (GET)。
  - `forceRefresh` が false の場合、まず LocalStorage のキャッシュを返す（高速化）。
  - 取得成功時、データを LocalStorage にキャッシュする。
- **`syncUpdate(space, isUndo, isBatch)`**
  - データ更新（購入/Undo）のエントリーポイント。
  - データを直接送信せず、`addToQueue` で送信待ちキューに追加し、その後 `processQueue` を呼び出す（非同期・オフライン対応の要）。
- **`addToQueue(payload)`**
  - 送信データに一意なIDとタイムスタンプを付与し、LocalStorage の `syncQueue` 配列に追加保存する。
- **`processQueue()`**
  - 送信待ちキューを処理するバックグラウンドタスク的関数。
  - キューの先頭から順に `sendToGas` を実行。
  - **成功時**: キューから削除し、次へ。
  - **失敗時**: 処理を中断し、データはキューに残す（次回再送のため順序を維持）。
- **`sendToGas(url, payload)`**
  - 実際に `fetch` (POST) を行うヘルパー関数。
- **`addPurchased(space) / addHold(space)`**
  - メモリ上および LocalStorage のリストにサークルを追加し、履歴 (`actionHistory`) にも記録する。
- **`getUnvisited()`**
  - 全リストから、購入済み・保留中を除いた「行くべきサークル」のリストを返す。

### `js/ui-manager.js`
DOMの直接操作、表示の更新、カスタムUIの制御を担当。

- **`setupCustomSelect(nativeSelect, onChangeCallback)`**
  - ネイティブの `<select>` を非表示にし、カスタムデザインの `div` 要素（トリガーとオプションリスト）を生成・挿入する。
  - クリックによる開閉、選択時の値の同期、表示更新 (`render`) 機能を実装。
  - デザイン統一のための核心的な関数。
- **`updateLabelOptions(updateCustom)`**
  - 現在地の「ホール (EWSN)」選択に応じて、「ブロック (Label)」の選択肢を動的に書き換える。
  - カスタムセレクトボックスの再描画 (`render`) もトリガーする。
- **`showTarget(target, startSpace)`**
  - 次の目的地カードの描画。
  - サークル名、距離、優先度を表示。
  - Twitterリンクやお品書きリンクが存在する場合、リンクや埋め込みウィジェットを生成する。
- **`updateCounts(dm)`**
  - **残りサークル数**: 未訪問リストを走査し、エリア（東456, 東7, 西, 南）ごとに集計して表示。
  - **保留サークル数**: `dm.holdList` を走査し、同様にエリアごとに集計して表示する（詳細な内訳表示）。
- **`updateCurrentLocation(space)`**
  - 引数で渡されたスペース文字列（例: "東A12a"）を解析。
  - 現在地入力欄（ホール、ブロック、番号）の値を更新する。
  - 番号はプルダウンの選択肢（10, 20...）の中から最も近い値に丸めてセットする。

### `js/tsp-solver.js`
巡回セールスマン問題（TSP）の簡易ソルバー。

- **`parseSpace(space)`**
  - スペース文字列を解析し、ホール群、ブロック記号、番号に分解する。
  - 全角数字の半角変換も行う。
- **`calcDist(spaceA, spaceB)`**
  - 2つのスペース間の「移動コスト」を計算する独自のヒューリスティック関数。
  - **ホール間移動**: 非常に高いコスト (10000) を設定し、なるべく同じホールを回り切るルートを推奨させる。
  - **ブロック/番号**: 文字コードの差や数値の差から距離を算出。
- **`solve(startSpace, candidates)`**
  - Nearest Neighbor法（貪欲法）を用いた経路探索。
  - 現在地から最もコストが低い（近い）サークルを選び、そこへ移動したとして次を探す、を繰り返す。
  - 計算量が軽く、スマホでも瞬時に結果が出る。

### `js/config.js`
- **`Config`**
  - アプリ全体の設定値。
  - `LABEL_OPTIONS`: 各ホールのブロック記号（"A"~"Z", "ア"~"ン"など）の定義。
  - `STORAGE_KEYS`: LocalStorageで使用するキーの定数管理。

## 最新の機能実装状況 (2025/12/10)
1.  **オフライン対応（送信キュー）**: 通信断でも操作を続行可能にし、復帰時に自動同期。
2.  **UI/UXの改善**:
    - **カスタムセレクト**: デザイン統一。
    - **レイアウト**: 情報を一行にまとめるなど、縦幅を極限まで節約。
    - **自動更新**: アクション後の現在地自動更新でスムーズな巡回を実現。
    - **詳細ステータス**: 保留中もエリア別に見える化。
