import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";

/**
 * 統計情報描画クラス
 * 残り件数・保留件数テーブルの更新を担当
 */
export class StatsRenderer {
  constructor(uiManager) {
    this.uiManager = uiManager; // クリックイベント連携用
    this.els = {
      cntE456: document.getElementById("count-e456"),
      cntE7: document.getElementById("count-e7"),
      cntW12: document.getElementById("count-w12"),
      cntS12: document.getElementById("count-s12"),
      
      cntHoldE456: document.getElementById("count-hold-e456"),
      cntHoldE7: document.getElementById("count-hold-e7"),
      cntHoldW12: document.getElementById("count-hold-w12"),
      cntHoldS12: document.getElementById("count-hold-s12"),
    };
    
    this.initEvents();
  }

  /**
   * イベントリスナーの設定
   */
  initEvents() {
    // AREA_DEFINITIONSに基づいてマッピング（Config更新後に有効）
    // 現時点ではConfigがまだ更新されていないため、ハードコードのロジックを維持しつつ、
    // Config更新後にリファクタリングしやすい構造にする。
    
    // 残り件数セル
    const areaMap = {
      cntE456: "東456",
      cntE7: "東7",
      cntW12: "西12",
      cntS12: "南12",
    };

    Object.entries(areaMap).forEach(([key, areaName]) => {
      if (this.els[key]) {
        this.els[key].addEventListener("click", () => {
          if (this.els[key].classList.contains("count-cell")) {
            this.uiManager.openGallery(areaName, false);
          }
        });
      }
    });

    // 保留件数セル
    const holdAreaMap = {
      cntHoldE456: "東456",
      cntHoldE7: "東7",
      cntHoldW12: "西12",
      cntHoldS12: "南12",
    };

    Object.entries(holdAreaMap).forEach(([key, areaName]) => {
      if (this.els[key]) {
        this.els[key].addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.els[key].classList.contains("count-cell")) {
            this.uiManager.openGallery(areaName, true);
          }
        });
      }
    });
  }

  /**
   * カウントの更新
   * @param {DataManager} dm 
   */
  updateCounts(dm) {
    const unvisited = dm.getUnvisited();
    const counts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };

    unvisited.forEach((c) => {
      const [key] = TspSolver.parseSpace(c.space);
      // Config.AREA_DEFINITIONSが導入されたらそちらを参照するように変更予定
      // 現状はTspSolver.parseSpaceがキーを返すと仮定
      if (counts[key] !== undefined) counts[key]++;
    });

    const updateCell = (el, count) => {
      if (!el) return;
      el.textContent = count;
      if (count > 0) {
        el.classList.add("count-cell");
      } else {
        el.classList.remove("count-cell");
      }
    };

    updateCell(this.els.cntE456, counts["東456"]);
    updateCell(this.els.cntE7, counts["東7"]);
    updateCell(this.els.cntW12, counts["西12"]);
    updateCell(this.els.cntS12, counts["南12"]);

    // 保留数のエリア別カウント
    const holdCounts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };
    dm.holdList.forEach((space) => {
      const [key] = TspSolver.parseSpace(space);
      if (holdCounts[key] !== undefined) holdCounts[key]++;
    });

    updateCell(this.els.cntHoldE456, holdCounts["東456"]);
    updateCell(this.els.cntHoldE7, holdCounts["東7"]);
    updateCell(this.els.cntHoldW12, holdCounts["西12"]);
    updateCell(this.els.cntHoldS12, holdCounts["南12"]);
  }
}
