import { DataManager } from "./data-manager.js";
import { TspSolver } from "./tsp-solver.js";
import { UIManager } from "./ui-manager.js";

/**
 * アプリケーションのメインコントローラー
 */
class App {
  constructor() {
    this.dm = new DataManager();
    this.ui = new UIManager();
    this.currentTarget = null;
  }

  /**
   * 初期化実行
   */
  init() {
    this.ui.init(this.dm);
    this.setupEvents();

    // 未送信キューの処理を試行
    this.dm.processQueue();

    // データがあれば初期表示
    if (this.dm.wantToBuy.length > 0) {
      this.ui.showToast("データ読み込み済み");
    } else if (this.dm.getGasUrl()) {
      // URLがあるなら自動更新トライ
      this.refreshData();
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEvents() {
    // 設定ボタン
    document.getElementById("toggle-settings").onclick = () =>
      this.ui.toggleSettings();

    // URL入力
    document.getElementById("gas-url").addEventListener("change", (e) => {
      this.dm.setGasUrl(e.target.value);
    });

    // 各種ボタンアクション
    document.getElementById("btn-refresh").onclick = () =>
      this.refreshData(true);
    document.getElementById("btn-search").onclick = () => this.searchNext();

    document.getElementById("btn-purchased").onclick = () =>
      this.handleAction("purchase");
    document.getElementById("btn-hold").onclick = () =>
      this.handleAction("hold");
    document.getElementById("btn-undo").onclick = () => this.handleUndo();
    document.getElementById("btn-reset-all").onclick = () => this.handleReset();
    document.getElementById("btn-hold-list").onclick = () =>
      this.handleResetHold();

    // オンライン復帰時の同期
    window.addEventListener("online", () => {
      this.ui.showToast("オンラインに復帰しました。同期中...");
      this.dm.processQueue();
    });
  }

  /**
   * データ更新処理
   */
  async refreshData(force = false) {
    this.ui.showToast("データ更新中...");
    
    // 送信待ちがあれば先に送る
    this.dm.processQueue();

    try {
      const count = await this.dm.fetchFromSheet(force);
      this.ui.updateCounts(this.dm);
      this.ui.showToast(`${count}件 読み込みました`);
    } catch (e) {
      this.ui.showToast("読み込み失敗: URLを確認してください");
    }
  }

  /**
   * 次の目的地検索処理
   */
  searchNext() {
    if (this.dm.wantToBuy.length === 0) {
      this.ui.showToast("データがありません");
      return;
    }

    const ewsn = document.getElementById("loc-ewsn").value;
    const label = document.getElementById("loc-label").value;
    const num = document.getElementById("loc-number").value;
    const currentSpace = `${ewsn[0]}${label}${num}`;

    this.ui.showLoading();

    // UI描画をブロックしないように非同期実行
    setTimeout(() => {
      const candidates = this.dm.getUnvisited();
      if (candidates.length === 0) {
        this.ui.showTarget(null);
        this.ui.showToast("全てのサークルを回りました！");
        return;
      }

      // TSP計算
      const path = TspSolver.solve(currentSpace, candidates);

      // path[0]は現在地、path[1]が次の目的地
      if (path.length > 1) {
        this.currentTarget = path[1];
        const nextTarget = path.length > 2 ? path[2] : null;
        this.ui.showTarget(this.currentTarget, currentSpace, nextTarget);
      }
    }, 50);
  }

  /**
   * 購入・保留アクション
   */
  handleAction(type) {
    if (!this.currentTarget) return;

    const space = this.currentTarget.space;

    if (type === "purchase") {
      this.dm.addPurchased(space);
      this.dm.syncUpdate(space); // GAS送信 (Queue経由)
      this.ui.showToast(`${space} 購入！`);
    } else {
      this.dm.addHold(space);
      this.ui.showToast(`${space} 保留`);
    }

    this.ui.updateCounts(this.dm);
    this.ui.updateCurrentLocation(space); // 現在地を更新
    this.searchNext(); // 自動で次を検索
  }

  /**
   * 取り消し処理
   */
  handleUndo() {
    const action = this.dm.undoLastAction();
    if (action) {
      if (action.type === "purchase") {
        this.dm.syncUpdate(action.space, true); // Undo送信 (Queue経由)
      }
      this.ui.showToast(`${action.space} の操作を取り消しました`);
      this.ui.updateCounts(this.dm);
      this.ui.updateCurrentLocation(action.space); // 現在地を元に戻す
      // 画面は更新しない（現在地が変わっていないため）
    } else {
      this.ui.showToast("履歴がありません");
    }
  }

  /**
   * 全リセット処理
   */
  handleReset() {
    if (confirm("本当にリセットしますか？")) {
      const backup = this.dm.resetAll();
      if (backup.length > 0) {
        this.dm.syncUpdate(backup, true, true); // 一括Undo (Queue経由)
      }
      this.ui.updateCounts(this.dm);
      this.ui.showTarget(null); // 表示クリア
      this.ui.els.targetSection.classList.add("hidden");
      this.ui.els.targetEmpty.classList.remove("hidden");
      this.ui.showToast("リセットしました");
    }
  }

  /**
   * 保留リセット処理
   */
  handleResetHold() {
    if (this.dm.holdList.length === 0) return;
    if (confirm("保留リストをクリアしますか？")) {
      this.dm.resetHold();
      this.ui.updateCounts(this.dm);
      this.ui.showToast("保留リストをクリアしました");
    }
  }
}

// アプリ起動
const app = new App();
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
