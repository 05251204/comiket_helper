import { Config } from "./config.js";

/**
 * データ管理クラス
 * LocalStorageの読み書き、GASとの通信を担当
 */
export class DataManager {
  constructor() {
    // メモリ上にデータを保持
    this.wantToBuy = [];
    this.purchasedList =
      JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.PURCHASED)) || [];
    this.holdList =
      JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.HOLD)) || [];
    this.actionHistory =
      JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.HISTORY)) || [];
    // 送信待ちキュー
    this.syncQueue =
      JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.SYNC_QUEUE)) || [];
    // 選択されたシートリスト
    this.selectedSheets =
      JSON.parse(localStorage.getItem(Config.STORAGE_KEYS.SELECTED_SHEETS)) || [];
  }

  /**
   * 保存されているGASのWebアプリURLを取得
   */
  getGasUrl() {
    return localStorage.getItem(Config.STORAGE_KEYS.URL) || "";
  }

  /**
   * GASのWebアプリURLを保存
   */
  setGasUrl(url) {
    localStorage.setItem(Config.STORAGE_KEYS.URL, url);
  }

  /**
   * 選択されているシートリストを取得
   */
  getSelectedSheets() {
    return this.selectedSheets;
  }

  /**
   * 選択されているシートリストを保存
   */
  setSelectedSheets(sheets) {
    this.selectedSheets = sheets;
    localStorage.setItem(
      Config.STORAGE_KEYS.SELECTED_SHEETS,
      JSON.stringify(this.selectedSheets)
    );
  }

  /**
   * GASからシート一覧を取得
   */
  async fetchSheetList() {
    const baseUrl = this.getGasUrl();
    if (!baseUrl) throw new Error("URL未設定");

    const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}action=getSheets`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("通信エラー");
      const data = await res.json();
      return data.sheets || [];
    } catch (e) {
      throw e;
    }
  }

  /**
   * スプレッドシートからデータを取得
   * @param {boolean} forceRefresh - キャッシュを無視して強制取得するか
   */
  async fetchFromSheet(forceRefresh = false) {
    let url = this.getGasUrl();
    if (!url) throw new Error("URL未設定");

    // 選択されたシートがあればパラメータに追加
    if (this.selectedSheets.length > 0) {
      const separator = url.includes("?") ? "&" : "?";
      url += `${separator}sheets=${encodeURIComponent(
        this.selectedSheets.join(",")
      )}`;
    }

    // 強制更新でなければLocalStorageのキャッシュを試す
    if (!forceRefresh) {
      const saved = localStorage.getItem(Config.STORAGE_KEYS.DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.wantToBuy = parsed.wantToBuy || [];
        return this.wantToBuy.length;
      }
    }

    // ネットワーク通信
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("通信エラー");
      const data = await res.json();
      this.wantToBuy = data.wantToBuy || [];
      // データをキャッシュ
      localStorage.setItem(
        Config.STORAGE_KEYS.DATA,
        JSON.stringify({ wantToBuy: this.wantToBuy })
      );
      return this.wantToBuy.length;
    } catch (e) {
      throw e;
    }
  }

  /**
   * GASへ更新情報を送信（キュー経由）
   */
  async syncUpdate(space, isUndo = false, isBatch = false) {
    const payload = isBatch
      ? { spaces: space, undo: true }
      : { space: space, undo: isUndo };

    this.addToQueue(payload);
    this.processQueue(); // バックグラウンドで送信試行
  }

  /**
   * 送信キューに追加
   */
  addToQueue(payload) {
    const item = {
      id: Date.now() + Math.random().toString(36).substring(2),
      timestamp: Date.now(),
      payload: payload,
    };
    this.syncQueue.push(item);
    this.saveList(Config.STORAGE_KEYS.SYNC_QUEUE, this.syncQueue);
  }

  /**
   * キューを処理して送信
   */
  async processQueue() {
    if (this.syncQueue.length === 0) return;
    if (this.isProcessing) return; // 二重実行防止

    const url = this.getGasUrl();
    if (!url) return;

    this.isProcessing = true;

    try {
      // 先頭から順に処理
      while (this.syncQueue.length > 0) {
        const item = this.syncQueue[0];
        try {
          await this.sendToGas(url, item.payload);
          // 成功したらキューから削除
          this.syncQueue.shift();
          this.saveList(Config.STORAGE_KEYS.SYNC_QUEUE, this.syncQueue);
        } catch (e) {
          console.error("Sync failed, retrying later:", e);
          break; // 失敗したら中断（順序保持のため）
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 実際の送信処理 (内部用)
   */
  async sendToGas(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    // HTTPステータスがOKでなければ即座にエラー
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const jsonResponse = await res.json();
    // アプリケーションレベルでのエラーをチェック
    if (jsonResponse.status !== "success") {
      throw new Error(`GAS Error: ${jsonResponse.message}`);
    }
  }

  /**
   * 購入リストに追加
   */
  addPurchased(space) {
    if (!this.purchasedList.includes(space)) {
      this.purchasedList.push(space);
      this.saveList(Config.STORAGE_KEYS.PURCHASED, this.purchasedList);
      this.addHistory("purchase", space);
    }
  }

  /**
   * 保留リストに追加
   */
  addHold(space) {
    if (!this.holdList.includes(space)) {
      this.holdList.push(space);
      this.saveList(Config.STORAGE_KEYS.HOLD, this.holdList);
      this.addHistory("hold", space);
    }
  }

  /**
   * 直前の操作を取り消す
   */
  undoLastAction() {
    const last = this.actionHistory.pop();
    if (!last) return null;

    this.saveList(Config.STORAGE_KEYS.HISTORY, this.actionHistory);

    if (last.type === "purchase") {
      this.purchasedList = this.purchasedList.filter((s) => s !== last.space);
      this.saveList(Config.STORAGE_KEYS.PURCHASED, this.purchasedList);
    } else if (last.type === "hold") {
      this.holdList = this.holdList.filter((s) => s !== last.space);
      this.saveList(Config.STORAGE_KEYS.HOLD, this.holdList);
    }
    return last;
  }

  /**
   * 全データをリセット
   */
  resetAll() {
    const backup = [...this.purchasedList]; // バックアップ（一括Undo用）
    this.purchasedList = [];
    this.holdList = [];
    this.actionHistory = [];

    localStorage.removeItem(Config.STORAGE_KEYS.PURCHASED);
    localStorage.removeItem(Config.STORAGE_KEYS.HOLD);
    localStorage.removeItem(Config.STORAGE_KEYS.HISTORY);
    return backup;
  }

  /**
   * 保留リストのみリセット
   */
  resetHold() {
    this.holdList = [];
    localStorage.removeItem(Config.STORAGE_KEYS.HOLD);
    this.actionHistory = this.actionHistory.filter((a) => a.type !== "hold");
    this.saveList(Config.STORAGE_KEYS.HISTORY, this.actionHistory);
  }

  /**
   * 操作履歴に追加（内部用）
   */
  addHistory(type, space) {
    this.actionHistory.push({ type, space });
    this.saveList(Config.STORAGE_KEYS.HISTORY, this.actionHistory);
  }

  /**
   * LocalStorageへの保存（内部用）
   */
  saveList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  /**
   * 未訪問（購入も保留もしていない）のリストを取得
   */
  getUnvisited() {
    return this.wantToBuy.filter(
      (c) =>
        !this.purchasedList.includes(c.space) &&
        !this.holdList.includes(c.space)
    );
  }
}