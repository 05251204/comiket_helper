import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";

/**
 * 地図描画クラス
 * メイン画面の地図表示、更新、リンク生成を担当
 */
export class MapRenderer {
  constructor(uiManager) {
    this.uiManager = uiManager; // 将来的な連携用
    this.els = {
      mapContainer: document.getElementById("target-map-container"),
      mapImageScrollContainer: document.getElementById("map-image-container"),
      mapImage: document.getElementById("target-map-image"),
      mapAreaName: document.getElementById("map-area-name"),
      mapLink: document.getElementById("target-map-link"),
      mapLinksContainer: document.getElementById("map-links-container"),
    };
    
    this.init();
  }

  /**
   * 初期化
   */
  init() {
    this.renderMapLinks();
    
    // メイン画面の地図画像にズーム機能を適用
    // ModalManagerのsetupZoomメソッドを借用する
    if (this.uiManager && this.uiManager.modalManager && this.els.mapImageScrollContainer && this.els.mapImage) {
        this.uiManager.modalManager.setupZoom(
            this.els.mapImageScrollContainer, 
            this.els.mapImage
        );
    }
  }

  /**
   * 地図リンクボタンの生成
   */
  renderMapLinks() {
    if (!this.els.mapLinksContainer || !Config.MAP_LINKS) return;

    this.els.mapLinksContainer.innerHTML = "";
    Object.entries(Config.MAP_LINKS).forEach(([name, url]) => {
      const button = document.createElement("button");
      button.className = "map-link-btn";
      button.innerHTML = `<i class="fa-regular fa-map"></i> ${name}`;
      
      // ModalManagerのメソッドを呼び出す必要がある。
      // MapRendererはModalManagerを知らないので、カスタムイベントを発火するか、
      // コールバックを受け取る設計にするのが良いが、
      // 簡易的に window.uiManager (global) を経由するか、
      // コンストラクタで渡された uiManager を使う。
      button.onclick = () => {
        if (this.uiManager && this.uiManager.modalManager) {
            this.uiManager.modalManager.showPdfModal(url);
        }
      };
      
      this.els.mapLinksContainer.appendChild(button);
    });
  }

  /**
   * ターゲットに応じた地図表示の更新
   * @param {string} space - サークルスペース文字列
   */
  updateMap(space) {
    const [hallGroup] = TspSolver.parseSpace(space);
    if (hallGroup && Config.MAP_LINKS[hallGroup]) {
      const url = Config.MAP_LINKS[hallGroup];
      
      // コンテナを表示
      const isHidden = this.els.mapContainer.classList.contains("hidden");
      if (isHidden) {
        this.els.mapContainer.classList.remove("hidden");
      }

      this.els.mapAreaName.textContent = hallGroup;
      
      // 同じURLならリロードしない
      if (this.els.mapImage.getAttribute("src") !== url) {
         this.els.mapImage.src = url;
         // 画像が変更されたらズームリセットなどをここで行うのが理想
         if (this.els.mapImage.resetZoom) {
             this.els.mapImage.resetZoom();
         }
      }
      this.els.mapLink.href = url;
    } else {
      this.els.mapContainer.classList.add("hidden");
    }
  }
}
